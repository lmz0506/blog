---
layout: doc
title: 从 0 到 1：用 Quickstart 搭建第一个 DeepAgents 研究助手
category: DeepAgents
date: '2026-07-10'
tags:
  - DeepAgents
  - LangGraph
  - Tavily
  - LangSmith
---

# 从 0 到 1：用 Quickstart 搭建第一个 DeepAgents 研究助手

如果你第一次接触 DeepAgents，最值得先跑通的不是复杂多代理编排，而是官方 quickstart 里的“研究助手”闭环：安装依赖，配置模型和 Tavily，定义搜索工具，创建 agent，然后用 `invoke` 和 `ainvoke` 真正跑出第一轮对话。

这篇文章按官方 quickstart 走一遍，同时补上两个实战里很快就会遇到、但 quickstart 本身没有展开的点：

1. `thread_id` 到底什么时候生效，怎么让多轮对话真的串起来。
2. LangSmith tracing 怎么开，开完以后你能看到什么。

截至 2026 年 7 月 10 日，PyPI 上 `deepagents` 的最新版本是 `0.6.12`，要求 Python `>=3.11,<4.0`。官方 quickstart 使用 `deepagents`、`tavily-python` 和一个支持 tool calling 的聊天模型；DeepAgents 本身构建在 LangGraph 之上，`create_deep_agent()` 返回的是 `CompiledStateGraph`，因此天然支持 `invoke()`、`ainvoke()`、streaming 和 checkpoint。

## 先理解一下：我们要搭什么

官方 quickstart 里，这个研究助手至少会做 5 件事：

1. 自动规划任务，拆分待办。
2. 调用你提供的搜索工具拉取外部信息。
3. 用内置文件系统工具管理大段上下文。
4. 必要时启用子代理处理复杂子任务。
5. 汇总结果并返回最终回答。

也就是说，哪怕你只额外提供一个 `internet_search()`，DeepAgents 也不是“只会搜网页”，它还自带待办管理、文件读写、命令执行和子代理调度这些基础能力。

## 环境准备

你至少需要 3 样东西：

1. Python 3.11 或更高版本。
2. 一个支持 tool calling 的模型 API Key，比如 OpenAI、Anthropic、Google。
3. 一个 Tavily API Key，用来给研究助手提供联网搜索能力。

如果你还想看执行链路，再额外准备一个 LangSmith API Key。

## 第一步：安装依赖

官方 quickstart 给了 `pip` 和 `uv` 两种安装方式。

### 用 `pip`

```bash
pip install deepagents tavily-python
```

### 用 `uv`

```bash
uv init
uv add deepagents tavily-python
uv sync
```

如果你只想尽快跑通，直接用 `pip install` 就够了。

## 第二步：配置 API Key

官方 quickstart 展示的是 Unix 风格的 `export`。如果你在 macOS 或 Linux 上，可以直接这样设：

```bash
export OPENAI_API_KEY="your-openai-api-key"
export TAVILY_API_KEY="your-tavily-api-key"

# 可选：开启 LangSmith tracing
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY="your-langsmith-api-key"
```

如果你在 Windows PowerShell 里运行，等价写法是：

```powershell
$env:OPENAI_API_KEY="your-openai-api-key"
$env:TAVILY_API_KEY="your-tavily-api-key"

# 可选：开启 LangSmith tracing
$env:LANGSMITH_TRACING="true"
$env:LANGSMITH_API_KEY="your-langsmith-api-key"
```

如果你不用 OpenAI，也可以把模型换成官方 quickstart 里列出的其他 provider，例如：

- `anthropic:claude-sonnet-4-6`
- `google_genai:gemini-3.5-flash`
- `openrouter:z-ai/glm-5.2`

核心要求只有一个：模型必须支持 tool calling。

## 第三步：写完整可运行代码

下面这份脚本是在官方 quickstart 基础上整理的完整版本，补了 4 个实用增强：

1. `require_env()`：缺少环境变量时给出更清晰的错误。
2. `checkpointer=InMemorySaver()`：让 `thread_id` 真正有意义。
3. `invoke()` + `ainvoke()`：同步和异步都跑一遍。
4. 同一个 `thread_id` 连续调用：演示多轮对话如何延续上下文。

把下面代码保存为 `quickstart_research_assistant.py` 后直接运行即可：

```python
import asyncio
import os
from typing import Literal

from deepagents import create_deep_agent
from langgraph.checkpoint.memory import InMemorySaver
from tavily import TavilyClient


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable: {name}. "
            f"Please set it before running this script."
        )
    return value


OPENAI_API_KEY = require_env("OPENAI_API_KEY")
TAVILY_API_KEY = require_env("TAVILY_API_KEY")

tavily_client = TavilyClient(api_key=TAVILY_API_KEY)


def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
):
    """Run a web search with Tavily."""
    return tavily_client.search(
        query=query,
        max_results=max_results,
        include_raw_content=include_raw_content,
        topic=topic,
    )


research_instructions = """You are an expert researcher.
Your job is to conduct thorough research and then write a polished report.

You have access to an internet search tool as your primary means of gathering information.

## `internet_search`
Use this to run an internet search for a given query. You can specify
the max number of results to return, the topic, and whether raw content
should be included.

When answering:
- cite concrete facts from the search results;
- keep the final answer concise but complete;
- respond in Chinese unless the user asks otherwise.
"""


agent = create_deep_agent(
    model="openai:gpt-5.5",
    tools=[internet_search],
    system_prompt=research_instructions,
    checkpointer=InMemorySaver(),
)


def run_sync() -> None:
    config = {"configurable": {"thread_id": "deepagents-quickstart-demo"}}
    result = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": "请用中文介绍 LangGraph 是什么，并列出 3 个核心特点。",
                }
            ]
        },
        config=config,
    )

    print("=== invoke() result ===")
    print(result["messages"][-1].content)


async def run_async() -> None:
    # 复用同一个 thread_id，演示多轮上下文延续
    config = {"configurable": {"thread_id": "deepagents-quickstart-demo"}}
    result = await agent.ainvoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": "基于上一轮回答，再补充 LangGraph 和 DeepAgents 的关系。",
                }
            ]
        },
        config=config,
    )

    print("\n=== ainvoke() result ===")
    print(result["messages"][-1].content)


if __name__ == "__main__":
    run_sync()
    asyncio.run(run_async())
```

## 第四步：运行脚本

```bash
python quickstart_research_assistant.py
```

正常情况下你会看到两段输出：

1. 第一段来自 `invoke()`，回答 “LangGraph 是什么”。
2. 第二段来自 `ainvoke()`，它会在同一个 `thread_id` 下继续追问 “LangGraph 和 DeepAgents 的关系”。

如果你已经设置了 `LANGSMITH_TRACING=true` 和 `LANGSMITH_API_KEY`，这两次调用还会自动出现在 LangSmith 里。

## 逐段拆解这份代码

### 1. 为什么先定义 `internet_search()`

官方 quickstart 的关键不是“调用现成搜索 agent”，而是“自己把搜索能力封装成一个 tool，再交给 DeepAgents”。最小版本就是：

```python
from tavily import TavilyClient

tavily_client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])

def internet_search(query: str, max_results: int = 5):
    return tavily_client.search(query=query, max_results=max_results)
```

DeepAgents 会把这个 Python 函数自动当成可调用工具。函数签名越清晰，模型就越容易正确使用它。上面的完整脚本保留了官方 quickstart 里的 `topic` 和 `include_raw_content` 参数，就是为了让模型在“普通搜索 / 新闻搜索 / 金融搜索”之间做更细粒度的选择。

### 2. `create_deep_agent()` 到底返回了什么

官方参考文档明确说明：`create_deep_agent()` 返回的是 `CompiledStateGraph`。这点很重要，因为它直接决定了你后面能用哪些运行方式：

- `invoke()`：同步单次调用。
- `ainvoke()`：异步单次调用。
- `stream()` / `astream()`：边执行边输出。
- `checkpointer`：保存短期状态，支持恢复和多轮延续。

所以你可以把 DeepAgents 理解成“一个已经配置好的、带默认能力栈的 LangGraph 可执行图”。

### 3. `messages` 为什么是列表

官方 quickstart 的调用方式是：

```python
result = agent.invoke(
    {"messages": [{"role": "user", "content": "What is langgraph?"}]}
)
```

这里的 `messages` 是对话消息数组。即使你现在只发一轮，最好也按消息列表来传，因为后续接入多轮、UI、流式输出时都更自然。

返回值里的最终回答通常可以这样拿：

```python
result["messages"][-1].content
```

也就是“取最后一条消息的正文”。

## `invoke()` 和 `ainvoke()` 怎么选

最简单的判断标准如下：

| 场景 | 推荐 |
| --- | --- |
| 你在脚本、Notebook、CLI 里快速跑通单次调用 | `invoke()` |
| 你在异步 Web 服务、异步 worker、并发任务里调用 agent | `ainvoke()` |

这两个方法底层能力一致，区别主要在调用方式：

### `invoke()`

- 阻塞式调用。
- 写法最短，最适合 quickstart。
- 适合先验证 agent 能不能跑通。

### `ainvoke()`

- 需要放在 `async def` 里，并通过 `await` 调用。
- 更适合 FastAPI、异步任务队列、并发 research pipeline。
- 当你后面要接流式输出或并发子任务时，通常会更顺手。

如果你刚入门，我建议先用 `invoke()` 验证链路，再补一段 `ainvoke()`；这也是上面完整脚本的写法。

## `thread_id` 到底是什么

这是很多人第一次接触 LangGraph / DeepAgents 时最容易误解的点。

结论先说：

1. `thread_id` 不是“随便传个字符串就自动记住上下文”。
2. 只有在 agent 开启了 `checkpointer` 之后，`thread_id` 才会成为状态保存和恢复的关键。
3. 同一个 `thread_id` 代表同一条会话线程；不同 `thread_id` 代表彼此隔离的新会话。

官方 LangGraph 参考文档对这点说得很明确：启用 checkpointer 后，你应该在调用时传入：

```python
config = {"configurable": {"thread_id": "my-thread"}}
```

然后再：

```python
graph.invoke(inputs, config)
```

它的作用就是把 checkpoint 存到 `"my-thread"` 这条线程下面。下一次如果还用同一个 `thread_id`，图就可以接着上次状态继续执行。

### 为什么 quickstart 原文没有写 `thread_id`

因为官方 quickstart 目标是“最快跑通第一个 agent”，所以它只展示了：

```python
result = agent.invoke({"messages": [{"role": "user", "content": "What is langgraph?"}]})
```

这对首次上手完全够用。但如果你继续往下做聊天、研究工作流、会话恢复，就必须把 `checkpointer` 和 `thread_id` 一起补上。

### 最小记忆版写法

如果你只想看 `thread_id` 的最小生效条件，下面这段是核心：

```python
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import InMemorySaver

agent = create_deep_agent(
    model="openai:gpt-5.5",
    tools=[internet_search],
    system_prompt=research_instructions,
    checkpointer=InMemorySaver(),
)

config = {"configurable": {"thread_id": "demo-thread"}}
result = agent.invoke({"messages": [{"role": "user", "content": "你好"}]}, config=config)
```

注意，`InMemorySaver()` 只适合本地开发和演示；进程一结束，内存里的状态就没了。你如果要做真正持久化的会话，后面就要换成数据库或其他持久化 checkpoint/store 方案。

## 基础 tracing：为什么建议一开始就开 LangSmith

官方 quickstart 把 LangSmith tracing 放在第 5 步，而且这个顺序是对的。因为当 agent 一旦接入搜索、文件系统和子代理，单看最终回答已经不够排障了。

你只要设置：

```bash
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY="your-langsmith-api-key"
```

之后再运行脚本，就能在 LangSmith 里看到至少这些信息：

1. 规划阶段做了哪些思考和待办拆分。
2. 工具调用顺序是什么。
3. 每次 `internet_search()` 传了什么参数。
4. 是否触发了文件读写、子代理、重试等行为。
5. 最终回答是如何从中间步骤汇总出来的。

这对排查“为什么模型没有去搜”“为什么搜了但答案很空”“为什么第二轮没有延续上下文”非常有用。

## 常见报错与处理办法

下面这些问题，基本覆盖了 quickstart 第一轮最常见的失败原因。

### 1. `ModuleNotFoundError: No module named 'deepagents'`

原因：

- 依赖没装进当前虚拟环境。
- 终端没激活正确的 Python 环境。

处理：

```bash
pip install deepagents tavily-python
```

然后确认当前解释器版本和路径是你预期的那个。

### 2. `ModuleNotFoundError: No module named 'tavily'`

原因：

- 只装了 `deepagents`，没装 `tavily-python`。

处理：

```bash
pip install tavily-python
```

### 3. `Missing required environment variable: TAVILY_API_KEY`

这是上面完整脚本里 `require_env()` 主动抛出的错误。

原因：

- 你没有设置 `TAVILY_API_KEY`。
- 你在一个终端里设置了变量，却在另一个新终端里运行脚本。

处理：

- 重新设置环境变量。
- 设完以后在同一个终端会话里运行脚本。

如果你照官方 quickstart 直接写 `os.environ["TAVILY_API_KEY"]`，那报错通常会变成 `KeyError: 'TAVILY_API_KEY'`，本质上是同一个问题。

### 4. 401 / 认证失败

常见表现：

- OpenAI key 错误。
- Tavily key 错误。
- LangSmith key 错误。

处理：

1. 确认 key 没复制错。
2. 确认 provider 和 key 对应得上，比如不要把 Anthropic 的 key 配到 OpenAI 模型上。
3. 如果只想先跑 agent，本地可以暂时先不配 LangSmith。

### 5. 模型不支持 tool calling

官方 quickstart 明确要求 DeepAgents 使用支持 tool calling 的模型。

原因：

- 你换成了不支持工具调用的模型。
- 你用了 provider 名对，但 model 名不对。

处理：

- 先直接用官方 quickstart 给出的模型字符串验证。
- OpenAI 示例优先用：`openai:gpt-5.5`
- Anthropic 示例优先用：`anthropic:claude-sonnet-4-6`
- Google 示例优先用：`google_genai:gemini-3.5-flash`

### 6. 第二轮对话没有“记住上一轮”

原因通常只有两个：

1. 你没有给 `create_deep_agent()` 传 `checkpointer`。
2. 你第二次调用时换了 `thread_id`。

处理：

- 加上 `checkpointer=InMemorySaver()`。
- 两次调用都用同一个 `config = {"configurable": {"thread_id": "same-id"}}`。

## 一次跑通后，你下一步该做什么

当你已经成功跑通这篇文章里的脚本，说明这条链路已经成立了：

1. 模型可调用。
2. Tavily 搜索可调用。
3. DeepAgents 能把普通 Python 函数包装成工具。
4. `invoke()` 和 `ainvoke()` 都可用。
5. `thread_id` + `checkpointer` 能把多轮状态串起来。
6. LangSmith tracing 能把执行过程可视化。

下一步最值得做的不是立刻堆更多工具，而是先选一个方向继续深入：

- 把 `internet_search()` 换成你自己的内部搜索或知识库工具。
- 开始使用 `stream()` / `astream()` 做实时输出。
- 引入子代理，把“搜集资料”和“整理报告”拆成两个角色。
- 把 `InMemorySaver()` 替换成真正可持久化的 checkpoint 方案。

## 参考资料

1. DeepAgents 官方 quickstart：
   https://docs.langchain.com/oss/python/deepagents/quickstart
2. DeepAgents GitHub README：
   https://github.com/langchain-ai/deepagents
3. `create_deep_agent()` 官方参考文档：
   https://reference.langchain.com/python/deepagents/graph/
4. LangGraph `CompiledStateGraph` / checkpoint / `ainvoke()` 参考文档：
   https://reference.langchain.com/python/langgraph/graphs/
5. `deepagents` PyPI 页面：
   https://pypi.org/project/deepagents/
