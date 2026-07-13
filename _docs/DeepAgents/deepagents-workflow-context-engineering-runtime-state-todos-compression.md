---
layout: doc
title: 流程与上下文工程：Runtime Context、State Schema、Todo 规划与上下文压缩
category: DeepAgents
date: '2026-07-14'
tags:
  - DeepAgents
  - 上下文工程
  - 状态管理
  - 任务规划
  - 长任务
---

Deep Agent 的难点不只是「会调用工具」，而是让它在几十轮、数百轮交互后仍然知道：当前目标是什么、已经做了什么、下一步该做什么，以及哪些旧信息应该保留、压缩或移出主上下文。这个问题可以概括为流程与上下文工程（workflow and context engineering）。

本文用一个“调研并生成技术简报”的多轮任务说明四个关键部件：运行时上下文（runtime context）、状态模式（state schema）、Todo 规划，以及上下文压缩。示例基于 Python 的 `deepagents` 与 LangChain 生态；不同版本的包在类型名称或配置项上可能略有变化，但设计边界不变。

## 先分清两种上下文：runtime context 与 state

两者经常都被称作“上下文”，但职责完全不同。

| 项目 | Runtime context | State schema |
| --- | --- | --- |
| 生命周期 | 一次调用或一次执行会话 | 图执行过程中持续演化，可被 checkpoint 保存 |
| 适合存放 | 用户身份、租户、权限、追踪 ID、数据库连接等依赖 | 消息、待办事项、中间结论、产物路径、任务进度 |
| 是否进入模型提示词 | 默认不应直接进入；按需由工具或节点读取 | 通常会参与节点输入或由节点显式读取 |
| 安全性 | 用来隔离服务端能力与密钥 | 只能保存允许持久化、允许恢复的数据 |

一句话判断：**“这条数据是否是任务本身的可恢复事实？”** 是，则放 state；如果它只是本次运行的环境、权限或依赖，放 runtime context。

例如，`user_id` 可以在 state 中作为业务输入出现，但数据库客户端、访问令牌、每次请求的 trace ID 不应被序列化进 state，更不应拼进模型 prompt。

## 设计一个能支撑长任务的状态

DeepAgents 默认状态会承载对话和任务相关字段。实际项目中建议从其状态类型扩展，添加领域字段，并保持字段“小、稳定、可审计”。下面的 `ResearchState` 保存的是可恢复的任务事实；`RuntimeContext` 保存的是执行依赖。

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Literal, TypedDict

from deepagents import DeepAgentState, create_deep_agent
from langchain_core.messages import HumanMessage
from langgraph.graph.message import add_messages


class TodoItem(TypedDict):
    id: str
    content: str
    status: Literal["pending", "in_progress", "completed"]


class Finding(TypedDict):
    source: str
    claim: str
    confidence: Literal["high", "medium", "low"]


class ResearchState(DeepAgentState):
    # add_messages 让新消息追加，而不是覆盖历史。
    messages: Annotated[list, add_messages]
    todos: list[TodoItem]
    findings: list[Finding]
    brief_path: str | None
    phase: Literal["plan", "research", "write", "review", "done"]


@dataclass
class RuntimeContext:
    """只在本次 invoke 生命周期内可用的服务端依赖。"""

    tenant_id: str
    user_id: str
    trace_id: str
    search_client: object
    artifact_store: object
```

这里有两个容易被忽略的约束：

1. `findings` 保存“可引用的结论”，不要把原始网页、超长工具输出全塞进去。
2. `todos` 应保存结构化状态，而不是只在自然语言里写“接下来我会……”。结构化待办事项才可以被工具、UI、恢复流程和评估脚本可靠地读取。

## Todo 是一个可更新的执行合同

DeepAgents 提供 `write_todos` 这类 harness tool，用于把计划落到状态中。好的 Todo 不是一个漂亮的项目清单，而是一个持续更新的执行合同：开始前写入、开始时标记 `in_progress`、每完成一项立即标记 `completed`，阻塞时重写余下计划。

给 agent 的系统提示词应明确这一行为。特别是要要求“有实质进展后更新”，避免每次思考都反复改 Todo，也避免任务做完才一次性补写。

```python
SYSTEM_PROMPT = """
你是技术调研与写作 agent。你必须以可验证的步骤推进任务。

规划规则：
- 当任务包含 3 个或以上相互依赖的动作时，先调用 write_todos。
- 每次开始一个待办项前，将它标为 in_progress；完成后立即标为 completed。
- 待办项必须可交付、可验证，使用动词开头；不要把“思考”或“继续处理”作为待办项。
- 发现计划不再适用时，先更新余下待办项，并简短说明原因。

证据规则：
- 搜索结果只是候选证据。将结论写入 findings 前，必须记录来源与置信度。
- 不要把长篇原文复制到对话中；提炼为 1--3 条与任务直接相关的事实。

交付规则：
- 只有所有必要待办项完成后才能声明完成。
- 最终简报写入 artifact store，并把路径写入 brief_path。
"""
```

`write_todos` 本身不是“规划器”。模型仍会判断何时规划、如何拆分，因此 prompt 的规则、示例与验收标准决定了规划质量。一个适合本例的初始计划如下：

```python
[
    {"id": "scope", "content": "明确简报受众、范围和验收标准", "status": "in_progress"},
    {"id": "collect", "content": "检索并记录至少三个可信来源的关键事实", "status": "pending"},
    {"id": "synthesize", "content": "按主题综合证据并标注不确定性", "status": "pending"},
    {"id": "draft", "content": "生成并保存带来源的技术简报", "status": "pending"},
    {"id": "review", "content": "核对待办、引用与交付路径", "status": "pending"},
]
```

## 工具 prompt：把能力、边界和输出形状说清楚

工具描述就是模型的接口文档。名称只说明“能做什么”，而 docstring 还应说明“何时能做、不能做什么、返回多少信息、失败如何处理”。以下工具刻意从 runtime context 取得服务端依赖，避免把客户端或凭据放进 state。

```python
from langchain_core.tools import tool
from langchain.tools import ToolRuntime


@tool
def search_evidence(query: str, runtime: ToolRuntime[RuntimeContext]) -> list[dict]:
    """检索公开技术资料，返回最多 5 条可供核验的候选证据。

    仅在需要外部事实时调用。查询必须包含具体技术对象与限定词。
    每条结果仅返回 title、url、snippet、published_at；不要返回全文。
    结果不是最终结论：调用者仍需比较来源并标记置信度。
    """
    hits = runtime.context.search_client.search(
        query=query,
        tenant_id=runtime.context.tenant_id,
        limit=5,
    )
    return [
        {
            "title": hit.title,
            "url": hit.url,
            "snippet": hit.snippet[:500],
            "published_at": hit.published_at,
        }
        for hit in hits
    ]


@tool
def save_brief(markdown: str, runtime: ToolRuntime[RuntimeContext]) -> str:
    """将最终技术简报保存到当前租户的产物存储并返回路径。

    仅在简报已完成引用核对后调用。内容必须是 Markdown，且不得包含
    访问令牌、内部系统地址或未经脱敏的个人数据。不要用此工具保存草稿。
    """
    return runtime.context.artifact_store.put_markdown(
        tenant_id=runtime.context.tenant_id,
        content=markdown,
    )
```

这类设计带来三层隔离：模型只看见工具契约；工具只读取经运行时注入、且符合当前租户权限的依赖；持久化状态只记录任务结果。即使 state 被 checkpoint、导出或恢复，连接对象与密钥也不会随之泄露。

## 组装 agent，并把运行依赖留在 invoke 边界

创建 agent 时传入状态模式与工具。调用时分别传递初始 state 和 runtime context；不要把 `RuntimeContext` 塞进 `configurable` 后再要求模型从消息里“记住”它。

```python
agent = create_deep_agent(
    model="openai:gpt-4.1",
    tools=[search_evidence, save_brief],
    system_prompt=SYSTEM_PROMPT,
    state_schema=ResearchState,
)


def run_research(request: str, ctx: RuntimeContext):
    initial_state: ResearchState = {
        "messages": [HumanMessage(content=request)],
        "todos": [],
        "findings": [],
        "brief_path": None,
        "phase": "plan",
    }
    return agent.invoke(initial_state, context=ctx)
```

若需要断点恢复，再为 agent 配置 checkpointer，并使用稳定的线程 ID。线程 ID 用于找到同一任务的历史；`tenant_id` 则必须仍由可信的服务端会话注入，不应相信模型或旧状态中的同名字段。

```python
config = {"configurable": {"thread_id": "brief-20260714-001"}}
result = agent.invoke(initial_state, config=config, context=runtime_context)
```

## 多轮任务编排：用阶段门控减少漂移

单个 agent 能完成简单任务；但长任务更稳妥的做法是把“计划、调研、写作、审校”设为明确阶段。下面的 LangGraph 伪完整示例展示了一个外层工作流：每个节点只承担一种转换，所有节点共享 `ResearchState`，运行依赖经 `RuntimeContext` 传入。

```python
from typing import Command

from langgraph.graph import END, START, StateGraph
from langchain_core.messages import AIMessage


def plan_node(state: ResearchState) -> dict:
    if state["todos"]:
        return {"phase": "research"}
    return {
        "phase": "research",
        "todos": [
            {"id": "scope", "content": "明确简报受众、范围和验收标准", "status": "completed"},
            {"id": "collect", "content": "检索并记录至少三个可信来源的关键事实", "status": "in_progress"},
            {"id": "synthesize", "content": "按主题综合证据并标注不确定性", "status": "pending"},
            {"id": "draft", "content": "生成并保存带来源的技术简报", "status": "pending"},
            {"id": "review", "content": "核对待办、引用与交付路径", "status": "pending"},
        ],
    }


def research_node(state: ResearchState, runtime: ToolRuntime[RuntimeContext]) -> dict:
    # 可以调用专门的 researcher agent；这里省略模型调用，突出状态契约。
    evidence = search_evidence.invoke(
        {"query": "DeepAgents runtime context state schema long running tasks"},
        config={"configurable": {"runtime": runtime}},
    )
    findings = [
        {
            "source": item["url"],
            "claim": item["snippet"],
            "confidence": "medium",
        }
        for item in evidence[:3]
    ]
    todos = [
        {**todo, "status": "completed" if todo["id"] == "collect" else todo["status"]}
        for todo in state["todos"]
    ]
    return {"findings": findings, "todos": todos, "phase": "write"}


def write_node(state: ResearchState) -> dict:
    # 生产中可由 writer 子 agent 生成。输入只给 findings，不给原始搜索全文。
    body = "\n".join(f"- {f['claim']}（{f['source']}）" for f in state["findings"])
    return {
        "messages": [AIMessage(content=f"已完成简报草稿：\n{body}")],
        "phase": "review",
    }


def review_node(state: ResearchState) -> Command[Literal["write", "finish"]]:
    incomplete = [todo for todo in state["todos"] if todo["status"] != "completed"]
    if incomplete:
        # 审校发现缺口时回到写作或研究，而不是让模型含糊地“再试一次”。
        return Command(goto="write", update={"phase": "write"})
    return Command(goto="finish", update={"phase": "done"})


workflow = StateGraph(ResearchState)
workflow.add_node("plan", plan_node)
workflow.add_node("research", research_node)
workflow.add_node("write", write_node)
workflow.add_node("review", review_node)
workflow.add_node("finish", lambda state: {"phase": "done"})
workflow.add_edge(START, "plan")
workflow.add_edge("plan", "research")
workflow.add_edge("research", "write")
workflow.add_edge("write", "review")
workflow.add_edge("finish", END)
app = workflow.compile()
```

实际接入时，工具调用的运行时参数应按所用 DeepAgents/LangGraph 版本的注入 API 传递。关键不是某个调用签名，而是边界：节点产生 state 更新，工具使用 runtime 依赖，阶段路由只依据可检查的 state。

## 长任务的两把刀：offloading 与 summarization

上下文窗口不是数据库。长任务的历史如果无限增长，会造成成本上升、注意力稀释和早期指令被忽略。常用的两个策略职责不同，最好组合使用。

**Offloading（卸载）** 是把大块原始数据移出 prompt，例如网页全文、CSV、模型生成的长草稿、日志和附件。state 只保留文件路径、内容哈希、摘要和检索键；需要时由受控工具按片段读取。它减少 token，同时保留可追溯的原文。

**Summarization（摘要）** 是把已经完成的对话或阶段压缩为面向后续决策的工作记忆。摘要必须包含：已完成事项、关键事实及来源、未决问题、明确约束、下一步。它不能替代原始产物；有争议或需引用时仍要回到 offloaded 原文。

下面是一个可放在每轮 agent 调用前的压缩策略。阈值应由实际模型、工具输出大小和延迟预算确定，不要迷信固定数字。

```python
MAX_RECENT_MESSAGES = 12


def build_working_context(state: ResearchState) -> dict:
    """为下一轮生成紧凑上下文；完整材料仍在外部存储。"""
    recent = state["messages"][-MAX_RECENT_MESSAGES:]
    completed = [t["content"] for t in state["todos"] if t["status"] == "completed"]
    pending = [t["content"] for t in state["todos"] if t["status"] != "completed"]
    summary = {
        "completed": completed,
        "pending": pending,
        "findings": state["findings"][-8:],
        "brief_path": state["brief_path"],
    }
    return {"summary": summary, "recent_messages": recent}


def compact_after_phase(state: ResearchState, summary_text: str, archive_path: str) -> dict:
    """阶段结束后归档旧转录，仅把摘要与近期消息留在热上下文。"""
    return {
        "messages": [
            AIMessage(
                content=(
                    "阶段摘要（原始记录已归档至 "
                    f"{archive_path}）：\n{summary_text}"
                )
            )
        ],
        # 领域状态保留结构化事实，而非在摘要中重复所有内容。
    }
```

一个实用的压缩触发器是：阶段切换、单次工具输出超过预算、累计 token 逼近上限，或对话中出现重复回顾。压缩前先 offload 原始材料；压缩后保留最近几轮对话和结构化 `todos/findings`。这样模型能继续推进，而审计或引用又能回到原文。

## 常见失败模式与修正

1. **把所有东西都放到 messages。** 结果是上下文膨胀、难恢复、难查询。修正：对话放 messages，执行事实放显式 state 字段，大对象放外部存储。
2. **把密钥和客户端放进 state。** checkpoint 或日志会扩大泄露面。修正：只通过 runtime context 注入，并在工具内做租户和权限校验。
3. **Todo 永不更新。** 计划成了装饰，模型可能重复劳动。修正：在系统提示中规定状态转换，并以未完成 Todo 作为阶段门控条件。
4. **摘要写成泛泛的“我们讨论了……”。** 下一轮无法行动。修正：摘要用固定模板：完成、证据、决策、未决项、下一步、产物位置。
5. **把工具完整输出直接喂回模型。** 这既浪费 token，也会放大不可信内容。修正：工具返回受限字段和大小；原文 offload，模型仅接收相关摘录。

## 上线前检查清单

- state 中的每个字段是否都需要恢复、审计或驱动下一步？
- runtime context 是否没有被写入消息、state、日志或产物？
- 每个工具是否写清调用时机、输入边界、输出大小和失败语义？
- Todo 是否有明确完成条件，且每个阶段都会更新？
- 大文件是否已 offload，并有路径、哈希或来源可追溯？
- 摘要是否能让一个新 agent 在不读完整历史的情况下继续完成任务？

流程与上下文工程的目标不是把 agent 变成一条死板的流水线，而是让它在受控状态中保有自主性：短期推理留在当前上下文，长期事实进入 schema，执行环境留在 runtime，庞大材料移到外部存储。边界清楚后，复杂任务才会既能持续推进，也能安全恢复和稳定评估。
