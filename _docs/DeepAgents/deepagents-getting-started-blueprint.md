---
layout: doc
title: DeepAgents 入门蓝图：架构、能力边界与适用场景
category: DeepAgents
date: '2026-07-09'
tags:
  - Deep Agents
  - LangChain
  - LangGraph
  - Agent Harness
---

# DeepAgents 入门蓝图：架构、能力边界与适用场景

很多人第一次看到 Deep Agents，会把它当成“又一个 agent 框架”。这个判断不算错，但不够精确。更准确的说法是：**Deep Agents 是一个 opinionated agent harness，它站在 LangChain 之上、运行在 LangGraph 之上，把规划、文件系统、subagents、memory、human-in-the-loop 等能力打包成了一个开箱即用的长程任务执行层。**

如果你先建立这个分层心智模型，后面的 API 和适用场景会清楚很多。

## 先用一句话理解三者关系

可以把它看成三层：

```text
你的业务代码
  -> Deep Agents
     - 一个“带电池”的 agent harness
     - 负责默认提示词、规划、文件系统、subagents、memory、HITL
  -> LangChain
     - agent framework
     - 负责模型、工具、middleware、agent loop 等抽象
  -> LangGraph
     - runtime / orchestration layer
     - 负责 durable execution、checkpoint、streaming、interrupt、persistence
  -> 模型、MCP 工具、文件后端、sandbox、存储
```

官方文档对这三层的定位很明确：

- `LangChain` 更像上层框架，提供模型、工具、agent loop 和 middleware 抽象。
- `LangGraph` 更像底层 runtime，解决长运行、可恢复、可中断、可持久化的执行问题。
- `Deep Agents` 更像 harness，直接把规划、委派、文件系统、上下文工程等“真实任务必需品”预装进去。

这也是为什么官方 README 会把 Deep Agents 叫做 “the batteries-included agent harness”。

## Deep Agents、LangChain、LangGraph 到底该怎么选

| 层级 | 核心价值 | 适合什么时候直接用 |
| --- | --- | --- |
| LangChain | 快速搭 agent，抽象统一，工具和模型集成多 | 任务不复杂，想先把 agent loop 跑起来 |
| LangGraph | 低层编排、持久化、可恢复、状态流转 | 你要自定义节点图、混合确定性流程和 agent 流程 |
| Deep Agents | 开箱即用的长程 agent harness | 任务复杂、多步骤、会产生大量中间产物，还需要规划、文件系统、subagents 和人工审批 |

一个很实用的判断标准是：

- 只是做一个轻量工具调用 agent，优先用 `LangChain.create_agent` 一类的轻量入口。
- 需要“能自己拆任务、写文件、读文件、记住偏好、必要时停下来给人确认”的 agent，优先上 `create_deep_agent`。
- 如果你已经知道默认 agent loop 不是你要的形状，而是需要明确的状态机、工作流图或长事务恢复，直接下沉到 LangGraph。

## 为什么官方把它叫 agent harness

“Harness” 这个词可以理解成“把复杂能力捆成一套可直接使用的执行骨架”。

Deep Agents 不是重新发明模型调用，也不是替代 LangGraph。它做的是：

- 在 LangChain 的 agent 抽象之上，补齐真实任务里的默认能力。
- 在 LangGraph 的 runtime 之上，把可恢复执行、interrupt、streaming、持久化用起来。
- 用一套约定好的工具和 middleware，把“长程、多步骤、产物很多”的 agent 体验做出来。

这也是它和很多“只会 tool calling 的 agent”最大的区别：**Deep Agents 不是只回答，它是默认按“执行任务”来设计的。**

## Deep Agents 的核心能力拆解

## 1. 规划：不是 PPT 规划，而是可执行规划

Deep Agents 内建了 `write_todos` 工具，官方文档把它定义为一层轻量规划能力。它不是 BPMN 级工作流引擎，而是让 agent 在执行过程中维护一个结构化待办列表，状态包括：

- `pending`
- `in_progress`
- `completed`

这层规划适合：

- 需求会不断分解的任务
- 需要中途改计划的任务
- 用户希望看到 agent 当前做到哪一步的任务

它不适合：

- 需要严格审批链和固定状态机的企业流程
- 每一步都必须可预测、不可偏航的任务

换句话说，`write_todos` 更像“任务执行中的工作记忆板”，不是企业级工作流平台。

## 2. 文件系统：Deep Agents 的上下文扩展器

这是 Deep Agents 很关键的一层。官方文档里，虚拟文件系统是 execution environment 的核心组成部分之一。它支持的内建文件工具包括：

- `ls`
- `read_file`
- `write_file`
- `edit_file`
- `delete`
- `glob`
- `grep`
- `execute`

这意味着 agent 不必把所有中间结果都塞回上下文窗口，而是可以：

- 把搜索结果写进文件
- 只在需要时读某个片段
- 把大输出从对话上下文卸载到磁盘
- 在多轮长任务里围绕同一批文件工作

这层能力最适合：

- 代码代理
- 研究代理
- 报告生成代理
- 需要处理大量中间产物的任务

### 文件系统的能力边界

这里有三个边界特别值得记住。

第一，**权限是声明式规则，不是模型自律**。官方文档说明，权限规则按声明顺序匹配，采用 first-match-wins 语义。

第二，**安全边界在工具和 sandbox，不在提示词**。官方 README 直接说明 Deep Agents 采用 “trust the LLM” 模型，也就是不要期待模型自己克制，真正的约束应放在工具权限、后端和隔离环境上。

第三，**文件权限不约束 sandbox 的任意命令执行**。官方文档明确写到，`permissions` 作用于内建文件系统工具，但不作用于 sandbox backend 暴露出的 `execute`。这意味着如果你给了 shell 权限，真正的安全控制点仍然是 sandbox 本身。

一个最小权限示例如下：

```python
from deepagents import FilesystemPermission, create_deep_agent

agent = create_deep_agent(
    model="openai:gpt-5.5",
    permissions=[
        FilesystemPermission(
            operations=["write"],
            paths=["/workspace/.env"],
            mode="deny",
        ),
        FilesystemPermission(
            operations=["read", "write"],
            paths=["/workspace/**"],
            mode="allow",
        ),
    ],
)
```

这个例子里，顺序非常重要。因为规则是 first-match-wins，所以敏感路径必须先写 `deny`。

## 3. Subagents：把上下文污染隔离出去

官方文档对 subagents 的解释非常实用：它们用于 **context quarantine**。也就是把会产生大量中间步骤的子任务隔离在独立上下文里，主 agent 只拿回结果，而不是拿回全部过程。

这层能力适合：

- 主 agent 做协调，子 agent 做研究、审查、测试、抓取
- 某些子任务工具输出特别大
- 不同子任务需要不同提示词、不同模型、不同权限

这层能力不适合：

- 简单单轮问答
- 没有明显子任务边界的超短任务

有两个设计点值得特别记住。

- Deep Agents 默认会自动加一个同步的 `general-purpose` subagent。
- 你可以传入自定义 subagent，甚至把 LangChain agent 或自定义 LangGraph graph 编译后作为 subagent 挂进去。

这说明 Deep Agents 不是封闭系统。你完全可以把它当“总控层”，把更定制的 agent 或 graph 塞进来做专门子任务。

## 4. Memory 与 skills：让 agent 跨会话记住东西，也按需加载程序性知识

Deep Agents 把 memory 设计成文件系统的一部分来管理。官方文档里，长期记忆通过 `memory=` 指向的文件加载，典型是 `AGENTS.md` 这一类文件。

它和 skills 的区别要分清：

- `memory` 更像长期记忆，通常保存偏好、风格、约束、长期事实。
- `skills` 更像程序性知识，保存“遇到某类任务应该怎么做”。

官方文档还强调了一个重要差异：

- memory 通常在启动时加载
- skills 采用 progressive disclosure，先读描述，需要时再读完整内容

这意味着：

- memory 适合稳定、常驻的背景信息
- skills 适合按需激活的工作流模板

### Memory 的两个常见作用域

- agent-scoped memory：所有用户共享，适合让 agent 自己形成长期风格和经验
- user-scoped memory：按用户隔离，适合保存用户偏好，防止串味

### Memory 的能力边界

- 它不是向量数据库的自动替代品，复杂检索仍然要自己设计。
- 它不是“越多越好”，因为错误或过时的记忆会变成长期提示词负债。
- 它不是短期会话状态，短期状态本身已经由 thread state 和 checkpoint 管。

## 5. Human-in-the-loop：把高风险动作拉回人类控制

Deep Agents 的 HITL 建立在 LangGraph 的 interrupt 能力之上。你通过 `interrupt_on` 指定哪些工具需要审批，Deep Agents 会在执行前暂停。

这非常适合：

- 删除文件
- 改写关键配置
- 调用高成本 API
- 发送邮件、发布内容、执行部署

这层能力的关键边界也很清楚：

- 它会降低全自动吞吐量，但显著提高高风险任务可控性。
- 它需要 `checkpointer`，否则暂停后无法恢复。
- 恢复时必须使用同一个 `thread_id`。

如果你的任务天然需要“人拍板”，那 HITL 不是负担，而是必需品。

## 一个最小的 `create_deep_agent` 示例

下面先看最小可运行版本。这个例子只演示三件事：

- 用 `create_deep_agent` 创建 agent
- 接入一个自定义工具
- 用一条用户消息触发执行

安装依赖：

```bash
uv add deepagents langchain-openai
```

Python 代码：

```python
import os
from pprint import pprint

from deepagents import create_deep_agent

os.environ["OPENAI_API_KEY"] = "sk-..."


def get_glossary(term: str) -> str:
    """Return a short glossary entry for an agent-related term."""
    glossary = {
        "langchain": "LangChain 是偏上层的 agent framework，提供模型、工具和 agent loop 抽象。",
        "langgraph": "LangGraph 是偏底层的 runtime，擅长持久化、流式执行和 human-in-the-loop。",
        "deep agents": "Deep Agents 是建立在 LangChain 和 LangGraph 之上的 opinionated harness。",
    }
    return glossary.get(term.lower(), f"没有找到 {term} 的词条。")


agent = create_deep_agent(
    model="openai:gpt-5.5",
    tools=[get_glossary],
    system_prompt=(
        "You are a helpful assistant who explains agent systems clearly. "
        "Prefer concise answers with examples when helpful."
    ),
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "请用 3 点解释 Deep Agents、LangChain 和 LangGraph 的关系，"
                    "然后补充 glossary 里的 langgraph 词条。"
                ),
            }
        ]
    }
)

pprint(result)
```

### 这个最小例子背后发生了什么

- `create_deep_agent(...)` 是总入口，它会拼好默认 harness。
- `model="openai:gpt-5.5"` 用的是 LangChain 统一的 provider:model 写法。
- `tools=[get_glossary]` 把普通 Python 函数注册成可调用工具。
- `system_prompt` 决定 agent 的全局行为风格。
- `agent.invoke(...)` 不是“调用一次模型”这么简单，它调用的是整个 agent harness。

如果你以前只写过裸 `chat.completions`，这里最重要的转变是：**你操作的不再是一次推理，而是一套带工具、带状态、带执行环境的任务系统。**

## 从最小示例升级到“能做真实任务”

下面三个代码片段分别对应 memory、subagents 和 human-in-the-loop。它们不是必须一次全上，而是你进入 Deep Agents 的三条最常见演进路径。

## 示例一：加上长期 memory

```python
from langchain_core.utils.uuid import uuid7

from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from deepagents.backends.utils import create_file_data
from langgraph.store.memory import InMemoryStore

store = InMemoryStore()

store.put(
    ("blog-agent",),
    "/memories/AGENTS.md",
    create_file_data(
        """## Writing preferences
- Answer in Chinese
- Give the conclusion first
- Prefer concrete examples
"""
    ),
)

agent = create_deep_agent(
    model="openai:gpt-5.5",
    memory=["/memories/AGENTS.md"],
    backend=lambda rt: CompositeBackend(
        default=StateBackend(rt),
        routes={
            "/memories/": StoreBackend(rt, namespace=lambda rt: ("blog-agent",)),
        },
    ),
    store=store,
)

config1 = {"configurable": {"thread_id": str(uuid7())}}
agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "记住：我写博客时偏好先给结论，再展开细节。",
            }
        ]
    },
    config=config1,
)

config2 = {"configurable": {"thread_id": str(uuid7())}}
result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "解释为什么 Deep Agents 适合长周期任务。",
            }
        ]
    },
    config=config2,
)

print(result)
```

这个例子说明两件事：

- 记忆是跨线程持久化的，不依赖当前会话上下文还在不在。
- Deep Agents 把长期记忆当文件处理，所以你可以复用后端、权限和命名空间策略。

## 示例二：把研究工作交给 subagent

```python
from deepagents import create_deep_agent

agent = create_deep_agent(
    model="openai:gpt-5.5",
    system_prompt=(
        "You are a coordinator with no research knowledge. "
        "For every research request, delegate with task() "
        "to the research-agent. Never do the research yourself."
    ),
    subagents=[
        {
            "name": "research-agent",
            "description": "Collect evidence for one topic at a time and return a brief summary.",
            "system_prompt": (
                "You are a careful researcher. "
                "Return concise findings and clearly note uncertainty."
            ),
        }
    ],
    name="main-agent",
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "研究 Deep Agents 适合哪些团队，并输出 5 条建议。",
            }
        ]
    }
)

print(result)
```

这个例子的重点不在“多一个 agent”，而在 **主 agent 不再吞下所有研究过程**。真正的价值是：

- 主 agent 负责协调
- 子 agent 负责脏活累活
- 主上下文只保留结果，不保留全部中间噪音

如果你后面想进一步定制，官方文档支持把 LangChain agent 或 LangGraph graph 编译后作为 `CompiledSubAgent` 接入。

## 示例三：为高风险工具加人工审批

```python
from langchain.tools import tool
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command


@tool
def remove_file(path: str) -> str:
    """Delete a file from the filesystem."""
    return f"Deleted {path}"


@tool
def notify_email(to: str, subject: str, body: str) -> str:
    """Send an email."""
    return f"Sent email to {to}"


checkpointer = MemorySaver()

agent = create_deep_agent(
    model="openai:gpt-5.5",
    tools=[remove_file, notify_email],
    interrupt_on={
        "remove_file": True,
        "notify_email": {"allowed_decisions": ["approve", "reject"]},
    },
    checkpointer=checkpointer,
)

config = {"configurable": {"thread_id": "review-thread-1"}}

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "删除 draft.md，然后发邮件通知编辑部。",
            }
        ]
    },
    config=config,
    version="v2",
)

if result.interrupts:
    decisions = [
        {
            "type": "reject",
            "message": "不要直接删除文件，先改为归档到 archive/ 目录。",
        },
        {"type": "approve"},
    ]
    result = agent.invoke(
        Command(resume={"decisions": decisions}),
        config=config,
        version="v2",
    )

print(result)
```

这个例子说明了 HITL 的运行方式：

- 首次 `invoke` 会在高风险工具执行前暂停
- 暂停点通过 checkpointer 持久化
- 你检查 `result.interrupts`
- 再用 `Command(resume=...)` 恢复
- 恢复时必须带同一个 `thread_id`

如果你只记一个实践要点，就记这个：**高风险工具一定要把审批建模成执行流的一部分，而不是事后补救。**

## 适用场景：什么时候 Deep Agents 特别顺手

- 代码代理：需要读写文件、跑命令、拆子任务、汇总产物
- 研究代理：要抓资料、做阶段性总结、把大输出卸载到文件
- 内容生产代理：多轮整理提纲、草稿、引用、版本修订
- 运营代理：涉及多工具、多步骤、部分动作需要人确认
- 内部知识助手：既要记住团队偏好，又要按需调用技能或数据源

这些场景有一个共性：**任务不是一句话回答完，而是要执行、迭代、落产物。**

## 不适用场景：什么时候别硬上

- 只是做 FAQ、闲聊、简单 RAG 问答
- 流程非常确定，固定到更像工作流而不是 agent
- 对每一步输出可预测性要求极高，不能接受自主分解
- 安全边界还没设计好，却已经准备给它 shell 或写权限

简单说：

- 任务太轻，用 Deep Agents 可能是过度设计。
- 任务太硬规则，直接用 LangGraph 或普通工作流系统通常更稳。

## 能力边界总结：Deep Agents 强在哪，也不强在哪

可以把它的边界总结成五句话。

- 它强在长程、多步骤、需要产物管理的任务，不强在简单单轮问答。
- 它强在默认能力齐全，不强在极致可定制编排；要极致编排就下沉到 LangGraph。
- 它强在把 context 问题工程化处理，不代表它自动理解你的业务边界。
- 它强在支持 memory 和 skills，不代表长期记忆天然高质量，记忆治理仍然是工程问题。
- 它强在能接入 HITL，不代表有了审批就绝对安全，真正的安全边界仍然在权限、后端和 sandbox。

## 一条实用的学习路线图

如果你准备系统学 Deep Agents，可以按这个顺序走：

1. 先跑通最小 `create_deep_agent` 示例，理解模型、工具、消息输入格式。
2. 再理解 execution environment，重点是文件系统、权限、backend 和 `execute` 的边界。
3. 接着学 skills 和 memory，建立“长期记忆”和“按需技能”分层。
4. 然后再学 subagents，先会用同步 subagent，再考虑动态或异步委派。
5. 最后学 human-in-the-loop，把高风险工具纳入审批链。
6. 当你发现默认 harness 不够表达业务流程时，再下沉到 LangGraph 自定义图。
7. 进入生产前，把 tracing、evaluation 和 deployment 体系补到 LangSmith。

这个顺序的原因很简单：**Deep Agents 的学习重点不是 API 数量，而是先建立分层和边界意识。**

## 结语

如果只看表面，Deep Agents 像是一个“更强的 agent SDK”。但从工程角度看，它真正提供的是一套长程 agent 的默认执行骨架：有规划、有文件系统、有子代理、有记忆，也允许人在关键点踩刹车。

所以最稳的使用姿势不是“拿它替代一切”，而是：

- 任务轻，先用 LangChain
- 任务复杂，先用 Deep Agents
- 需要自定义编排和状态图，再下沉到 LangGraph

这套分层一旦想清楚，Deep Agents 就不再神秘，它只是刚好站在“够强、又不至于太底层”的那个位置。

## 参考资料

- Deep Agents GitHub README: https://github.com/langchain-ai/deepagents
- Deep Agents Overview: https://docs.langchain.com/oss/python/deepagents/overview
- Frameworks, Runtimes, and Harnesses: https://docs.langchain.com/oss/python/concepts/products
- Memory: https://docs.langchain.com/oss/python/deepagents/memory
- Subagents: https://docs.langchain.com/oss/python/deepagents/subagents
- Human-in-the-loop: https://docs.langchain.com/oss/python/deepagents/human-in-the-loop
