---
layout: doc
title: "Memory 与知识库构建：用户记忆、组织记忆、只读知识库与 Context Hub"
category: DeepAgents
date: '2026-07-16'
tags:
  - Memory
  - Context Hub
  - 企业知识库
---

# Memory 与知识库构建：用户记忆、组织记忆、只读知识库与 Context Hub

一个企业 Agent 如果只能看见当前对话，就会反复询问用户偏好；如果什么都允许它“记住”，又会很快遇到串租户、错误知识污染、隐私泄露和无法审计的问题。

正确的设计不是把所有内容都塞进一个向量库，而是先回答两个问题：**这条信息属于谁**，以及**Agent 能否修改它**。DeepAgents 提供的文件式上下文、`StoreBackend`、Skills 和 MCP，正好可以组合成一套分层方案：短期工作文件放在线程状态中，长期记忆写入 Store，正式知识以只读快照或 MCP Resource 提供，Context Hub 则负责把经过治理的上下文包分发给各个 Agent。

## 一、先把四种“记忆”分开

| 层级 | 典型内容 | 生命周期 | 推荐命名空间 | 默认权限 |
| --- | --- | --- | --- | --- |
| thread-scoped | 当前任务计划、临时摘要、下载文件 | 单次线程 | checkpoint / state | 可读写，任务结束可清理 |
| agent-scoped | 某个 Agent 的运行经验、失败模式、专用术语 | 跨线程 | `agents/{agent_id}` | 该 Agent 可写，其他 Agent 不可见 |
| user-scoped | 语言、时区、输出偏好、已确认的长期事实 | 跨 Agent、跨线程 | `users/{tenant_id}/{user_id}` | 用户本人相关 Agent 可写 |
| organization-level | 组织术语、已验证案例、团队经验 | 跨用户、跨 Agent | `orgs/{tenant_id}` | 通常提议写、审核后发布 |

此外还有一种经常被误称为 memory 的内容：公司制度、产品手册、API 文档和合规条款。它们是**知识库（knowledge base）**，具有来源、版本、负责人和生效日期，运行中的 Agent 原则上只能读取，不能把对话中的结论直接覆盖到正式文档里。

可以用一句话判断归属：

- “只对这次任务有用”——线程状态；
- “这个 Agent 下次也应该知道”——agent-scoped memory；
- “关于这个用户，下次仍成立”——user-scoped memory；
- “全组织都应该复用，但需要治理”——organization-level memory；
- “这是正式事实，必须能追溯来源”——只读知识库。

### Agent-scoped 不等于 user-scoped

假设一个用户同时使用“销售助理”和“报销助理”。“销售助理在生成周报时应先按区域汇总”是 Agent 的工作经验；“用户喜欢中文表格，并使用 Asia/Shanghai 时区”是用户偏好。把两者都存到 `user_id` 下，会让报销助理读到无关策略；都存到 `agent_id` 下，则用户换一个 Agent 后又要重新设置偏好。

组织级记忆也不能简单理解为“更大的用户记忆”。组织记忆的读者更多，错误影响面更大，通常需要审核、去重、版本化和回滚。因此生产系统很少让在线 Agent 直接写入已发布组织记忆，而是先写入候选区。

## 二、可写 Memory 与只读知识库的边界

把内容分为四个写入等级，比单纯设置一个 `read_only` 开关更实用：

1. **自由写入**：线程草稿、临时文件，失败影响有限。
2. **受控写入**：用户偏好和 Agent 经验；写入前校验结构、敏感字段和置信度。
3. **提议写入**：组织经验；Agent 只能生成 proposal，由后台任务或人工审核发布。
4. **只读**：制度、合同模板、产品文档、合规知识；在线 Agent 只有 search/read 能力。

下面这些内容不应被自动写入长期记忆：密码、令牌、完整银行卡号等秘密；未经用户确认的身份推断；一次性任务参数；来源不明的外部文本；与当前租户无关的数据。长期记忆还应提供查看、更正、删除和过期机制。

只读边界必须在工具和存储层落实，不能只在 system prompt 中写一句“不要修改知识库”。可靠做法是根本不向 Agent 暴露知识库的写工具，并让知识快照使用只读凭据或只读挂载。Prompt 是行为建议，权限才是安全边界。

## 三、StoreBackend：把“文件”持久化，但不要混淆作用域

DeepAgents 的文件工具让 Agent 可以用路径组织上下文。默认的 `StateBackend` 适合线程内文件；`StoreBackend` 则把文件内容放入 LangGraph Store，使其跨线程保存。常见组合是让工作区保持临时，只把一个明确的路径路由到持久化 Store：

```python
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend


def make_backend(runtime):
    return CompositeBackend(
        default=StateBackend(runtime),
        routes={
            # 只有这个目录跨线程持久化；其他文件仍属于当前线程。
            "/memory-files/": StoreBackend(runtime),
        },
    )
```

这种路由解决的是“哪些文件持久化”，并不自动解决租户隔离。用户、Agent 和组织作用域仍应成为 Store namespace 的一部分，而且 `tenant_id` 必须由认证上下文注入，绝不能接受模型或用户在自然语言中指定。

对于结构化记忆，直接使用 Store 的 namespace/key/value 模型通常更清晰；对于长摘要、偏好说明和可由 Agent 自主管理的 Markdown 文件，`StoreBackend` 的文件接口更自然。二者可以共用同一个 Store。

## 四、完整示例：三种 Memory + 只读知识网关

下面的示例展示核心边界。它使用 `InMemoryStore` 方便本地运行；生产环境应换成持久化、支持加密与访问控制的 Store 实现。代码中的知识库只暴露 `search_kb`，没有任何写入口；组织记忆只能提交候选项。

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal
from uuid import uuid4

from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from langchain.tools import ToolRuntime, tool
from langgraph.store.memory import InMemoryStore


@dataclass
class AppContext:
    # 三个字段都应由已认证的服务端会话填充，而不是由模型生成。
    tenant_id: str
    user_id: str
    agent_id: str


store = InMemoryStore()


def ns(runtime: ToolRuntime[AppContext], scope: str) -> tuple[str, ...]:
    ctx = runtime.context
    if scope == "agent":
        return ("tenants", ctx.tenant_id, "agents", ctx.agent_id, "memories")
    if scope == "user":
        return ("tenants", ctx.tenant_id, "users", ctx.user_id, "memories")
    if scope == "org_proposals":
        return ("tenants", ctx.tenant_id, "org-memory-proposals")
    raise ValueError(f"unsupported scope: {scope}")


@tool
def remember(
    scope: Literal["agent", "user"],
    key: str,
    value: str,
    runtime: ToolRuntime[AppContext],
) -> str:
    """保存已确认的 Agent 经验或用户偏好；不要保存秘密和一次性参数。"""
    if len(key) > 80 or len(value) > 2000:
        return "拒绝写入：key 或 value 超过长度限制"
    runtime.store.put(
        ns(runtime, scope),
        key,
        {
            "value": value,
            "scope": scope,
            "status": "active",
            "source": "confirmed-conversation",
        },
    )
    return f"已保存 {scope} memory: {key}"


@tool
def recall(
    scope: Literal["agent", "user"],
    query: str,
    runtime: ToolRuntime[AppContext],
) -> str:
    """在当前租户内检索 Agent 或用户长期记忆。"""
    # 本地示例没有配置 embedding，因此先列出再做关键词过滤。
    # 生产环境可给 Store 配置索引，并改成 search(..., query=query)。
    candidates = runtime.store.search(ns(runtime, scope), limit=100)
    query_lower = query.lower()
    items = [
        item for item in candidates
        if query_lower in item.key.lower()
        or query_lower in item.value["value"].lower()
    ][:8]
    if not items:
        return "没有匹配的长期记忆"
    return "\n".join(f"- {item.key}: {item.value['value']}" for item in items)


@tool
def propose_org_memory(
    statement: str,
    evidence_uri: str,
    runtime: ToolRuntime[AppContext],
) -> str:
    """提交组织记忆候选项；此工具不会修改已发布组织记忆。"""
    proposal_id = str(uuid4())
    runtime.store.put(
        ns(runtime, "org_proposals"),
        proposal_id,
        {
            "statement": statement,
            "evidence_uri": evidence_uri,
            "proposed_by": runtime.context.user_id,
            "status": "pending",
        },
    )
    return f"候选项 {proposal_id} 已进入审核队列"


# 为了让示例可以独立运行，这里使用一个只读快照。
# 生产环境可在这个函数内部查询向量/关键词索引，或读取 MCP Resource。
KB_SNAPSHOT = (
    {"id": "leave-policy@2026-07", "text": "年假申请至少提前两个工作日提交。"},
    {"id": "expense-policy@2026-06", "text": "单笔差旅住宿超过标准时需要直属经理审批。"},
)


@tool
def search_kb(query: str) -> str:
    """搜索已发布的只读企业知识；返回稳定文档 ID 以便引用。"""
    # 演示使用固定领域词；生产环境在此接入全文/向量索引或 MCP Resource。
    terms = ("年假", "申请", "差旅", "住宿", "标准", "审批")
    hits = [
        doc for doc in KB_SNAPSHOT
        if any(term in query and term in doc["text"] for term in terms)
    ]
    if not hits:
        return "未找到；不要根据 memory 猜测正式制度"
    return "\n".join(f"[{doc['id']}] {doc['text']}" for doc in hits)


def make_backend(runtime):
    return CompositeBackend(
        default=StateBackend(runtime),
        routes={"/memory-files/": StoreBackend(runtime)},
    )


agent = create_deep_agent(
    model="openai:gpt-5.2",
    context_schema=AppContext,
    store=store,
    backend=make_backend,
    tools=[remember, recall, propose_org_memory, search_kb],
    # 共享 Skill 只描述流程；它不因此获得知识库写权限。
    skills=["./skills/company-assistant/"],
    system_prompt="""
你是企业助理。正式制度必须先调用 search_kb，并在答案中引用文档 ID。
memory 只能用于个性化和补充背景，不能覆盖正式知识。
组织级结论只能调用 propose_org_memory 提议，不能宣称已经发布。
只有用户明确确认长期有效的信息才能调用 remember。
""",
)


result = agent.invoke(
    {"messages": [{"role": "user", "content": "记住我喜欢中文表格，然后查询年假申请要求"}]},
    context=AppContext(
        tenant_id="acme",
        user_id="u-1042",
        agent_id="enterprise-assistant",
    ),
)
print(result["messages"][-1].content)
```

示例中有三个刻意的设计：

- `tenant_id` 永远位于 namespace 前部，避免两个组织出现相同 `user_id` 时串数据；
- 已发布组织知识没有写工具，Agent 只能写 `org-memory-proposals`；
- `search_kb` 返回带版本的稳定 ID，最终答案可以追溯，而 memory 不能冒充政策来源。

不同 DeepAgents/LangChain 版本的模型名、`skills` 参数和工具运行时注入签名可能略有差异，升级时应以所安装版本的 API 为准；作用域、权限与 namespace 的设计不应因此改变。

## 五、Background consolidation：不要在每轮对话里整理全部记忆

在线写入路径应尽量短：校验、写入候选记录、返回结果。去重、合并、过期和提升为组织记忆则交给后台归并任务（background consolidation）。一个常见流水线是：

```text
对话事件
  └─> 候选记忆（append-only，带来源与作用域）
        └─> 后台归并器
              ├─ 去除秘密、越权内容和低置信度推断
              ├─ 合并同义项，处理新旧事实冲突
              ├─ 生成短摘要，同时保留原始证据指针
              ├─ 写回 user/agent memory
              └─ 组织级候选进入人工或规则审核
```

后台归并器必须遵守几个原则：

1. **同作用域归并**：不能因为语义相似就把 A 用户的内容合并到 B 用户。
2. **新事实不是无条件覆盖**：用户说“以后都用英文”可以使旧偏好失效；外部网页说“用户喜欢英文”则没有同等权重。
3. **保留 provenance**：摘要应保存来源事件 ID、时间、归并器版本和置信度。
4. **幂等**：同一批事件重复消费不会生成多份记忆。
5. **可撤销**：删除原始用户数据时，能够定位并重建受影响摘要。

一个可审计的记录至少应包含：

```json
{
  "memory_id": "mem_01",
  "scope": "user",
  "subject": "acme/u-1042",
  "fact": "偏好中文表格",
  "status": "active",
  "confidence": 1.0,
  "source_event_ids": ["evt_918"],
  "created_at": "2026-07-16T08:30:00Z",
  "expires_at": null,
  "consolidator_version": "memory-policy-v3"
}
```

对于“忘记我”的请求，不要只删除向量索引中的一条记录。应删除或墓碑化源事件与派生记忆，清理缓存，并触发受影响摘要重建。

## 六、Context Hub、共享 Skills 与 MCP Resources 各管什么

这四类组件的职责不要重叠：

| 组件 | 最适合承载 | 是否在线变化 | Agent 权限 |
| --- | --- | --- | --- |
| StoreBackend / Store | 用户偏好、Agent 经验、记忆候选 | 是 | 按 namespace 受控读写 |
| Context Hub | 版本化的上下文包、规范、Skill 和知识快照 | 经发布流程变化 | 运行时读取固定版本 |
| 共享 Skills | “如何完成任务”的步骤、模板、脚本 | 随版本发布 | 通常只读执行 |
| MCP Resources | 外部系统中“现在是什么”的权威内容 | 可实时变化 | 资源读取；写操作需独立 Tool 与授权 |

### Context Hub：分发层，而不是另一份聊天记忆

Context Hub 适合把经过评审的上下文资产打包、版本化和分发，例如 `company-glossary@3.4.1`、`support-playbook@2026-07`。构建或发布流水线将固定版本同步到部署产物，运行时只读加载：

```text
# 示意：具体命令取决于所采用的 Context Hub 客户端
context-hub pull company/support-playbook@2026-07 --output ./context/support
context-hub pull company/company-glossary@3.4.1 --output ./context/glossary
```

不要让在线 Agent 自动追随 `latest`。固定版本才能复现一次回答，也便于灰度与回滚。同步时校验包签名或摘要，并在元数据中记录 `package_id`、版本、来源和发布时间。

### 共享 Skills：流程复用，不是事实仓库

一个 Skill 可以规定“回答制度问题时先搜索知识库、至少给出一个文档 ID、冲突时以生效日期较新的正式来源为准”，也可以附带报告模板和确定性脚本。它不适合塞入数千页频繁变化的政策正文。Skill 解决“怎么做”，知识库解决“事实是什么”。

共享 Skill 的建议目录如下：

```text
skills/company-assistant/
├── SKILL.md                 # 路由规则与工作流
├── templates/
│   └── answer-with-citations.md
└── scripts/
    └── validate-citations.py
```

### MCP Resources：连接权威实时源

当知识仍由 SharePoint、Confluence、Git 仓库或内部目录服务管理时，不必每天把所有内容复制进 memory。可以通过 MCP Server 暴露只读 Resource，例如：

```text
policy://hr/leave/2026-07
catalog://products/payments/current
runbook://sre/order-service
```

Agent 侧通常把“列出资源、读取资源、搜索资源”封装成只读工具。MCP Resource 表示数据；MCP Tool 表示动作。若服务器还提供 `update_policy` 一类写 Tool，应使用另一套凭据和人工审批，不能因为 Agent 能读 Resource 就顺带授权写入。

完整的企业组合可以这样理解：

```text
                         ┌─ StoreBackend ─> agent/user memory（受控可写）
用户请求 ─> Deep Agent ─┼─ Shared Skills ─> 工作流与模板（只读）
                         ├─ Context Hub ───> 固定版本知识快照（只读）
                         └─ MCP Resources ─> 权威实时数据（只读）
                                               │
后台归并器 <─ memory proposals                 └─ 答案引用 resource URI/版本
     └─ 审核通过 ─> organization memory / 下一版 Context Hub 包
```

这里最重要的反馈回路是：在线 Agent 发现缺口后提交 proposal；后台审核通过后，内容进入组织记忆或正式知识源；下一版 Context Hub 包再将它分发出去。在线对话永远不直接篡改已发布知识。

## 七、检索与冲突：Memory 不能压过正式知识

一次请求可以同时检索多层上下文，但合并顺序必须明确：

1. 先用用户和 Agent memory 做个性化、补足术语；
2. 涉及正式事实时查询 Context Hub 快照或 MCP Resource；
3. 对来源做权限过滤，再排序和截断；
4. 正式知识发生冲突时比较来源等级、生效日期和版本；
5. memory 与正式知识冲突时，以正式知识为准，并提示用户更新记忆。

不要把所有层的文本混合后只做一次相似度排序。否则一条高度相似但过时的用户记忆，可能排在最新制度之前。检索结果应携带 `scope`、`source_uri`、`version`、`effective_at`、`acl` 和 `content_hash`，由应用层执行硬过滤和优先级规则。

## 八、生产检查清单

上线前至少验证以下项目：

- namespace 是否始终包含服务端注入的 `tenant_id`，并覆盖跨租户测试；
- user、agent、organization 三种 scope 是否有不同的读写策略；
- 正式知识库是否真的没有在线写凭据，而不只是 Prompt 禁止；
- 记忆写入是否经过结构校验、秘密扫描、长度限制和来源记录；
- 后台归并是否幂等、可回滚、可处理删除请求；
- Context Hub 包是否固定版本、校验完整性并支持回滚；
- Skill 是否只包含工作流和必要模板，没有复制大量易过时正文；
- MCP Resource 是否执行调用者权限过滤，返回可引用的 URI 和版本；
- 最终回答是否区分“正式知识”“用户偏好”和“模型推断”；
- 是否有命中率、错误记忆率、陈旧率、越权拒绝和删除完成时间等指标。

## 总结

Memory 的核心不是“记得越多越好”，而是让信息在正确的作用域中，以正确的权限和生命周期存在。`StoreBackend` 适合持久化 Agent 可管理的上下文文件，结构化 Store 适合明确作用域的长期记忆；Context Hub 和共享 Skills 负责版本化分发知识与流程；MCP Resources 负责连接仍在权威系统中的实时信息。再用 background consolidation 把在线候选记忆整理、审核和提升，就能形成既有个性化、又可治理和可追溯的企业知识体系。
