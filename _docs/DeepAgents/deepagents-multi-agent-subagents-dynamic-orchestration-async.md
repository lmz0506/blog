---
layout: doc
title: "多智能体协作：Subagents、Dynamic Orchestration 与 Async Subagents"
category: DeepAgents
date: '2026-07-17'
tags:
  - DeepAgents
  - Multi-Agent
  - Subagents
  - Async
---

# 多智能体协作：Subagents、Dynamic Orchestration 与 Async Subagents

单个 Agent 可以不断增加工具，但“工具更多”不等于“协作更好”。当研究、数据分析、事实核查和写作都塞进同一条上下文时，模型不仅要完成任务，还要不断判断哪些信息属于谁、哪些中间结果值得保留。更可靠的做法是让一个**主管理者（supervisor）**负责拆解、派工与验收，让多个**专家代理（subagent）**在隔离的上下文中完成窄任务。

本文用“生成一份 AI 行业周报”贯穿全程：主管理者协调研究员、数据分析师、事实核查员和编辑。我们会依次实现默认 subagent、自定义 `SubAgent`、可复用的 `CompiledSubAgent`、动态编排，以及具有 `start`、`check`、`update`、`cancel`、`list` 五个控制工具的异步 subagent。

> 本文以 Python 版 DeepAgents 为例。DeepAgents 仍在快速演进，尤其是异步后台代理的内置接口可能随版本变化。前半部分使用 `deepagents` 的公开配置方式；异步部分给出一层完整、可移植的五工具实现，因此不依赖某个实验性接口名称。

## 1. 为什么需要“主管理者 + 专家代理”

先明确各角色的边界：

| 角色 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| 主管理者 | 拆解目标、选择专家、合并结果、处理失败 | 亲自完成所有搜索和分析 |
| 研究员 | 搜集候选事实并保留来源 | 决定最终文章结构 |
| 数据分析师 | 计算指标、解释数据限制 | 编造缺失数据 |
| 核查员 | 交叉验证断言、标注证据强度 | 为不确定结论背书 |
| 编辑 | 组织语言和结构 | 悄悄改变事实或数字 |

Subagent 的关键价值是**上下文隔离**。主管理者只接收专家的交付物，不必继承专家的全部思考轨迹、工具回显和临时文件。对于长流程，这通常比一味扩大上下文窗口更有效。

## 2. 最小示例：先认识默认 subagent

安装依赖，并通过环境变量提供对应模型的密钥：

```bash
pip install -U deepagents langchain
```

`create_deep_agent` 会组装规划、文件系统和 subagent 等能力。即使没有注册领域专家，主管理者也可以把适合隔离处理的工作交给默认的通用 subagent。调用方只和最外层 agent 对话：

```python
from deepagents import create_deep_agent


supervisor = create_deep_agent(
    model="openai:gpt-4.1",
    system_prompt="""
你是 AI 行业周报的主管理者。
先拆分任务，再把可独立完成的工作委派给 subagent；
只合并有证据的结论，最终输出 Markdown 周报。
""",
)

result = supervisor.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "整理本周三个重要 AI 事件，并说明各自影响。",
            }
        ]
    }
)

print(result["messages"][-1].content)
```

默认通用代理适合边界尚不清楚的任务，但它拥有的是“通用能力”，不是业务知识。任务稳定后，应把职责、工具和输出契约写进自定义 subagent。

## 3. 自定义 SubAgent：给专家明确边界

自定义 subagent 至少需要三个信息：

- `name`：稳定、简短的机器可读名称；
- `description`：写给主管理者看的路由说明，决定“何时调用它”；
- `system_prompt`：写给专家本人的工作规程，决定“调用后怎么做”。

下面注册三个专家。为了让代码可以直接运行，示例工具使用本地演示数据；在生产环境中可替换为搜索 API、数据库或 MCP 工具。

```python
from typing import Any

from deepagents import SubAgent, create_deep_agent
from langchain_core.tools import tool


DEMO_EVENTS = {
    "agent": [
        {
            "title": "Agent 平台发布异步任务能力",
            "source": "https://example.com/agent-platform",
            "summary": "长任务可在后台执行，并由主管理者查询状态。",
        }
    ],
    "model": [
        {
            "title": "新模型强调工具调用可靠性",
            "source": "https://example.com/model-release",
            "summary": "复杂工具链的成功率得到改善。",
        }
    ],
}


@tool
def search_news(topic: str) -> list[dict[str, str]]:
    """搜索演示新闻；生产环境应替换为真实搜索服务。"""
    return DEMO_EVENTS.get(topic.lower(), [])


@tool
def calculate_change(current: float, previous: float) -> dict[str, Any]:
    """计算数值及百分比变化。"""
    if previous == 0:
        return {"absolute": current, "percent": None, "note": "基期为 0"}
    return {
        "absolute": round(current - previous, 4),
        "percent": round((current - previous) / previous * 100, 2),
    }


researcher: SubAgent = {
    "name": "researcher",
    "description": "检索 AI 新闻并返回标题、摘要和来源；需要搜集事实时使用。",
    "system_prompt": """
你是研究员。每条结论必须附来源 URL；区分来源原文和你的推断。
如果没有结果，明确返回“未找到”，不得补写看似合理的新闻。
""",
    "tools": [search_news],
}

analyst: SubAgent = {
    "name": "data-analyst",
    "description": "计算变化率并解释指标；出现数字比较时使用。",
    "system_prompt": """
你是数据分析师。必须调用计算工具，不要心算；
返回输入、公式、结果和数据限制，不得把相关性写成因果关系。
""",
    "tools": [calculate_change],
}

fact_checker: SubAgent = {
    "name": "fact-checker",
    "description": "审核已有草稿中的事实、数字和来源，不承担初次写作。",
    "system_prompt": """
你是事实核查员。逐条输出 PASS、WARN 或 FAIL，并解释依据。
没有一手来源的关键断言不能标记为 PASS。
""",
    "tools": [search_news],
}

supervisor = create_deep_agent(
    model="openai:gpt-4.1",
    system_prompt="""
你是周报主管理者。先列出交付标准，再按需委派研究、分析和核查。
不要自己伪装成专家；专家结果冲突时，优先补充核查并保留不确定性。
最终输出：摘要、事件、数据解读、风险提示、来源。
""",
    subagents=[researcher, analyst, fact_checker],
)

response = supervisor.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "以 agent 和 model 为关键词制作演示周报；"
                    "并计算某指标从 125 增长到 160 的变化率，最后核查关键事实。"
                ),
            }
        ]
    }
)

print(response["messages"][-1].content)
```

主管理者会根据 `description` 做路由，因此不要只写“很擅长研究”。更有效的描述是“输入是什么、输出是什么、什么时候调用、什么时候不要调用”。`system_prompt` 则应规定证据、格式、失败语义等执行约束。

## 4. CompiledSubAgent：复用一张已经编译的图

字典式 `SubAgent` 适合轻量专家。若专家本身已有检查点、自定义状态、中间件或复杂图结构，就不应再把它压回一段 prompt。此时可以把一个已经编译的 LangGraph runnable 包装成 `CompiledSubAgent`。

```python
from deepagents import CompiledSubAgent, create_deep_agent
from langchain.agents import create_agent
from langchain_core.tools import tool


@tool
def style_rules(section: str) -> str:
    """返回指定栏目采用的编辑规则。"""
    rules = {
        "summary": "不超过 120 字，先结论后背景。",
        "event": "标题、事实、影响三段式；事实必须保留来源。",
        "risk": "明确区分已知事实、推断和未知项。",
    }
    return rules.get(section, "使用简洁、可核查的中文。")


# create_agent 返回可调用的已编译图；也可换成自己用 StateGraph 编译的图。
editor_graph = create_agent(
    model="openai:gpt-4.1-mini",
    tools=[style_rules],
    system_prompt="""
你是终稿编辑。只重组和压缩已有材料，不新增事实；
发现来源缺失时插入 [待核查]，不要自行补齐。
""",
)

editor = CompiledSubAgent(
    name="editor",
    description="把已核查的材料整理成最终 Markdown；只在事实核查后调用。",
    runnable=editor_graph,
)

supervisor = create_deep_agent(
    model="openai:gpt-4.1",
    system_prompt="先研究和核查，最后且仅最后调用 editor 生成终稿。",
    subagents=[editor],
)

result = supervisor.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "把以下已核查材料编辑成周报：事件 A 已确认；影响仍属推断。",
            }
        ]
    }
)
print(result["messages"][-1].content)
```

两种类型的选择原则很简单：

| 需求 | 选择 |
| --- | --- |
| 只需独立 prompt、模型和少量工具 | `SubAgent` |
| 已有完整 Agent/StateGraph，需要整体复用 | `CompiledSubAgent` |
| 希望主管理者的工具自动下放给通用代理 | 默认 subagent |

`CompiledSubAgent` 的 `runnable` 应遵循消息状态的输入输出约定。若自定义图使用完全不同的 state，最好在图外加一层适配，将主管理者发来的任务转换成专家 state，再把结果压缩为一条可读消息。

## 5. Dynamic Orchestration：运行时决定“派谁、派多少、按什么顺序”

动态编排不是让模型随意生成角色名称，而是让主管理者根据当前状态，从**受控专家目录**中选择执行路径。一个稳健的流程通常是：

1. 解析任务，形成带依赖关系的工作单；
2. 对互不依赖的工作并发派发；
3. 汇总结果并检查交付契约；
4. 缺证据时追加核查，而不是直接进入写作；
5. 达到停止条件后交给编辑。

可以把路由规则明确写进主管理者 prompt，而不是期待模型自行领会：

```python
from deepagents import create_deep_agent

# researcher、analyst、fact_checker、editor 来自前面的定义。
supervisor = create_deep_agent(
    model="openai:gpt-4.1",
    subagents=[researcher, analyst, fact_checker, editor],
    system_prompt="""
你是主管理者，请按以下状态机编排：

1. DISCOVER：凡是外部事实，交给 researcher；多个主题可独立委派。
2. ANALYZE：凡是数值比较，交给 data-analyst，并传入原始数值。
3. VERIFY：整理“断言—来源—证据”清单，交给 fact-checker。
4. REPAIR：存在 FAIL 时回到 DISCOVER；存在 WARN 时在终稿保留限定语。
5. PUBLISH：只有关键断言均无 FAIL，才把材料交给 editor。

每次委派只给最小必要上下文。最多执行两轮 REPAIR；两轮后仍失败，
停止扩张任务并向用户报告缺口。不得调用未注册的角色。
""",
)
```

这里的“动态”体现在运行时路线会变化：纯文字任务可能跳过分析师；证据充分时只核查一次；核查失败时会回到研究阶段。专家集合仍由应用控制，这让权限、成本和行为更容易审计。

### 5.1 动态生成专家时要守住边界

有些系统允许根据租户、语言或数据源，在每次请求前构造不同的 `subagents` 列表。例如企业版用户可获得内部知识库专家，普通用户只能使用公开搜索专家。推荐由应用代码构建白名单，而不是让模型提交任意 prompt 和任意工具：

```python
from deepagents import SubAgent, create_deep_agent


def build_supervisor(*, can_read_internal: bool, language: str):
    agents: list[SubAgent | CompiledSubAgent] = [
        researcher,
        analyst,
        fact_checker,
        editor,
    ]

    if can_read_internal:
        internal_expert: SubAgent = {
            "name": "internal-knowledge-expert",
            "description": "查询已授权的内部材料；仅处理内部事实问题。",
            "system_prompt": "只返回当前调用者有权访问的内容，并保留文档标识。",
            "tools": [],  # 在真实应用中放入经过权限过滤的检索工具
        }
        agents.append(internal_expert)

    return create_deep_agent(
        model="openai:gpt-4.1",
        subagents=agents,
        system_prompt=f"用 {language} 输出；只能调用已注册专家。",
    )


supervisor = build_supervisor(can_read_internal=False, language="简体中文")
```

这是一种“请求开始前动态装配”。如果要在一次运行中不断创建和销毁角色，应额外实现预算、并发数、工具白名单和审计日志；否则所谓灵活性很快会变成不可控的权限扩散。

## 6. Async Subagents：让长任务脱离主管理者当前回合

同步委派适合几秒到几十秒的任务：主管理者调用专家并等待结果。深度检索、批量抓取或大型分析可能运行数分钟，此时继续阻塞会占用连接、挤压超时预算，也无法让用户取消或调整任务。

异步 subagent 的生命周期可以抽象为：

```text
queued -> running -> succeeded
                  -> failed
queued/running -> cancelling -> cancelled
```

主管理者通过五个控制工具操作后台任务：

| 工具 | 作用 | 典型返回 |
| --- | --- | --- |
| `start` | 启动后台专家任务 | `task_id`、初始状态 |
| `check` | 查看一个任务的状态和结果 | 状态、进度、结果或错误 |
| `update` | 向运行中的任务补充指令 | 是否已接收更新 |
| `cancel` | 请求取消任务 | 取消是否成功 |
| `list` | 枚举当前会话任务 | 任务摘要列表 |

`start` 返回的是句柄而不是答案。调用之后，主管理者可以继续启动其他独立任务；只有后续步骤真正依赖结果时才 `check`。这正是异步与普通 subagent 的本质区别。

## 7. 完整实现：五个异步工具 + 多个专家

下面的示例用 `asyncio.Task` 实现进程内任务注册表，并把五个操作暴露为 LangChain 工具。它适合本地理解和单进程原型；生产环境应把注册表换成持久化队列和 worker。

```python
import asyncio
import json
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Literal

from deepagents import create_deep_agent
from langchain_core.tools import tool


Status = Literal[
    "queued", "running", "succeeded", "failed", "cancelling", "cancelled"
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Job:
    id: str
    expert: str
    instruction: str
    status: Status = "queued"
    progress: int = 0
    result: str | None = None
    error: str | None = None
    updates: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=utc_now)
    updated_at: str = field(default_factory=utc_now)


class AsyncExpertRegistry:
    """单进程演示注册表；一个应用实例创建一个 registry。"""

    def __init__(self, max_concurrency: int = 3) -> None:
        self.jobs: dict[str, Job] = {}
        self.tasks: dict[str, asyncio.Task[None]] = {}
        self._lock = asyncio.Lock()
        self._semaphore = asyncio.Semaphore(max_concurrency)

    async def start(self, expert: str, instruction: str) -> dict:
        if expert not in {"researcher", "analyst", "fact-checker"}:
            raise ValueError(f"unknown expert: {expert}")

        job = Job(id=uuid.uuid4().hex, expert=expert, instruction=instruction)
        async with self._lock:
            self.jobs[job.id] = job
            self.tasks[job.id] = asyncio.create_task(self._run(job.id))
        return {"task_id": job.id, "status": job.status}

    async def _run(self, task_id: str) -> None:
        job = self.jobs[task_id]
        try:
            async with self._semaphore:
                job.status = "running"
                job.updated_at = utc_now()

                # 模拟分阶段长任务；每一阶段都是取消点。
                for progress in (20, 50, 80):
                    await asyncio.sleep(0.2)
                    job.progress = progress
                    job.updated_at = utc_now()

                # 演示如何吸收 update；真实 worker 可将更新写入下一次模型调用。
                update_text = "；补充要求：" + "；".join(job.updates) if job.updates else ""
                await asyncio.sleep(0.2)
                job.result = (
                    f"{job.expert} 已完成：{job.instruction}{update_text}。"
                    "这是演示结果；生产环境应在此调用真正的专家 agent。"
                )
                job.progress = 100
                job.status = "succeeded"
                job.updated_at = utc_now()
        except asyncio.CancelledError:
            job.status = "cancelled"
            job.updated_at = utc_now()
            raise
        except Exception as exc:
            job.status = "failed"
            job.error = f"{type(exc).__name__}: {exc}"
            job.updated_at = utc_now()

    async def check(self, task_id: str) -> dict:
        job = self._get(task_id)
        return asdict(job)

    async def update(self, task_id: str, instruction: str) -> dict:
        job = self._get(task_id)
        if job.status not in {"queued", "running"}:
            return {"task_id": task_id, "accepted": False, "status": job.status}
        job.updates.append(instruction)
        job.updated_at = utc_now()
        return {"task_id": task_id, "accepted": True, "status": job.status}

    async def cancel(self, task_id: str) -> dict:
        job = self._get(task_id)
        task = self.tasks.get(task_id)
        if job.status not in {"queued", "running"} or task is None:
            return {"task_id": task_id, "cancelled": False, "status": job.status}

        job.status = "cancelling"
        job.updated_at = utc_now()
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        return {"task_id": task_id, "cancelled": True, "status": job.status}

    async def list(self, status: Status | None = None) -> list[dict]:
        jobs = self.jobs.values()
        if status is not None:
            jobs = (job for job in jobs if job.status == status)
        return [
            {
                "task_id": job.id,
                "expert": job.expert,
                "status": job.status,
                "progress": job.progress,
                "updated_at": job.updated_at,
            }
            for job in jobs
        ]

    def _get(self, task_id: str) -> Job:
        try:
            return self.jobs[task_id]
        except KeyError as exc:
            raise ValueError(f"unknown task_id: {task_id}") from exc


registry = AsyncExpertRegistry(max_concurrency=3)


@tool("start")
async def start_tool(
    expert: Literal["researcher", "analyst", "fact-checker"],
    instruction: str,
) -> str:
    """启动后台专家任务。返回 task_id；不要把它当作任务结果。"""
    return json.dumps(await registry.start(expert, instruction), ensure_ascii=False)


@tool("check")
async def check_tool(task_id: str) -> str:
    """查询一个后台任务的状态、进度；成功时同时返回结果。"""
    return json.dumps(await registry.check(task_id), ensure_ascii=False)


@tool("update")
async def update_tool(task_id: str, instruction: str) -> str:
    """向 queued/running 任务补充要求；已结束的任务不会被修改。"""
    return json.dumps(
        await registry.update(task_id, instruction), ensure_ascii=False
    )


@tool("cancel")
async def cancel_tool(task_id: str) -> str:
    """请求取消 queued/running 任务。重复取消是安全的。"""
    return json.dumps(await registry.cancel(task_id), ensure_ascii=False)


@tool("list")
async def list_tool(status: str = "") -> str:
    """列出后台任务；status 为空表示全部。"""
    normalized = status or None
    return json.dumps(
        await registry.list(normalized),  # type: ignore[arg-type]
        ensure_ascii=False,
    )


async_supervisor = create_deep_agent(
    model="openai:gpt-4.1",
    tools=[start_tool, check_tool, update_tool, cancel_tool, list_tool],
    system_prompt="""
你是异步周报主管理者。

- 研究、分析、核查超过一个步骤时，用 start 启动后台专家。
- 独立任务可连续 start；保存每个 task_id 及其用途。
- start 只表示已受理，绝不把 task_id 当结果。
- 需要依赖结果时才 check；不要无间隔地高频轮询。
- 用户补充要求时，对仍在运行的对应任务调用 update。
- 任务失去价值、超时或用户撤回时调用 cancel。
- 不确定有哪些任务时调用 list。
- 只有 status=succeeded 才读取 result；failed/cancelled 不得编造结果。
""",
)


async def main() -> None:
    response = await async_supervisor.ainvoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": (
                        "启动研究员收集 agent 新闻，同时让分析师比较 125 和 160；"
                        "告诉我任务句柄和当前状态，不必等待全部完成。"
                    ),
                }
            ]
        }
    )
    print(response["messages"][-1].content)

    # 演示进程不能在后台任务完成前退出。
    await asyncio.sleep(1.0)
    print(json.dumps(await registry.list(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
```

这个实现刻意把生命周期放在注册表中，而不是依赖主管理者“记住”状态。LLM 可能忘记一个任务句柄，但 `list` 仍能从系统事实中恢复；LLM 可能重复取消，而 `cancel` 会返回可解释的幂等结果。

### 7.1 把演示 worker 换成真正的 DeepAgents 专家

上例 `_run` 中的模拟逻辑可以替换为专家 agent 的异步调用。核心变化如下：

```python
# 应用启动时创建，避免每个任务重复编译。
research_agent = create_deep_agent(
    model="openai:gpt-4.1-mini",
    tools=[search_news],
    system_prompt="你是研究员；每条结论必须附来源。",
)

expert_agents = {"researcher": research_agent}


async def invoke_real_expert(job: Job) -> str:
    agent = expert_agents[job.expert]
    extra = "\n补充要求：" + "；".join(job.updates) if job.updates else ""
    result = await agent.ainvoke(
        {
            "messages": [
                {"role": "user", "content": job.instruction + extra}
            ]
        }
    )
    return result["messages"][-1].content
```

在 `_run` 中把演示结果赋值替换为 `job.result = await invoke_real_expert(job)` 即可。真实系统还要让专家定期读取更新或采用可恢复的短阶段执行；一次不可中断的超长模型请求无法即时吸收 `update`。

## 8. 五个工具应该怎样配合

### `start`：先验证，再入队

应校验专家名称、调用者权限、输入长度、预算与幂等键。若客户端因超时重试，同一幂等键应返回原 `task_id`，避免同一深度研究被启动两次。

### `check`：查询事实，而不是推动任务

`check` 最好是纯查询。不要让一次状态查询隐式重启失败任务，也不要每次都返回完整日志。推荐返回进度摘要，成功后再返回结构化结果或结果存储位置。

### `update`：补充指令，不篡改历史

更新应追加为事件，并记录发送者和时间。专家只在安全点消费更新；如果新要求彻底改变目标，通常取消旧任务并新建任务比“热修改”更清晰。

### `cancel`：取消是一种协作协议

取消通常是 cooperative cancellation：控制层发出请求，worker 在网络请求、批次或模型调用之间检查信号并清理资源。状态可以先进入 `cancelling`，最终再变成 `cancelled`。不要在资源尚未释放时谎称取消完成。

### `list`：恢复主管理者的任务视图

`list` 应按会话、用户或租户隔离，并支持状态过滤。它既用于用户询问“还有哪些任务”，也用于主管理者上下文压缩后恢复任务句柄。

## 9. 从单进程原型走向生产

进程内 `asyncio.Task` 有三个明显限制：进程重启即丢失、无法跨机器查询、任务状态只存在内存。生产系统应拆成以下组件：

| 原型组件 | 生产替代 |
| --- | --- |
| `dict` 注册表 | PostgreSQL、Redis 或工作流状态存储 |
| `asyncio.create_task` | Celery、RQ、Temporal、云任务队列或持久化 worker |
| 进程内 `Semaphore` | 租户级并发配额与队列限流 |
| 字符串结果 | 带 schema 版本的结构化结果或对象存储 URI |
| 本地取消 | 持久化取消令牌 + worker 安全点 |

至少记录以下审计字段：`task_id`、父运行 ID、创建者、专家版本、模型、工具权限、输入摘要、状态变更、token/费用、结果位置和错误类型。敏感输入不要原样进入普通日志。

## 10. 常见误区

### 误区一：专家越多越好

专家描述相互重叠时，主管理者会发生路由漂移。优先保证职责互斥，并给出正反调用条件。能用三个稳定专家解决的问题，不要注册二十个近义角色。

### 误区二：把全部上下文复制给每个专家

这会同时增加成本、泄露面和干扰。委派包应只包含任务目标、必要材料、输出格式、截止条件和可用权限。

### 误区三：`start` 后立刻循环 `check`

这只是把同步等待伪装成异步，还会消耗大量模型回合。更好的做法是并行启动独立任务、设置合理的下次查询时间，或由事件/回调唤醒主管理者。

### 误区四：失败后无限自我修复

动态编排必须有停止条件，例如最多两轮补充研究、最大费用、最大墙钟时间。达到边界后应返回“已确认内容 + 未解决缺口”，而不是继续烧预算。

### 误区五：把取消等同于删除

取消是状态变更，不应抹掉审计记录。任务为何取消、执行到哪一步、是否产生外部副作用，都需要保留。

## 11. 一套可落地的验收清单

上线前逐项验证：

- 主管理者能解释每次选择专家的依据；
- 每个专家都有清晰的输入、输出和失败语义；
- `SubAgent` 与 `CompiledSubAgent` 的状态接口匹配；
- 动态专家目录来自应用白名单，并继承调用者权限；
- 并行任务没有隐藏的数据依赖；
- `start` 具备幂等策略，`check` 不产生副作用；
- `update` 可审计，`cancel` 能在安全点生效；
- `list` 只能看到当前作用域的任务；
- `failed`、`cancelled`、超时和部分成功都有用户可读结果；
- 主管理者有轮次、费用、并发和时间上限；
- 最终答案只引用已成功且通过核查的专家结果。

## 12. 总结

DeepAgents 的多智能体协作可以理解为三层递进：

1. **Subagents** 解决职责和上下文隔离：默认代理用于通用委派，`SubAgent` 用于轻量专家，`CompiledSubAgent` 用于复用完整图；
2. **Dynamic Orchestration** 解决运行时路线选择：主管理者根据任务、证据和失败状态决定派谁、是否并行、是否返工；
3. **Async Subagents** 解决长任务生命周期：`start`、`check`、`update`、`cancel`、`list` 把后台执行变成可查询、可调整、可取消的系统事实。

真正可靠的多智能体系统，不是让更多模型同时说话，而是让主管理者掌握清晰的责任边界、依赖关系、生命周期和停止条件。当每个专家只做自己最擅长的事，且每次交接都有契约，复杂任务才会从“看起来智能”变成可运行、可审计、可恢复的工程系统。
