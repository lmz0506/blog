---
layout: doc
title: "可控智能体：Human-in-the-loop、审批流、拒绝与参数编辑"
category: DeepAgents
date: '2026-07-31'
tags:
  - Human-in-the-loop
  - 审批流
  - LangGraph
  - 权限控制
---

# 可控智能体：Human-in-the-loop、审批流、拒绝与参数编辑

让智能体“能调用工具”并不难，难的是让它在真正产生副作用前停下来：删除文件要确认，修改关键配置要让人看过，向外部收件人发送消息既要能拒绝，也要能改收件人和正文。

DeepAgents 的 Human-in-the-loop（HITL）机制建立在 LangGraph 的持久化与中断能力之上。它不是在工具执行后补一条审计日志，而是在工具调用与副作用之间插入一个可恢复的暂停点。人工可以：

- `approve`：批准原始工具调用；
- `edit`：修改工具名或参数后再执行；
- `reject`：拒绝执行，并把原因反馈给智能体；
- `respond`：把人工结果送回已暂停的运行。它通常表现为 `Command(resume=...)`，不是第四种审批结论。

本文先拆解这些概念，再实现一个完整审批流：主智能体可以删改项目文件，发布子智能体可以外发消息；普通文件修改直接执行，敏感文件操作触发条件式权限中断，删除和外发消息则进入标准审批。

## 一、先建立正确的执行模型

一次带审批的工具调用可以抽象为：

```text
用户请求
  │
  ▼
模型生成 tool call
  │
  ├─ 不需要审批 ───────────────▶ 执行工具
  │
  └─ 需要审批
         │
         ▼
      保存检查点
         │
         ▼
      返回 __interrupt__
         │
         ├─ approve ───────────▶ 执行原调用
         ├─ edit ──────────────▶ 执行修改后的调用
         └─ reject ────────────▶ 不执行，原因回到模型
                                  │
                                  ▼
                         模型调整计划或向用户解释
```

这里有三个容易混淆的角色。

### 1. `interrupt_on` 决定“哪些工具要停”

`create_deep_agent(..., interrupt_on=...)` 可以按工具名声明审批规则。值为 `True` 表示使用默认审批选项；对象形式可以显式限制允许的决定：

```python
interrupt_on={
    "delete_project_file": {
        "allowed_decisions": ["approve", "reject"],
        "description": "删除项目文件前必须由负责人确认",
    },
    "replace_text_file": {
        "allowed_decisions": ["approve", "edit", "reject"],
        "description": "允许审批人修改路径或替换内容",
    },
}
```

`allowed_decisions` 不只是前端按钮配置，也是服务端应遵守的能力边界。例如删除动作不允许 `edit`，审批页面就不应该接受审批人临时把它改成另一个删除目标。

### 2. checkpointer 决定“暂停状态存在哪里”

中断发生时，图的消息、工具调用、待审批数据以及执行位置都要保存。没有 checkpointer，就没有可靠的跨请求恢复。

开发环境可使用内存实现：

```python
from langgraph.checkpoint.memory import InMemorySaver

checkpointer = InMemorySaver()
```

生产环境应使用持久化 checkpointer，例如 PostgreSQL 或 SQLite 对应的 LangGraph checkpointer 包。内存实现会在进程重启后丢失暂停任务，也不适合多实例服务。

### 3. `thread_id` 决定“恢复哪一次运行”

调用和恢复必须使用完全相同的 `thread_id`：

```python
config = {"configurable": {"thread_id": "change-request-20260731-001"}}
```

可以把它理解为一次智能体任务的持久化关联键。一个 thread 可以先后产生多次中断和多张审批记录，所以 `thread_id` **不是**每张审批记录的唯一 ID。恢复时换了 `thread_id`，等于打开了另一个会话，找不到原检查点；把同一个 `thread_id` 错用于两个独立任务，则可能串线。

推荐使用不可猜测且全局唯一的业务 ID，并在审批表中同时保存：

- `thread_id`；
- 独立的 `approval_id`/`interrupt_id` 与 checkpoint 版本；
- 当前中断的展示数据；
- 审批单状态与版本号；
- 操作者、时间和决定；
- 恢复请求的幂等键。

## 二、`approve`、`edit`、`reject` 与 `respond`

### `approve`：执行模型原本提出的动作

标准 HITL 中断可能一次包含一个或多个工具调用。返回的决定数组必须与 `action_requests` 顺序对应：

```python
Command(
    resume={
        "decisions": [
            {"type": "approve"},
            {"type": "approve"},
        ]
    }
)
```

批准意味着接受当时中断中展示的参数。审批 UI 不应只显示“发送消息”四个字，还应展示收件人、主题、正文等完整参数。

### `edit`：审批参数，而不是重新对话

`edit` 使用 `edited_action` 给出最终工具调用：

```python
Command(
    resume={
        "decisions": [
            {
                "type": "edit",
                "edited_action": {
                    "name": "send_external_message",
                    "args": {
                        "recipient": "release-review@example.com",
                        "subject": "发布计划（待最终确认）",
                        "body": "仅发送评审环境的发布计划，不包含生产密钥。",
                    },
                },
            }
        ]
    }
)
```

服务端仍要校验工具名、参数类型和业务权限。不能因为参数来自“人工编辑”，就绕过收件人域名白名单、路径边界或数据防泄漏规则。

### `reject`：不执行，并告诉智能体为什么

拒绝结果可以携带解释：

```python
Command(
    resume={
        "decisions": [
            {
                "type": "reject",
                "message": "收件人不是公司域名，请改为内部评审群。",
            }
        ]
    }
)
```

工具不会执行，拒绝原因会回到智能体上下文。模型随后可能改用合规参数再次发起工具调用，也可能向用户说明无法继续。第二次工具调用仍应重新审批，不能把一次拒绝后的修改默认为已获授权。

### `respond`：把决定送回暂停点

有些系统把审批接口命名为 `respond`，例如：

```http
POST /approval-requests/{id}/respond
```

在 DeepAgents/LangGraph 代码中，其核心是：

```python
agent.invoke(
    Command(resume={"decisions": [{"type": "approve"}]}),
    config=same_config,
)
```

因此要区分：

- decision：`approve`、`edit`、`reject`；
- response/resume：承载 decision、恢复暂停图的协议；
- HTTP `respond`：应用层可以自定义的接口名称。

## 三、完整示例：删改文件与外发消息的审批流

下面的示例可以保存为 `approval_demo.py`。它包含：

- 安全的项目目录边界；
- 普通文本替换直接执行；
- 对敏感路径的条件式权限中断；
- 删除文件的标准审批；
- 发布 subagent 的外发消息审批；
- 中断展示、批准、编辑、拒绝和恢复代码。

安装依赖：

```bash
pip install -U deepagents langgraph langchain-core langchain-openai
```

示例使用 OpenAI 模型，运行前还要在环境中提供 `OPENAI_API_KEY`。如果改用其他模型提供商，请安装对应的 LangChain provider 包，并替换 `model`。

完整代码如下：

```python
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from deepagents import create_deep_agent
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command, interrupt


# ----------------------------
# 1. 文件与外发服务的安全边界
# ----------------------------

PROJECT_ROOT = Path("./demo_workspace").resolve()
PROJECT_ROOT.mkdir(parents=True, exist_ok=True)

# 示例中只允许向这两个域发送。真实系统应由组织策略服务判断。
ALLOWED_MESSAGE_DOMAINS = {"example.com", "corp.example"}

# 这些路径的修改需要额外的“文件维护者”权限确认。
SENSITIVE_NAMES = {".env", "production.yaml", "secrets.json"}


def resolve_project_path(relative_path: str) -> Path:
    """解析并验证路径，防止 ../ 越界和绝对路径逃逸。"""
    candidate = (PROJECT_ROOT / relative_path).resolve()
    if candidate != PROJECT_ROOT and PROJECT_ROOT not in candidate.parents:
        raise ValueError(f"路径越过项目边界：{relative_path}")
    return candidate


def validate_recipient(recipient: str) -> None:
    """人工 edit 后仍必须再次执行的服务端校验。"""
    if "@" not in recipient:
        raise ValueError("收件人格式错误")
    domain = recipient.rsplit("@", 1)[1].lower()
    if domain not in ALLOWED_MESSAGE_DOMAINS:
        raise PermissionError(f"禁止向域名 {domain} 外发消息")


def is_sensitive(relative_path: str) -> bool:
    path = Path(relative_path)
    return path.name in SENSITIVE_NAMES or "secrets" in path.parts


# ----------------------------
# 2. 智能体可调用的工具
# ----------------------------

@tool
def replace_text_file(path: str, old: str, new: str) -> str:
    """替换项目内 UTF-8 文本文件中的内容；敏感路径会请求额外权限。"""
    target = resolve_project_path(path)
    requested_path = path

    # 条件式中断：普通文件不停，只有敏感文件才暂停。
    # 注意：任何写入都必须放在 interrupt 之后，避免恢复时重复副作用。
    if is_sensitive(path):
        response = interrupt(
            {
                "kind": "file_permission",
                "action": "replace_text_file",
                "path": path,
                "preview": {"old": old, "new": new},
                "allowed_decisions": ["approve", "edit", "reject"],
                "description": "目标属于敏感配置，需要文件维护者授权",
            }
        )

        decision = response.get("type")
        if decision == "reject":
            return f"修改被拒绝：{response.get('message', '审批人未说明原因')}"
        if decision == "edit":
            edited = response["edited_args"]
            path = edited.get("path", path)
            old = edited.get("old", old)
            new = edited.get("new", new)
            target = resolve_project_path(path)
            # 本权限中断只授权最初展示的敏感文件。
            # 如需切换目标，应拒绝本次操作并重新发起一张审批单。
            if path != requested_path:
                raise PermissionError("编辑后不能切换敏感文件目标")
        elif decision != "approve":
            raise ValueError(f"未知审批决定：{decision!r}")

    text = target.read_text(encoding="utf-8")
    if old not in text:
        return f"未修改：{path} 中不存在指定文本"
    target.write_text(text.replace(old, new), encoding="utf-8")
    return f"已修改 {path}"


@tool
def delete_project_file(path: str) -> str:
    """删除项目内文件。该工具由 interrupt_on 统一拦截。"""
    target = resolve_project_path(path)
    if not target.is_file():
        return f"文件不存在：{path}"
    target.unlink()
    return f"已删除 {path}"


@tool
def send_external_message(recipient: str, subject: str, body: str) -> str:
    """向外部地址发送消息。示例仅打印；接入生产消息网关时保持相同审批边界。"""
    validate_recipient(recipient)

    # 真正系统应在这里调用邮件、Slack 或企业消息网关。
    print(
        json.dumps(
            {
                "recipient": recipient,
                "subject": subject,
                "body": body,
            },
            ensure_ascii=False,
        )
    )
    return f"消息已发送给 {recipient}"


# ----------------------------
# 3. 为主智能体和 subagent 配置中断
# ----------------------------

release_subagent = {
    "name": "release-coordinator",
    "description": "整理发布通知，并在得到人工批准后发送给目标收件人",
    "system_prompt": (
        "你负责拟定简洁的发布消息。不得声称消息已经发送；"
        "只有 send_external_message 工具成功返回后，才能报告发送成功。"
    ),
    "tools": [send_external_message],
    "interrupt_on": {
        "send_external_message": {
            "allowed_decisions": ["approve", "edit", "reject"],
            "description": "外发前核对收件人、主题和正文",
        }
    },
}

checkpointer = InMemorySaver()

agent = create_deep_agent(
    model="openai:gpt-5-mini",
    system_prompt=(
        "你是变更执行助手。先检查目标与参数，再调用合适工具。"
        "文件删除必须请求批准；需要发通知时委派给 release-coordinator。"
        "若动作被拒绝，遵守拒绝原因，不得换一种方式绕过审批。"
    ),
    tools=[replace_text_file, delete_project_file],
    subagents=[release_subagent],
    interrupt_on={
        "delete_project_file": {
            "allowed_decisions": ["approve", "reject"],
            "description": "删除文件不可撤销，执行前必须确认",
        }
        # replace_text_file 没有配置在这里：
        # 它只在函数内部识别到敏感路径时通过 interrupt() 暂停。
    },
    checkpointer=checkpointer,
)


# ----------------------------
# 4. 通用调用与恢复辅助函数
# ----------------------------

THREAD_ID = "change-request-20260731-001"
CONFIG = {"configurable": {"thread_id": THREAD_ID}}


def start(user_text: str) -> dict[str, Any]:
    """首次调用：使用消息输入。"""
    return agent.invoke(
        {"messages": [{"role": "user", "content": user_text}]},
        config=CONFIG,
    )


def respond(resume_payload: dict[str, Any]) -> dict[str, Any]:
    """恢复调用：必须复用首次调用的 CONFIG，也就是同一 thread_id。"""
    return agent.invoke(
        Command(resume=resume_payload),
        config=CONFIG,
    )


def print_interrupts(result: dict[str, Any]) -> None:
    interrupts = result.get("__interrupt__", ())
    if not interrupts:
        print("当前没有待审批中断")
        return
    for index, item in enumerate(interrupts):
        print(f"\n--- interrupt #{index} ---")
        print(json.dumps(item.value, ensure_ascii=False, indent=2))


def demo_review(interrupt_value: dict[str, Any]) -> dict[str, Any]:
    """
    可运行示例中的“模拟人工审批台”。

    生产系统不能自动批准，应把 interrupt_value 存入审批数据库，
    等有权限的审批人提交决定后再调用 respond。
    """
    if interrupt_value.get("kind") == "file_permission":
        # 自定义条件式中断使用自定义恢复协议。
        return {"type": "approve"}

    decisions: list[dict[str, Any]] = []
    for action, review in zip(
        interrupt_value["action_requests"],
        interrupt_value["review_configs"],
        strict=True,
    ):
        name = action["name"]
        allowed = set(review["allowed_decisions"])

        if name == "delete_project_file":
            decision = {"type": "approve"}
        elif name == "send_external_message":
            args = dict(action["args"])
            args["subject"] = f"[人工复核] {args['subject']}"
            decision = {
                "type": "edit",
                "edited_action": {"name": name, "args": args},
            }
        else:
            decision = {
                "type": "reject",
                "message": f"演示审批台未授权工具：{name}",
            }

        if decision["type"] not in allowed:
            raise PermissionError(
                f"{name} 不允许决定 {decision['type']}，允许值为 {sorted(allowed)}"
            )
        decisions.append(decision)

    return {"decisions": decisions}


if __name__ == "__main__":
    # 示例数据。所有读写都显式使用 UTF-8。
    (PROJECT_ROOT / "draft.txt").write_text("状态：草稿\n", encoding="utf-8")
    (PROJECT_ROOT / "obsolete.txt").write_text("待删除\n", encoding="utf-8")

    result = start(
        "完成以下变更："
        "把 draft.txt 的“草稿”改成“已评审”；"
        "删除 obsolete.txt；"
        "然后让发布协调员把结果发送给 release@example.com。"
    )
    print_interrupts(result)

    # 每次恢复后都可能出现下一次中断，因此必须循环。
    # 示例按工具名作确定性决定，不依赖“删除一定先于外发”等模型规划顺序。
    while result.get("__interrupt__"):
        interrupts = result["__interrupt__"]
        if len(interrupts) != 1:
            raise RuntimeError("本演示只处理一个活动中断批次")
        resume_payload = demo_review(interrupts[0].value)
        result = respond(resume_payload)
        print_interrupts(result)

    print(result["messages"][-1].content)
```

运行时，模型可能先执行普通的 `draft.txt` 修改，然后在删除或外发消息处暂停。工具规划顺序由模型决定，因此不要假定“第一次中断一定是删除”。示例的 `demo_review()` 只是为了让代码从头跑到尾；真实应用必须读取 `__interrupt__`、持久化审批单，并等待有权限的人作决定，绝不能照搬其中的自动批准策略。

## 四、处理标准 `interrupt_on` 中断

标准 HITL 中断的 `value` 通常包含两组对齐的数据：

```python
interrupt_value = result["__interrupt__"][0].value

for action, review in zip(
    interrupt_value["action_requests"],
    interrupt_value["review_configs"],
):
    print("工具：", action["name"])
    print("参数：", action["args"])
    print("可选决定：", review["allowed_decisions"])
```

不同版本可能为中断对象增加字段，业务代码应按键读取，不要依赖整个对象的字符串形式。

### 批准删除

```python
result = respond(
    {
        "decisions": [
            {"type": "approve"},
        ]
    }
)
print_interrupts(result)
```

恢复后，图会继续运行，可能完成任务，也可能在下一个敏感动作处再次中断。每次 `respond` 后都要重新检查 `__interrupt__`。

### 编辑外发消息

假设下一次中断是 `send_external_message`，审批人可以修改参数：

```python
result = respond(
    {
        "decisions": [
            {
                "type": "edit",
                "edited_action": {
                    "name": "send_external_message",
                    "args": {
                        "recipient": "release-review@example.com",
                        "subject": "变更完成，请复核",
                        "body": (
                            "draft.txt 已更新，obsolete.txt 已按审批删除。"
                            "请在发布前进行最终复核。"
                        ),
                    },
                },
            }
        ]
    }
)
print_interrupts(result)
```

尽管审批人修改了收件人，`validate_recipient()` 仍会执行。HITL 是业务授权的一层，不替代输入验证和最小权限。

### 拒绝外发

```python
result = respond(
    {
        "decisions": [
            {
                "type": "reject",
                "message": "本次变更只允许本地执行，不要外发消息。",
            }
        ]
    }
)
print_interrupts(result)
```

拒绝不是异常，也不应让整个服务返回 500。它是正常的业务分支。智能体应根据原因停止外发，并给出可审计的最终说明。

### 一次中断中有多个动作

模型并行提出多个工具调用时，一次中断可能带有多个 `action_requests`。决定必须逐项对应：

```python
result = respond(
    {
        "decisions": [
            {"type": "approve"},
            {
                "type": "reject",
                "message": "第二个收件人不在本次变更范围内。",
            },
        ]
    }
)
```

审批服务应先校验：

1. 决定数量是否等于待审动作数量；
2. 每个决定是否在对应的 `allowed_decisions` 中；
3. `edit` 后的工具名和参数是否通过 schema 与业务策略校验；
4. 审批单是否仍处于待处理状态，避免重复恢复。

下面给出标准 HITL 载荷的最小服务端校验。它不能代替每个工具自己的 Pydantic/schema 和业务校验，但能防止客户端提交未开放的决定或偷偷更换工具：

```python
def validate_standard_decisions(
    interrupt_value: dict[str, Any],
    resume_payload: dict[str, Any],
) -> None:
    actions = interrupt_value["action_requests"]
    reviews = interrupt_value["review_configs"]
    decisions = resume_payload.get("decisions")

    if not isinstance(decisions, list) or len(decisions) != len(actions):
        raise ValueError("decisions 必须与 action_requests 一一对应")

    for action, review, decision in zip(
        actions, reviews, decisions, strict=True
    ):
        decision_type = decision.get("type")
        if decision_type not in review["allowed_decisions"]:
            raise PermissionError(
                f"{action['name']} 不允许决定 {decision_type!r}"
            )

        if decision_type == "edit":
            edited = decision.get("edited_action", {})
            if edited.get("name") != action["name"]:
                raise PermissionError("edit 不允许切换到另一个工具")
            if not isinstance(edited.get("args"), dict):
                raise ValueError("edited_action.args 必须是对象")

        if decision_type == "reject" and not isinstance(
            decision.get("message", ""), str
        ):
            raise ValueError("reject.message 必须是字符串")
```

校验通过后再执行 `Command(resume=resume_payload)`；工具真正运行时仍须重新检查路径、收件人、数据分级和调用者权限。

## 五、条件式中断：只拦真正高风险的参数

把 `replace_text_file` 放进 `interrupt_on` 会拦截每一次文本替换，安全但审批噪声很大。更实用的规则通常与参数相关：

- 修改 `README.md`：直接执行；
- 修改 `.env`：需要文件维护者批准；
- 修改 `secrets/` 下的内容：禁止或升级审批；
- 替换文本超过一定长度：需要预览确认。

示例中的 `replace_text_file()` 在工具内部调用 `interrupt()`，实现参数级条件判断。自定义中断不自动使用标准的 `{"decisions": [...]}` 信封；恢复载荷由工具自己定义：

```python
# 批准敏感文件修改
result = respond({"type": "approve"})

# 拒绝
result = respond(
    {
        "type": "reject",
        "message": "生产配置只能通过配置发布系统修改。",
    }
)

# 编辑参数
result = respond(
    {
        "type": "edit",
        "edited_args": {
            "path": ".env",
            "old": "FEATURE=false",
            "new": "FEATURE=true",
        },
    }
)
```

这揭示了一个重要边界：

| 中断来源 | 中断数据 | 恢复数据 |
| --- | --- | --- |
| `interrupt_on` 标准 HITL | `action_requests`、`review_configs` | `{"decisions": [...]}` |
| 工具内自定义 `interrupt()` | 由开发者定义 | 由开发者定义 |

前端可以把两类中断统一展示，但后端必须根据 `kind` 或中断 schema 选择正确的恢复协议。

### 中断前不要产生副作用

LangGraph 恢复中断节点时，会从该节点的可重放边界重新执行。因此：

```python
# 错误：先发消息，再等待批准；恢复还可能重复发送
message_id = gateway.send(...)
decision = interrupt(...)
```

必须改为：

```python
# 正确：所有副作用都在批准之后
decision = interrupt(...)
if decision["type"] == "approve":
    message_id = gateway.send(...)
```

如果工具需要在中断前读取文件或计算预览，应保持这些操作只读、确定且可重复。

## 六、权限中断不等于普通确认框

“你确定吗？”只确认意图；权限中断还要确认操作者是否有资格批准。建议审批服务在调用 `respond()` 之前完成以下检查：

```python
def authorize_approval(
    *,
    reviewer_roles: set[str],
    interrupt_kind: str,
    action_name: str,
) -> None:
    if interrupt_kind == "file_permission" and "file-maintainer" not in reviewer_roles:
        raise PermissionError("只有 file-maintainer 可以批准敏感文件修改")

    if action_name == "send_external_message" and not (
        {"release-manager", "security-reviewer"} & reviewer_roles
    ):
        raise PermissionError("外发消息需要发布经理或安全审核员批准")
```

完整的权限判断至少应覆盖：

- **主体**：谁在批准，身份是否经过强认证；
- **客体**：具体文件、收件人和工作区；
- **动作**：读、写、删除或外发；
- **上下文**：环境、时间、变更单、数据分级；
- **决定范围**：一次性批准，还是某段时间内的策略授权。

权限校验应该在可信服务端执行，不能只依赖前端隐藏按钮，也不能让模型自己判断“用户大概有权限”。

## 七、subagent 中断如何向上传递

示例把 `send_external_message` 只交给 `release-coordinator` 子智能体，并在 subagent 配置内声明 `interrupt_on`。当子智能体准备外发时：

1. 主智能体通过内置委派机制调用 subagent；
2. subagent 产生 `send_external_message` 工具调用；
3. subagent 的 HITL 规则触发中断；
4. 中断冒泡到顶层 `agent.invoke()`，顶层调用返回 `__interrupt__`；
5. 应用仍对顶层 agent 使用原 `thread_id` 和 `Command(resume=...)`；
6. 恢复信号被路由回暂停的 subagent，完成后结果再返回主智能体。

不要为了恢复子智能体而新建一个 agent，也不要直接调用子智能体工具。那样会绕过原图的调用栈和检查点。

如果多个 subagent 都能执行高风险动作，应分别声明策略：

```python
subagents = [
    {
        "name": "release-coordinator",
        "description": "发送发布通知",
        "system_prompt": "只处理发布沟通。",
        "tools": [send_external_message],
        "interrupt_on": {
            "send_external_message": {
                "allowed_decisions": ["approve", "edit", "reject"],
            }
        },
    },
    {
        "name": "cleanup-worker",
        "description": "清理废弃文件",
        "system_prompt": "只处理项目文件清理。",
        "tools": [delete_project_file],
        "interrupt_on": {
            "delete_project_file": {
                "allowed_decisions": ["approve", "reject"],
            }
        },
    },
]
```

即使主智能体本身没有某个危险工具，也要审计每个 subagent 的工具集合和中断规则。委派不能成为权限逃逸通道。

## 八、跨 HTTP 请求恢复

实际系统通常分成“启动任务”和“处理审批”两个接口。下面是精简的框架无关伪代码：

```python
def create_run(change_request_id: str, prompt: str) -> dict:
    config = {
        "configurable": {
            "thread_id": f"change-request:{change_request_id}",
        }
    }
    result = agent.invoke(
        {"messages": [{"role": "user", "content": prompt}]},
        config=config,
    )
    return serialize_result(result)


def respond_to_approval(
    change_request_id: str,
    resume_payload: dict,
    reviewer: dict,
    idempotency_key: str,
) -> dict:
    thread_id = f"change-request:{change_request_id}"

    # 1. 从业务数据库读取待审记录并校验状态。
    approval = approval_store.get_pending(change_request_id)
    approval_store.assert_idempotency_key_unused(idempotency_key)

    # 2. 服务端鉴权；不要相信客户端提交的 allowed_decisions。
    authorize_approval(
        reviewer_roles=set(reviewer["roles"]),
        interrupt_kind=approval["kind"],
        action_name=approval["action_name"],
    )
    validate_resume_payload(approval, resume_payload)

    # 3. 先以事务方式登记“正在处理”，避免两个审批人同时恢复。
    approval_store.claim(approval["id"], reviewer["id"], idempotency_key)

    # 4. 使用同一 thread_id 恢复。
    result = agent.invoke(
        Command(resume=resume_payload),
        config={"configurable": {"thread_id": thread_id}},
    )

    # 5. 保存新状态；若又产生中断，则创建下一张待审记录。
    approval_store.record_result(approval["id"], result)
    return serialize_result(result)
```

### 为什么不能只把 `result` 放在 Web 进程内存中

审批可能几小时后才发生，期间服务会滚动发布、扩缩容或切换实例。持久化 checkpointer 负责图状态，业务数据库负责审批单、操作者和幂等状态，两者缺一不可。

一个生产部署示意：

```python
# 需要额外安装对应包：
# pip install -U langgraph-checkpoint-postgres

from langgraph.checkpoint.postgres import PostgresSaver

DB_URI = "postgresql://user:password@db.example.com/agent"

with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    # setup() 应由一次性的部署迁移任务执行，此处仅为独立示例便于理解。
    checkpointer.setup()
    agent = create_deep_agent(
        model="openai:gpt-5-mini",
        tools=[replace_text_file, delete_project_file],
        subagents=[release_subagent],
        interrupt_on={
            "delete_project_file": {
                "allowed_decisions": ["approve", "reject"],
            }
        },
        checkpointer=checkpointer,
    )
    # agent.invoke(...) 也必须发生在 with 生命周期内。
```

连接串应来自密钥管理系统，代码中不要硬编码。多租户系统还应让 `thread_id` 与租户绑定，并在查询和恢复时校验租户归属。Web 服务不要在请求结束时关闭 saver：应在应用 startup 时建立连接池、在 shutdown 时关闭，并让所有 `invoke()` 调用发生在该生命周期内。

## 九、常见错误与修正

### 1. 恢复时重新发送用户消息

错误：

```python
agent.invoke(
    {"messages": [{"role": "user", "content": "批准"}]},
    config=CONFIG,
)
```

这只是增加了一条新消息，不会精确恢复暂停点。应使用：

```python
agent.invoke(
    Command(resume={"decisions": [{"type": "approve"}]}),
    config=CONFIG,
)
```

### 2. 恢复时生成新的 `thread_id`

```python
# 错误：这是一个新线程
new_config = {"configurable": {"thread_id": "another-id"}}
```

首次调用到任务结束都要复用原 ID。新任务才生成新 ID。

### 3. 只在 Prompt 里要求“先确认”

Prompt 是行为引导，不是强制控制。模型可能误解、遗忘或被提示注入影响。真正的副作用工具必须由运行时中断、权限校验和工具自身的安全边界共同保护。

### 4. `edit` 后不再验证

审批人也可能输错路径或收件人。参数编辑后仍要执行：

- 工具 schema 校验；
- 路径规范化与根目录约束；
- 收件人白名单；
- 数据分级与脱敏；
- 操作者权限判断。

### 5. 把所有工具都设为强制审批

这会造成审批疲劳。更好的分级是：

| 风险等级 | 示例 | 策略 |
| --- | --- | --- |
| 只读、低风险 | 列目录、读取公开配置 | 直接执行并记录 |
| 可恢复写入 | 修改草稿、生成临时文件 | 条件式中断或事后审计 |
| 高风险写入 | 修改生产配置、覆盖关键文件 | `approve/edit/reject` |
| 不可逆或对外动作 | 删除、付款、外发消息 | 强制审批，通常限制 `edit` |

### 6. 忽略并发和重复点击

两个审批人可能同时点击，浏览器也可能重试请求。审批接口要用状态机、乐观锁或行锁保证一次中断只恢复一次，并为外发工具设置幂等键。

## 十、上线前检查清单

- 所有产生外部副作用的工具都已盘点；
- `interrupt_on` 使用真实工具名，规则已覆盖 subagent；
- 高风险工具的 `allowed_decisions` 符合业务要求；
- 参数相关风险使用条件式中断，而不是只靠 Prompt；
- 人工 `edit` 后会重新执行 schema、权限和安全校验；
- `reject` 被当作正常分支，模型不会尝试绕过；
- 中断前没有文件写入、删除、发送等副作用；
- 使用持久化 checkpointer，并对数据加密和设置保留周期；
- 首次调用与所有恢复调用使用同一 `thread_id`；
- 审批服务保存操作者、决定、原参数、编辑后参数和时间；
- 恢复接口具备鉴权、租户隔离、并发控制与幂等机制；
- 审批 UI 展示完整参数，而不是只展示工具名称；
- 对异常退出、进程重启、超时、重复恢复做过演练。

## 总结

可控智能体的关键不是让模型“礼貌地询问”，而是让运行时在副作用发生前强制暂停，并能在可靠的检查点上恢复。

`interrupt_on` 适合工具级的标准审批；工具内 `interrupt()` 适合依赖参数和权限的条件式中断。人工通过 `approve`、`edit` 或 `reject` 做决定，再由应用以 `Command(resume=...)` respond 给暂停图。整个恢复链依赖持久化 checkpointer 和不变的 `thread_id`，subagent 的中断也沿同一条链路向上传递和恢复。

只有把运行时中断、服务端授权、参数校验、持久化与审计组合起来，智能体才从“会调用工具的模型”变成真正可上线、可追责、可拒绝的执行系统。
