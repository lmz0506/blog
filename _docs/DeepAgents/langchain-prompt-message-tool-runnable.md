---
layout: doc
title: 从 LangChain 打基础：Prompt、Message、Tool 与 Runnable 核心机制
category: DeepAgents
date: '2026-07-07'
tags:
  - DeepAgents
  - LangChain
  - Runnable
  - Tool Calling
  - Agent
---

# 从 LangChain 打基础：Prompt、Message、Tool 与 Runnable 核心机制

要理解 DeepAgents，最稳的路径不是一上来就研究多 Agent 编排，而是先把 LangChain 的基础抽象吃透。因为不管你后面是自己拼 `LangGraph`，还是直接站在 `DeepAgents` 的封装上，最底层绕不开的都是四件事：

- `Prompt` 负责把任务意图整理成模型能读懂的输入
- `Message` 负责承载对话状态、工具调用痕迹和历史上下文
- `Tool` 负责把模型接到外部世界
- `Runnable` 负责把“单步能力”编排成“可执行链路”

这篇文章不追求把 Agent 框架讲得很花，而是聚焦一个更重要的问题：**LangChain 里的 Agent，到底是怎样一步一步长出来的。**

本文默认你已经知道大模型能“聊天”，但还不清楚下面这些事情为什么必须分层：

- 为什么 `PromptTemplate` 不只是字符串拼接
- 为什么 `AIMessage` 里会带 `tool_calls`
- 为什么 Tool 的参数描述决定了模型会不会用错工具
- 为什么 `prompt | model | parser` 这种写法能成为 Agent 的基石
- 为什么错误处理不能只靠“提示模型小心一点”

后面我们会先拆抽象，再用一段完整代码做一个“可搜索、可计算、带结构化输出和错误处理”的基础 Agent 原型。

## 一、先建立一张图：Agent 是怎么被拼出来的

先看最小心智模型：

```text
用户问题
  -> Prompt 组织输入
  -> Message 形成上下文
  -> ChatModel 决定回答还是发起 tool call
  -> Tool 执行外部动作
  -> ToolMessage 把结果写回消息流
  -> Model 基于新消息继续推理
  -> Runnable 把以上步骤编排成链或循环
  -> Agent 只是把这个循环封装成一个可复用运行时
```

如果把 DeepAgents 理解成“复杂任务场景下的 Agent runtime”，那么 LangChain 提供的就是这套 runtime 的基础零件。

换句话说：

- `Prompt` 决定模型“看见什么”
- `Message` 决定模型“记住什么”
- `Tool` 决定模型“能做什么”
- `Runnable` 决定系统“怎么跑起来”

Agent 并不是第五种神秘能力，它只是前四种能力在一个循环中的组合。

## 二、Prompt：不是字符串模板，而是输入编译器

很多初学者会把 Prompt 理解成一大段 system prompt 文本。这个理解太粗了。

在 LangChain 里，Prompt 的职责更接近于“输入编译器”：

- 接收结构化变量
- 检查这些变量是否齐全
- 把变量渲染成字符串或消息列表
- 把结果交给模型

最基础的是 `PromptTemplate`，适合生成单段文本；而 Agent 场景里更常见的是 `ChatPromptTemplate`，因为聊天模型天然吃的是消息序列。

### 1. `PromptTemplate`：单文本模板

```python
from langchain_core.prompts import PromptTemplate

keyword_prompt = PromptTemplate.from_template(
    "把下面的问题改写成适合检索的短查询：\n问题：{question}\n检索词："
)

prompt_value = keyword_prompt.invoke(
    {"question": "DeepAgents 和 LangChain、LangGraph 分别是什么关系？"}
)

print(prompt_value.text)
```

这段代码里最重要的不是“模板被填充了”，而是：

- 模板把输入变量显式声明成了 `{question}`
- 你给错变量名，链路会在模型调用前失败
- 返回值不是裸字符串，而是 `PromptValue`

这个设计的意义在于：LangChain 不希望你把“输入构造”写成不可检查的字符串拼接。Prompt 先把输入形状固定住，后面的链才有可组合性。

### 2. `ChatPromptTemplate`：把输入编译成消息序列

Agent 更常用的是 `ChatPromptTemplate`：

```python
from langchain_core.prompts import ChatPromptTemplate

chat_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "你是一个严谨的 LangChain 助手。先判断是否需要调用工具。"),
        ("human", "问题：{question}"),
    ]
)

prompt_value = chat_prompt.invoke(
    {"question": "解释一下 ToolMessage 在工具调用链里的作用"}
)

for message in prompt_value.messages:
    print(type(message).__name__, "->", message.content)
```

这里已经可以看到一个关键点：**Prompt 的输出不一定是文本，也可以是一组消息。**

这意味着 Prompt 不只是帮你“生成提示词”，而是在帮你生成模型输入的标准形态。

### 3. `MessagesPlaceholder`：把历史消息插进 Prompt

Agent 几乎不可能只靠当前这一轮提问工作，它必须知道历史上下文。LangChain 里常用 `MessagesPlaceholder` 把消息历史放进 Prompt：

```python
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

agent_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "你是一个会调用搜索和计算工具的助手。"),
        MessagesPlaceholder("history"),
        ("human", "{question}"),
    ]
)

prompt_value = agent_prompt.invoke(
    {
        "history": [
            ("human", "先记住：这篇文章聚焦 DeepAgents。"),
            ("ai", "收到，我会把回答限定在 DeepAgents 语境。"),
        ],
        "question": "现在解释 Runnable 的作用",
    }
)
```

这就是 Prompt 在 Agent 里的真实价值：它不只是“写文案”，而是把系统指令、历史消息、当前输入、额外上下文，编译成模型可消费的一段消息流。

### 4. Prompt 设计的工程原则

在 Agent 场景里写 Prompt，最好遵守几条硬规则：

- 把角色约束写进 `system` 消息，不要混在用户消息里
- 把动态输入拆成命名变量，不要整段拼接
- 让工具使用规则清晰可执行，不要写成抽象口号
- 把“何时直接回答、何时调用工具”讲清楚
- 让输出格式尽量结构化，避免后处理全靠正则

一句话概括：**Prompt 不是文学创作，而是接口设计。**

## 三、Message：Agent 的运行现场

如果 Prompt 决定模型“现在看见什么”，那么 Message 决定模型“到目前为止经历了什么”。

LangChain 的消息抽象非常重要，因为 Agent 的状态流转本质上就是消息流转。

### 1. 四种核心消息类型

最常见的四类消息是：

- `SystemMessage`：系统规则、角色、边界
- `HumanMessage`：用户输入
- `AIMessage`：模型输出
- `ToolMessage`：工具执行结果

先看最基础的调用方式：

```python
from langchain.chat_models import init_chat_model
from langchain.messages import SystemMessage, HumanMessage

model = init_chat_model("openai:gpt-5.5", temperature=0)

messages = [
    SystemMessage("你是一个擅长解释 Agent 系统的老师。"),
    HumanMessage("一句话解释 Message 在 LangChain 中的作用"),
]

response = model.invoke(messages)
print(response.content)
```

这说明聊天模型吃的本质不是“一个 prompt 字符串”，而是“一个消息列表”。

### 2. `AIMessage` 不只是文本，还可能带工具调用

当模型支持函数调用或 tool calling 时，`AIMessage` 里除了普通文本，还可能包含 `tool_calls`。这是 Agent 能成立的关键。

```python
from langchain.chat_models import init_chat_model
from langchain.tools import tool

model = init_chat_model("openai:gpt-5.5", temperature=0)

@tool
def get_weather(location: str) -> str:
    """查询某个地点的天气。"""
    return f"{location}：晴，28 摄氏度"

model_with_tools = model.bind_tools([get_weather])
ai_message = model_with_tools.invoke("帮我看一下上海天气")

print(ai_message.content)
print(ai_message.tool_calls)
```

如果模型决定该调用工具，它返回的往往不是最终答案，而是类似这样的结构：

```python
[
    {
        "name": "get_weather",
        "args": {"location": "上海"},
        "id": "call_xxx",
        "type": "tool_call",
    }
]
```

这就把“函数调用”落到了一个可处理的数据结构上。

### 3. `ToolMessage`：把工具结果写回消息流

模型发起工具调用后，系统需要执行工具，再把结果写回对话历史。这个返回结果就是 `ToolMessage`。

```python
from langchain.messages import AIMessage, HumanMessage, ToolMessage

ai_message = AIMessage(
    content=[],
    tool_calls=[
        {
            "name": "get_weather",
            "args": {"location": "上海"},
            "id": "call_weather_001",
        }
    ],
)

tool_message = ToolMessage(
    content="上海：晴，28 摄氏度",
    tool_call_id="call_weather_001",
    name="get_weather",
)

messages = [
    HumanMessage("帮我看一下上海天气"),
    ai_message,
    tool_message,
]
```

`ToolMessage` 的关键字段是 `tool_call_id`。它必须和原始 tool call 的 id 对上，不然模型不知道这个结果是回应哪一次调用。

这也是为什么 Message 历史不能随便拼：**它其实是一段带引用关系的执行记录。**

### 4. Message 历史不是附属品，而是短期状态

很多人把“历史消息”当成 UI 层的聊天记录，但在 Agent 系统里它其实是运行状态的一部分。模型会依据这段历史决定：

- 当前任务是否已经做过某一步
- 某个工具结果是否可信
- 现在应该继续工具调用还是直接总结
- 用户刚才说的“它”“那个结果”“再算一下”指的是谁

所以在 DeepAgents 语境里，Message 历史本质上属于短期状态管理，而不是一个装饰性功能。

## 四、Tool：给模型一条受控的出手路径

大模型本身不会搜索、不会访问数据库、不会读你本地文件。它之所以“像是会”，是因为系统允许它在特定条件下调用工具。

因此 Tool 的本质不是“帮模型扩展能力”，而是：

- 暴露一组受控动作
- 为这些动作提供清晰的输入模式
- 把执行结果转回消息流

### 1. 最小 Tool：函数 + 类型注解 + 描述

LangChain 里最基础的工具写法很简单：

```python
from langchain.tools import tool

@tool
def search_docs(query: str) -> str:
    """搜索内部文档并返回最相关的结果摘要。"""
    return f"关于 {query} 的文档摘要 ..."
```

这里真正重要的是三样东西：

- 函数名会成为默认工具名
- 参数类型注解会参与生成输入 schema
- docstring 会成为模型判断“什么时候该用这个工具”的依据

如果 docstring 写得含糊，模型就更容易误用工具。

### 2. 用 Pydantic 定义工具参数，做强校验

复杂工具最好显式声明 `args_schema`：

```python
from pydantic import BaseModel, Field
from langchain.tools import tool

class SearchInput(BaseModel):
    query: str = Field(description="要搜索的问题或关键词")
    top_k: int = Field(default=3, ge=1, le=5, description="返回结果条数，范围 1 到 5")

@tool("doc_search", args_schema=SearchInput)
def doc_search(query: str, top_k: int = 3) -> str:
    """搜索 DeepAgents 和 LangChain 相关资料。"""
    return f"query={query}, top_k={top_k}"
```

这样做有几个直接好处：

- 参数范围和字段语义都变成了 schema
- 模型更容易构造正确调用参数
- 非法参数能在执行前后被明确拦截
- 后续你做结构化测试和监控更容易

在 Agent 世界里，**工具 schema 就是模型与外部能力之间的契约。**

### 3. 为什么“工具参数描述”会直接影响调用质量

模型发起 tool call 时，本质上是在“猜”：

- 该不该用这个工具
- 该传哪些参数
- 参数应该填什么格式

所以工具设计里最容易被低估的部分，是 `Field(description=...)` 和 docstring。

例如下面两种写法，后者明显更稳定：

```python
# 差
expression: str

# 好
expression: str = Field(
    description="只允许数字、小数点、括号和 + - * / 的四则运算表达式，例如 (12.5 / 5) + 7"
)
```

不要把模型当成会读心术的调用方。它需要的是清晰接口，不是隐含约定。

### 4. ToolRuntime：让工具读到当前上下文

新版本 LangChain 里，工具可以通过 `ToolRuntime` 访问运行上下文，比如当前状态、thread 信息、流式写出器等。

```python
from langchain.tools import tool, ToolRuntime

@tool
def get_message_count(runtime: ToolRuntime) -> str:
    """返回当前对话中的消息条数。"""
    return f"当前已有 {len(runtime.state['messages'])} 条消息"
```

注意这里的 `runtime`：

- 会被系统自动注入
- 不会暴露给模型作为普通工具参数
- 适合读取状态、上下文和持久化存储

这对于 DeepAgents 很关键，因为复杂任务里工具经常不是“纯函数”，而是需要感知当前任务现场。

### 5. 工具错误处理：不要把异常直接炸给用户

Agent 里最常见的故障之一就是工具执行失败。比如：

- 模型传了非法参数
- 外部 API 超时
- 计算表达式不合法
- 工具内部抛异常

如果你什么都不做，错误就会变成一次生硬失败；更合理的方式，是把异常包装成模型可继续处理的 `ToolMessage`。

```python
from collections.abc import Callable
from langchain.agents.middleware import ToolCallRequest, wrap_tool_call
from langchain.messages import ToolMessage

@wrap_tool_call
def handle_tool_errors(
    request: ToolCallRequest,
    handler: Callable[[ToolCallRequest], ToolMessage],
) -> ToolMessage:
    try:
        return handler(request)
    except Exception as exc:
        return ToolMessage(
            content=f"工具执行失败，请检查参数后重试。错误：{exc}",
            tool_call_id=request.tool_call["id"],
            name=request.tool_call["name"],
        )
```

这一步的意义在于：**错误被重新表示成了消息，而不是把 Agent 整个打断。**

对于复杂任务系统，这种“把异常纳入状态流”的能力非常重要。

## 五、Runnable：LangChain 最关键也最容易被忽视的抽象

如果说 Tool 是“可调用动作”，那么 Runnable 就是“可编排节点”。

在 LangChain 里，Prompt、Model、Parser、Lambda、Parallel 结构，甚至不少 Agent 相关对象，本质上都可以看成 `Runnable`。

这就是为什么 LangChain 能用非常统一的方式去描述链路。

### 1. `Runnable` 的共同接口

最常见的几个方法是：

- `.invoke(input)`：单次同步调用
- `.ainvoke(input)`：单次异步调用
- `.batch(inputs)`：批量调用
- `.stream(input)`：流式调用

它们的重要性在于统一。只要一个对象实现了 Runnable 接口，你就可以把它放进链里，而不必为每一步单独写不同的调用协议。

### 2. `|` 运算符：把节点串成链

最常见的 LCEL 写法就是：

```python
prompt | model | parser
```

例如：

```python
from langchain.chat_models import init_chat_model
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

model = init_chat_model("openai:gpt-5.5", temperature=0)

chain = (
    ChatPromptTemplate.from_template("用一句话解释 {topic}")
    | model
    | StrOutputParser()
)

result = chain.invoke({"topic": "Runnable 在 LangChain 中的意义"})
print(result)
```

这里三步分别是：

1. Prompt 生成消息输入
2. Model 产出 `AIMessage`
3. Parser 把结果转成普通字符串

这就是最基础的链式编排。

### 3. `RunnableLambda`：把自定义 Python 逻辑插进链里

很多时候你需要在链中间插入一段普通 Python 逻辑，比如清洗输入、路由、补字段、拼上下文。这时用 `RunnableLambda` 很合适。

```python
from langchain_core.runnables import RunnableLambda

normalize_question = RunnableLambda(
    lambda x: {"question": x["question"].strip().replace("Lang Chain", "LangChain")}
)
```

这类节点的价值在于：你的自定义逻辑也被纳入了统一 Runnable 体系，而不是跳出链外另起一套调用风格。

### 4. `RunnableParallel`：并行做互不依赖的步骤

如果几步工作互相独立，可以并行执行。LangChain 里常见做法是显式使用 `RunnableParallel`：

```python
from langchain.chat_models import init_chat_model
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda, RunnableParallel

model = init_chat_model("openai:gpt-5.5", temperature=0)

rewrite_chain = (
    ChatPromptTemplate.from_template("把问题改写成检索查询：{question}")
    | model
    | StrOutputParser()
)

intent_chain = (
    ChatPromptTemplate.from_template(
        "判断这个问题更像是 concept、compare、howto 三类中的哪一类：{question}"
    )
    | model
    | StrOutputParser()
)

analysis_chain = RunnableParallel(
    query=rewrite_chain,
    intent=intent_chain,
    question=RunnableLambda(lambda x: x["question"]),
)

print(analysis_chain.invoke({"question": "DeepAgents 和普通 Agent 有什么区别？"}))
```

这种并行模式很适合：

- 同时做检索词改写和意图分类
- 同时访问多个独立数据源
- 同时生成多个候选结果供后续裁决

### 5. `with_retry` 与 `with_fallbacks`：把鲁棒性编进链里

Runnable 还有一层非常实用的能力：可以直接附加重试和降级逻辑。

```python
from langchain_core.runnables import RunnableLambda

fragile_step = RunnableLambda(lambda x: 1 / x)

safe_step = fragile_step.with_retry(
    stop_after_attempt=2,
    retry_if_exception_type=(ZeroDivisionError,),
)

print(safe_step.invoke(2))
```

再比如降级：

```python
primary = RunnableLambda(lambda _: (_ for _ in ()).throw(ValueError("primary failed")))
fallback = RunnableLambda(lambda _: "use fallback result")

resilient = primary.with_fallbacks([fallback])
print(resilient.invoke(None))
```

为什么这很关键？因为在 Agent 系统里，不稳定的往往不是模型本身，而是：

- 某个外部工具
- 某个解析步骤
- 某个网络请求
- 某个结构化约束

把错误处理能力编进 Runnable，而不是散落在业务代码里，链会更可维护。

## 六、结构化输出：把模型结果从“像 JSON”变成“真 schema”

Prompt 工程的一个经典痛点是：模型“看起来按格式输出了”，但实际字段缺失、类型不对、枚举值漂移。

LangChain 解决这个问题的主线是结构化输出。

### 1. 为什么结构化输出对 Agent 特别重要

在普通聊天里，输出一段自然语言就够了；但在 Agent 场景里，模型输出经常要作为下一步输入，所以你更需要：

- 可验证
- 可解析
- 可类型检查
- 可失败重试

### 2. 直接给 `create_agent` 一个 schema

```python
from pydantic import BaseModel, Field
from langchain.agents import create_agent

class AnswerCard(BaseModel):
    answer: str = Field(description="给用户的最终回答")
    used_tools: list[str] = Field(description="本轮实际使用到的工具名")
    confidence: float = Field(ge=0, le=1, description="回答置信度，0 到 1")

agent = create_agent(
    model="openai:gpt-5.5",
    tools=[],
    response_format=AnswerCard,
)
```

LangChain 会根据模型能力自动选择：

- 如果提供商原生支持结构化输出，就走 provider-native 方案
- 否则回退到基于 tool calling 的结构化输出方案

### 3. 用 `ToolStrategy` 显式控制结构化输出行为

如果你希望更清楚地控制错误处理，可以显式使用 `ToolStrategy`：

```python
from langchain.agents.structured_output import ToolStrategy

agent = create_agent(
    model="openai:gpt-5.5",
    tools=[],
    response_format=ToolStrategy(
        schema=AnswerCard,
        handle_errors=True,
    ),
)
```

它的价值在于：

- 输出会经过 schema 校验
- 校验失败时可以自动重试
- 你可以决定哪些异常需要吞掉并反馈给模型

这就是“结构化输出”和“普通格式约束”的根本差别：**前者是运行时约束，后者通常只是提示词愿望。**

## 七、完整示例：一个可搜索、可计算、带结构化输出的基础 Agent 原型

下面给出一段完整示例代码。它演示了：

- `Prompt` 如何通过 `system_prompt` 约束行为
- `Message` 历史如何通过 `thread_id` 持续保留
- `Tool` 如何定义 schema、做参数校验并执行动作
- `Runnable` 风格的编排思想如何最终汇入 `create_agent`
- `Structured output` 如何返回稳定结果
- `wrap_tool_call` 如何把异常变成模型可消费的反馈

> 运行前提：设置 `OPENAI_API_KEY`，并安装 `langchain`、`langgraph`、`pydantic` 对应依赖。示例使用的是内置假数据搜索，不依赖外部搜索 API。

```python
import ast
import json
from collections.abc import Callable

from langchain.agents import create_agent
from langchain.agents.middleware import ToolCallRequest, wrap_tool_call
from langchain.agents.structured_output import ToolStrategy
from langchain.messages import ToolMessage
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver
from pydantic import BaseModel, Field
from uuid import uuid4


SEARCH_INDEX = {
    "deepagents": [
        "DeepAgents 站在 LangChain/LangGraph 之上，强调复杂任务执行、上下文管理和子任务协作。",
        "DeepAgents 不是单纯的聊天壳，而是带运行约束的 agent harness。",
    ],
    "langchain": [
        "LangChain 提供 prompt、message、tool、runnable、agent 等核心抽象。",
        "create_agent 可以把模型、工具、system prompt 和 middleware 组合成最小可用 agent。",
    ],
    "runnable": [
        "Runnable 是 LangChain 的统一执行接口，常见方法包括 invoke、batch、stream。",
        "prompt | model | parser 这种 LCEL 写法，本质上就是 RunnableSequence。",
    ],
    "toolmessage": [
        "ToolMessage 用于把某次工具执行结果写回消息历史。",
        "ToolMessage 必须带上 tool_call_id，这样模型才能关联到原始调用。",
    ],
}


ALLOWED_BIN_OPS = {
    ast.Add: lambda a, b: a + b,
    ast.Sub: lambda a, b: a - b,
    ast.Mult: lambda a, b: a * b,
    ast.Div: lambda a, b: a / b,
}

ALLOWED_UNARY_OPS = {
    ast.UAdd: lambda a: +a,
    ast.USub: lambda a: -a,
}


def safe_eval(expression: str) -> float:
    node = ast.parse(expression, mode="eval")

    def _eval(current: ast.AST) -> float:
        if isinstance(current, ast.Expression):
            return _eval(current.body)

        if isinstance(current, ast.Constant) and isinstance(current.value, (int, float)):
            return float(current.value)

        if isinstance(current, ast.BinOp) and type(current.op) in ALLOWED_BIN_OPS:
            left = _eval(current.left)
            right = _eval(current.right)
            return ALLOWED_BIN_OPS[type(current.op)](left, right)

        if isinstance(current, ast.UnaryOp) and type(current.op) in ALLOWED_UNARY_OPS:
            return ALLOWED_UNARY_OPS[type(current.op)](_eval(current.operand))

        raise ValueError("只允许数字、括号和 + - * / 四则运算")

    return _eval(node)


class SearchInput(BaseModel):
    query: str = Field(description="要搜索的关键词或问题")
    top_k: int = Field(default=3, ge=1, le=5, description="返回结果条数，范围 1 到 5")


class CalculatorInput(BaseModel):
    expression: str = Field(
        description="只允许数字、小数点、括号和 + - * / 的四则运算表达式，例如 (12.5 / 5) + 7",
        pattern=r"^[0-9\.\+\-\*\/\(\)\s]+$",
    )


class AgentAnswer(BaseModel):
    answer: str = Field(description="给用户的最终回答")
    used_tools: list[str] = Field(description="本轮实际使用到的工具名")
    confidence: float = Field(ge=0, le=1, description="本轮回答的置信度")
    next_step: str | None = Field(default=None, description="如果信息仍不充分，给出下一步建议")


@tool("doc_search", args_schema=SearchInput)
def doc_search(query: str, top_k: int = 3) -> str:
    """搜索 DeepAgents / LangChain 基础知识库。适合概念解释、关系对比和术语澄清。"""
    query_lower = query.lower()
    hits: list[str] = []

    for keyword, docs in SEARCH_INDEX.items():
        if keyword in query_lower:
            hits.extend(docs)

    if not hits:
        hits = [
            "没有直接命中知识库，请尝试改写检索词后再搜索。",
            "可尝试关键词：deepagents、langchain、runnable、toolmessage。",
        ]

    return "\n".join(f"{idx}. {item}" for idx, item in enumerate(hits[:top_k], start=1))


@tool("safe_calculator", args_schema=CalculatorInput)
def safe_calculator(expression: str) -> str:
    """执行安全四则运算。只适合数字计算，不适合概念问答或符号推导。"""
    result = safe_eval(expression)
    return str(result)


@wrap_tool_call
def handle_tool_errors(
    request: ToolCallRequest,
    handler: Callable[[ToolCallRequest], ToolMessage],
) -> ToolMessage:
    try:
        return handler(request)
    except Exception as exc:
        return ToolMessage(
            content=(
                "工具执行失败。请检查参数格式，并在必要时缩小问题范围后重试。"
                f" 错误信息：{exc}"
            ),
            tool_call_id=request.tool_call["id"],
            name=request.tool_call["name"],
        )


def build_agent():
    return create_agent(
        model="openai:gpt-5.5",
        tools=[doc_search, safe_calculator],
        system_prompt=(
            "你是一个面向 DeepAgents 初学者的 LangChain 助手。"
            "遇到概念解释、关系对比、术语澄清时优先使用 doc_search。"
            "遇到明确数值计算时使用 safe_calculator。"
            "如果工具结果不足，不要编造，应该明确指出不足点。"
            "最终输出必须简洁、准确，并总结本轮实际用了哪些工具。"
        ),
        middleware=[handle_tool_errors],
        response_format=ToolStrategy(schema=AgentAnswer, handle_errors=True),
        checkpointer=InMemorySaver(),
    )


def run_demo() -> None:
    agent = build_agent()
    config = {"configurable": {"thread_id": str(uuid4())}}

    questions = [
        "DeepAgents 和 LangChain、LangGraph 的关系是什么？先检索再回答。",
        "顺便帮我算一下：(18 / 3) * (4 + 2)",
        "结合前两轮结果，总结为什么 Runnable 是 Agent 的基础构件。",
    ]

    for idx, question in enumerate(questions, start=1):
        result = agent.invoke(
            {"messages": [{"role": "user", "content": question}]},
            config=config,
        )
        structured: AgentAnswer = result["structured_response"]
        print(f"--- Round {idx} ---")
        print(json.dumps(structured.model_dump(), indent=2, ensure_ascii=False))
        print()


if __name__ == "__main__":
    run_demo()
```

### 这段示例代码值得重点看哪几处

#### 1. `create_agent(...)` 不是黑盒，它只是把基础能力装起来

看似我们只写了一行 `create_agent(...)`，但它背后做的事和前文完全一致：

- 读取当前 `messages`
- 让模型判断是否要发起 tool call
- 执行工具
- 生成 `ToolMessage`
- 把结果继续送回模型
- 最终生成结构化输出

也就是说，Agent 并没有发明新机制，它是在封装已有机制。

#### 2. `checkpointer + thread_id` 才能真正保留消息历史

很多人以为“同一个 agent 实例”就自动有历史。不是。

要让对话历史可持续，必须满足两件事：

- agent 配置了 `checkpointer`
- 每轮调用复用同一个 `thread_id`

这就是 Message 历史进入运行时的方式。没有它，所谓“多轮上下文”只是你自己手动拼接消息。

#### 3. `ToolStrategy(AgentAnswer)` 让最终输出变成可验证对象

如果没有结构化输出，这个 Agent 最后的回答就是一段自然语言。看起来没问题，但系统层面很难保证：

- `used_tools` 一定存在
- `confidence` 一定是 0 到 1 之间的数字
- `next_step` 一定为空或字符串

有了 schema，输出才真正能被下游流程消费。

#### 4. `wrap_tool_call` 把工具异常纳入消息闭环

这里最值得借鉴的不是“捕获异常”，而是“把异常变成 `ToolMessage`”。这意味着模型还有机会：

- 重新组织参数
- 换另一个工具
- 给用户更明确的失败说明

这比直接抛 Python traceback 给用户成熟得多。

## 八、把四个抽象串起来看：为什么它们刚好构成 Agent 的骨架

现在回到最开始的问题：Prompt、Message、Tool、Runnable 为什么是 DeepAgents 的底层准备知识？

因为一个 Agent 运行时，本质上总在重复下面这个闭环：

1. 用 `Prompt` 组织当前任务输入
2. 用 `Message` 保存系统规则、用户消息、模型输出和工具结果
3. 用 `Tool` 把外部能力纳入模型决策面
4. 用 `Runnable` 把这些步骤变成可复用、可重试、可并行、可观测的执行链

而 DeepAgents 做的，是把这个闭环扩展到更复杂的任务规模，例如：

- 更长的任务周期
- 更复杂的上下文裁剪
- 更多工具与权限边界
- 子任务拆分与子 Agent 协作
- 更强的状态管理与恢复能力

所以学习顺序最好是：

1. 先把 LangChain 核心抽象吃透
2. 再理解 LangGraph 如何把链路升级成状态图和持久运行时
3. 最后再看 DeepAgents 如何把复杂任务模式工程化

这个顺序比直接上多 Agent 框架要稳得多。

## 九、实战建议：从“能跑”进阶到“能维护”

如果你准备自己搭一个基础 Agent，下面几条经验很实用：

- 不要让工具名和工具说明模糊不清，模型会误用
- 不要把所有约束都写进 prompt，schema 和 middleware 同样重要
- 不要把 Message 历史当聊天 UI 附属物，它是状态的一部分
- 不要把异常直接抛给用户，应优先转成模型可处理的反馈
- 不要只追求“跑通一次”，要先保证 `.invoke()`、结构化输出和错误链路都可验证

在工程上，真正难的通常不是“让模型答出来”，而是“让系统持续稳定地答出来”。

## 十、总结

从 DeepAgents 往下看，LangChain 的这些抽象并不零散，它们刚好是 Agent 运行时的基本骨架：

- `Prompt` 负责输入编译
- `Message` 负责状态承载
- `Tool` 负责动作扩展
- `Runnable` 负责流程编排

只要你真正理解了这四者的边界，再去看 Agent、LangGraph、DeepAgents，很多“看起来高级”的概念都会自动落回到清晰的工程结构里。

下一步如果继续往前学，最自然的方向就是：

- `LangGraph` 的 State、Node、Edge 与 Checkpoint
- 多工具路由与动态 tool selection
- 长上下文下的消息裁剪、摘要与记忆分层
- DeepAgents 中的复杂任务分解与子代理协作

## 参考资料

- LangChain Overview: https://docs.langchain.com/oss/python/langchain/overview
- LangChain Messages: https://docs.langchain.com/oss/python/langchain/messages
- LangChain Tools: https://docs.langchain.com/oss/python/langchain/tools
- LangChain Structured Output: https://docs.langchain.com/oss/python/langchain/structured-output
- LangChain Models: https://docs.langchain.com/oss/python/langchain/models
- LangChain Core Prompts Reference: https://reference.langchain.com/python/langchain_core/prompts/
- LangChain Core Runnables Reference: https://reference.langchain.com/python/langchain_core/runnables/
