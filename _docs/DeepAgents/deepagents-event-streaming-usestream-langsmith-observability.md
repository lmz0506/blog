---
layout: doc
title: "对话体验与可观测性：Event Streaming、前端 useStream 与 LangSmith 调试"
category: DeepAgents
date: '2026-07-31'
tags:
  - Event Streaming
  - useStream
  - LangSmith
  - 可观测性
---

# 对话体验与可观测性：Event Streaming、前端 useStream 与 LangSmith 调试

一个 DeepAgents 应用能在终端里回答问题，只能说明“Agent 可以运行”；要把它做成对话产品，还需要回答另外几个问题：

- 用户能否立即看到逐字输出，而不是等待几十秒后突然得到整段答案？
- 当前是在思考、调用工具，还是等待某个子代理？
- 长任务已经完成了哪些 Todo，下一步是什么？
- 高风险工具被暂停后，用户怎样批准、修改或拒绝？
- 页面上显示“失败”时，后端究竟运行到了哪个节点，模型、工具与子代理分别耗时多久？

这些问题分别落在两个相互关联的平面：

1. **交互平面**：DeepAgents/LangGraph 通过 event streaming 持续输出状态和事件，React 使用 `useStream` 将其投影成 Messages、Tool Calls、Todos、Subagents 与 Interrupts。
2. **观测平面**：LangSmith 保存一次运行的 trace，通过 run tree、输入输出、延迟、错误与 metadata 还原现场。

本文实现一条完整链路，并重点解释一个容易被忽略的原则：**事件流不是聊天文本的传输管道，而是 Agent 执行状态的增量协议。**

## 一、先建立事件、状态与 Trace 的心智模型

一次请求可以同时产生三类信息：

| 信息 | 典型内容 | 主要消费者 | 是否应持久化为 Agent 状态 |
| --- | --- | --- | --- |
| 状态增量 | `messages`、`todos`、审批中断 | 前端、线程存储 | 是 |
| 瞬时事件 | “正在检索第 2 个数据源”、进度百分比 | 前端进度面板 | 通常否 |
| Trace | 模型调用、工具参数、节点耗时、异常栈 | LangSmith、开发者 | 由 tracing 系统保存 |

三者不能混用。例如，把每个进度百分比都写进 `messages` 会污染上下文；只发送瞬时进度却不更新 Todo，会导致页面刷新后进度消失；把完整内部异常直接流给浏览器，又可能泄露密钥或敏感参数。

推荐的数据流如下：

```text
用户输入
   │
   ▼
LangGraph API / DeepAgents
   ├── messages stream ───────► Token 与最终消息
   ├── updates stream ────────► messages / todos / interrupts
   ├── custom stream ─────────► 子代理和工具的瞬时进度
   └── LangSmith tracing ─────► run tree、耗时、错误、元数据
                                      │
React useStream                         │
   ├── 对话区                           │
   ├── 工具调用卡片                     │
   ├── Todo 面板                        │
   ├── 子代理进度                       │
   └── 审批卡片 ◄──────────────────────┘ 调试时按 trace 关联
```

## 二、后端：让 Agent 输出可投影的事件

下面使用一个“市场研究助手”演示。主代理会拆分 Todo，将检索任务委派给 `researcher` 子代理，并在工具内部发出自定义进度事件。

### 2.1 安装与环境变量

```bash
pip install -U deepagents langgraph langgraph-api langchain langsmith
```

开发环境可设置：

```dotenv
OPENAI_API_KEY=你的模型密钥
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=你的_LangSmith_API_Key
LANGSMITH_PROJECT=deepagents-streaming-demo
```

`.env` 不应提交到仓库。线上环境还应通过网关鉴权，不能把模型或 LangSmith API Key 放进浏览器。

### 2.2 创建 Agent

新建 `assistant.py`：

```python
from __future__ import annotations

import asyncio
from typing import Any

from deepagents import create_deep_agent
from langchain_core.tools import tool
from langgraph.config import get_stream_writer


@tool
async def search_catalog(query: str) -> list[dict[str, Any]]:
    """检索公开资料目录，返回与 query 相关的条目。"""
    writer = get_stream_writer()

    writer(
        {
            "type": "subagent_progress",
            "agent": "researcher",
            "stage": "search",
            "message": f"开始检索：{query}",
            "completed": 0,
            "total": 3,
        }
    )

    # 示例用静态数据模拟三个数据源；实际项目可替换为搜索 API。
    sources = [
        {
            "title": "2026 行业规模摘要",
            "url": "https://example.com/market-size",
            "snippet": "行业仍在增长，企业侧采用速度更快。",
        },
        {
            "title": "用户调研摘要",
            "url": "https://example.com/user-study",
            "snippet": "用户最关注可靠性、可解释性与响应速度。",
        },
        {
            "title": "竞争格局摘要",
            "url": "https://example.com/competition",
            "snippet": "头部产品正在强化工作流与多代理能力。",
        },
    ]

    results: list[dict[str, Any]] = []
    for index, source in enumerate(sources, start=1):
        await asyncio.sleep(0.2)
        results.append(source)
        writer(
            {
                "type": "subagent_progress",
                "agent": "researcher",
                "stage": "search",
                "message": f"已检查数据源 {index}/{len(sources)}",
                "completed": index,
                "total": len(sources),
            }
        )

    return results


researcher = {
    "name": "researcher",
    "description": "检索和交叉检查公开资料；需要事实、来源或竞品信息时使用。",
    "system_prompt": (
        "你是一名研究子代理。先检索，再比较来源，最后返回带 URL 的简洁证据摘要。"
        "不要编造未出现在工具结果中的事实。"
    ),
    "tools": [search_catalog],
}


agent = create_deep_agent(
    system_prompt=(
        "你是市场研究负责人。复杂任务先写 Todo，再把资料检索委派给 researcher。"
        "在最终回答中区分事实、推断和待验证项，并保留来源 URL。"
    ),
    tools=[],
    subagents=[researcher],
)
```

`get_stream_writer()` 写出的数据进入 `custom` 流。它适合进度、阶段和可视化提示，不会自动成为对话消息。事件中显式携带 `type`、`agent`、`stage` 和进度值，是为了让前端不必根据自然语言猜测事件含义。

> 不同 DeepAgents 版本对 `subagents` 描述对象的可选字段可能略有差异，应以当前安装版本的类型定义为准；事件设计与前端投影方式不受影响。

### 2.3 暴露 LangGraph API

新建 `langgraph.json`：

```json
{
  "dependencies": ["."],
  "graphs": {
    "research_assistant": "./assistant.py:agent"
  },
  "env": ".env"
}
```

本地开发启动：

```bash
langgraph dev
```

默认情况下，React 应连接 LangGraph API，而不是自己在浏览器里调用模型。API 负责线程、checkpoint、事件流以及中断恢复。

## 三、在接前端之前，先看懂原始事件流

直接调用 Agent 是定位事件问题最快的方法。新建 `debug_stream.py`：

```python
from __future__ import annotations

import asyncio
import json
from typing import Any

from assistant import agent


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str, indent=2)


async def main() -> None:
    config = {
        "configurable": {"thread_id": "debug-thread-001"},
        "metadata": {
            "user_id": "local-debugger",
            "surface": "debug_stream.py",
        },
        "tags": ["stream-debug", "deepagents"],
    }

    async for event in agent.astream(
        {
            "messages": [
                {
                    "role": "user",
                    "content": "调研 Agent 产品的用户关注点，并给出三个结论。",
                }
            ]
        },
        config=config,
        stream_mode=["messages", "updates", "custom"],
        subgraphs=True,
    ):
        print(json_text(event))


if __name__ == "__main__":
    asyncio.run(main())
```

这里有三个 `stream_mode`：

- `messages`：模型消息/token 的增量，适合打字机效果。
- `updates`：图节点完成后产生的状态增量，适合更新 Messages、Todos 等持久状态。
- `custom`：工具或节点通过 stream writer 主动发出的业务事件，适合进度面板。

启用 `subgraphs=True` 后，事件还会携带 namespace，用来说明事件来自主图还是某个子图。不同 LangGraph 版本以及“单一/多个 stream mode”的返回外形并不完全相同，常见形式包括：

```python
(mode, data)
(namespace, data)
(namespace, mode, data)
```

因此，不建议在业务代码里硬编码“元组第 0 项永远是 mode”。前端优先使用 SDK 的 `useStream` 消化协议；只有编写自定义客户端时，才需要根据当前 SDK 版本集中做一次 normalize。

## 四、前端：用 useStream 管理线程和实时状态

安装 React SDK：

```bash
npm install @langchain/langgraph-sdk
```

下面给出一个完整的单文件页面。它包含：

- 用户消息与流式回答；
- AI 消息中的工具调用卡片；
- DeepAgents Todo 状态；
- 自定义子代理进度；
- Human-in-the-loop 中断的批准、拒绝与修改；
- 错误和停止生成操作。

### 4.1 完整的 `AgentChat.tsx`

```tsx
import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useStream } from "@langchain/langgraph-sdk/react";

type Message = {
  id?: string;
  type?: string;
  role?: string;
  content?: unknown;
  tool_calls?: Array<{
    id?: string;
    name: string;
    args: unknown;
  }>;
};

type Todo = {
  id?: string;
  content?: string;
  task?: string;
  status?: "pending" | "in_progress" | "completed" | string;
};

type AgentState = {
  messages: Message[];
  todos?: Todo[];
};

type ProgressEvent = {
  type: "subagent_progress";
  agent: string;
  stage: string;
  message: string;
  completed: number;
  total: number;
};

type InterruptValue = {
  action_requests?: Array<{
    name: string;
    args: Record<string, unknown>;
    description?: string;
  }>;
  review_configs?: Array<{
    action_name: string;
    allowed_decisions: string[];
  }>;
};

const API_URL =
  import.meta.env.VITE_LANGGRAPH_API_URL ?? "http://localhost:2024";
const ASSISTANT_ID = "research_assistant";

function textContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return JSON.stringify(content ?? "");

  return content
    .map((block) => {
      if (typeof block === "string") return block;
      if (
        block &&
        typeof block === "object" &&
        "text" in block &&
        typeof block.text === "string"
      ) {
        return block.text;
      }
      return "";
    })
    .join("");
}

function messageRole(message: Message): string {
  return message.role ?? message.type ?? "unknown";
}

function MessageCard({ message }: { message: Message }) {
  const calls = message.tool_calls ?? [];

  return (
    <article className={`message message--${messageRole(message)}`}>
      <div className="message__role">{messageRole(message)}</div>
      <div className="message__content">{textContent(message.content)}</div>

      {calls.map((call, index) => (
        <details className="tool-call" key={call.id ?? `${call.name}-${index}`}>
          <summary>工具调用：{call.name}</summary>
          <pre>{JSON.stringify(call.args, null, 2)}</pre>
        </details>
      ))}
    </article>
  );
}

function TodoPanel({ todos }: { todos: Todo[] }) {
  if (todos.length === 0) return null;

  return (
    <aside className="panel">
      <h2>任务计划</h2>
      <ol>
        {todos.map((todo, index) => (
          <li key={todo.id ?? index} data-status={todo.status ?? "pending"}>
            <span>{todo.content ?? todo.task ?? `任务 ${index + 1}`}</span>
            <small>{todo.status ?? "pending"}</small>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function SubagentPanel({
  events,
}: {
  events: Record<string, ProgressEvent>;
}) {
  const rows = Object.values(events);
  if (rows.length === 0) return null;

  return (
    <aside className="panel">
      <h2>子代理进度</h2>
      {rows.map((event) => {
        const percent =
          event.total > 0
            ? Math.round((event.completed / event.total) * 100)
            : 0;

        return (
          <div className="agent-progress" key={event.agent}>
            <div>
              <strong>{event.agent}</strong>
              <span>{event.message}</span>
            </div>
            <progress value={event.completed} max={event.total || 1} />
            <small>
              {event.stage} · {percent}%
            </small>
          </div>
        );
      })}
    </aside>
  );
}

function InterruptPanel({
  value,
  onDecision,
}: {
  value: InterruptValue;
  onDecision: (
    decision: "approve" | "reject" | "edit",
    editedArgs?: Record<string, unknown>,
  ) => void;
}) {
  const request = value.action_requests?.[0];
  const [editedText, setEditedText] = useState(
    JSON.stringify(request?.args ?? {}, null, 2),
  );

  if (!request) return null;

  const submitEdit = () => {
    try {
      onDecision("edit", JSON.parse(editedText));
    } catch {
      window.alert("修改后的参数必须是合法 JSON");
    }
  };

  return (
    <section className="interrupt">
      <h2>需要人工确认</h2>
      <p>{request.description ?? `Agent 请求执行 ${request.name}`}</p>
      <textarea
        aria-label="工具参数"
        rows={8}
        value={editedText}
        onChange={(event) => setEditedText(event.target.value)}
      />
      <div className="interrupt__actions">
        <button onClick={() => onDecision("approve")}>批准</button>
        <button onClick={submitEdit}>修改后执行</button>
        <button onClick={() => onDecision("reject")}>拒绝</button>
      </div>
    </section>
  );
}

export default function AgentChat() {
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | undefined>();
  const [progress, setProgress] = useState<
    Record<string, ProgressEvent>
  >({});

  const stream = useStream<AgentState>({
    apiUrl: API_URL,
    assistantId: ASSISTANT_ID,
    threadId,
    onThreadId: setThreadId,
    messagesKey: "messages",
    streamSubgraphs: true,
    onCustomEvent: (event: unknown) => {
      if (
        event &&
        typeof event === "object" &&
        "type" in event &&
        event.type === "subagent_progress"
      ) {
        const item = event as ProgressEvent;
        setProgress((current) => ({
          ...current,
          [item.agent]: item,
        }));
      }
    },
  });

  const messages = stream.messages ?? [];
  const todos = stream.values.todos ?? [];

  // SDK 版本不同，中断可能是单个对象或数组；在一处兼容即可。
  const currentInterrupt = useMemo(() => {
    const raw = stream.interrupt;
    if (!raw) return undefined;
    const first = Array.isArray(raw) ? raw[0] : raw;
    if (
      first &&
      typeof first === "object" &&
      "value" in first
    ) {
      return first.value as InterruptValue;
    }
    return first as InterruptValue;
  }, [stream.interrupt]);

  const send = (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || stream.isLoading) return;

    setInput("");
    setProgress({});
    stream.submit({
      messages: [{ role: "user", content }],
    });
  };

  const resume = (
    type: "approve" | "reject" | "edit",
    editedArgs?: Record<string, unknown>,
  ) => {
    const decision =
      type === "approve"
        ? { type: "approve" }
        : type === "reject"
          ? {
              type: "reject",
              message: "用户拒绝执行此操作，请调整方案。",
            }
          : {
              type: "edit",
              edited_action: {
                name:
                  currentInterrupt?.action_requests?.[0]?.name ??
                  "unknown",
                args: editedArgs ?? {},
              },
            };

    stream.submit(
      {},
      {
        command: {
          resume: { decisions: [decision] },
        },
      },
    );
  };

  return (
    <main className="agent-layout">
      <section className="chat">
        <header>
          <h1>研究助手</h1>
          <small>thread: {threadId ?? "尚未创建"}</small>
        </header>

        <div className="messages" aria-live="polite">
          {messages.map((message, index) => (
            <MessageCard
              key={message.id ?? index}
              message={message as Message}
            />
          ))}
        </div>

        {currentInterrupt && (
          <InterruptPanel value={currentInterrupt} onDecision={resume} />
        )}

        {stream.error && (
          <div role="alert">
            请求失败：{String(stream.error)}
          </div>
        )}

        <form onSubmit={send}>
          <textarea
            aria-label="消息"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入一个研究任务……"
          />
          <button disabled={!input.trim() || stream.isLoading}>
            {stream.isLoading ? "运行中" : "发送"}
          </button>
          {stream.isLoading && (
            <button type="button" onClick={() => stream.stop()}>
              停止
            </button>
          )}
        </form>
      </section>

      <section className="sidebars">
        <TodoPanel todos={todos} />
        <SubagentPanel events={progress} />
      </section>
    </main>
  );
}
```

这段代码中最重要的不是 JSX，而是四种投影方式：

1. `stream.messages` 是 SDK 已聚合的消息视图。流式 token 不应由业务代码手工拼接，否则重连、重放时很容易重复。
2. `stream.values.todos` 是当前状态快照。Todo 更新应以最新 state 为准，而不是把每个 update 永久追加到数组。
3. `onCustomEvent` 接收瞬时进度。示例按 `agent` 覆盖最新事件，所以同一个子代理只占一行。
4. `stream.interrupt` 是暂停点。恢复时发送 `command.resume`，而不是创建一条“我批准了”的普通用户消息。

如果当前 SDK 的类型签名与示例有细微差异，优先查看安装版本中 `useStream` 的类型定义。尤其是 `interrupt` 的单值/数组形式，以及 `onCustomEvent` 回调的第二个 metadata 参数，都曾随版本演进；应把兼容代码限制在适配层，不要散落在所有组件中。

### 4.2 工具调用为什么属于消息投影

模型发起工具调用时，AI Message 通常包含 `tool_calls`，工具执行完成后又产生 Tool Message。前端可以将二者组合成一张卡片：

```text
AI Message: tool_calls=[{ id: "call_1", name: "search_catalog", args: ... }]
                                 │
                                 ▼ 按 tool_call_id 关联
Tool Message: tool_call_id="call_1", content="[...]"
```

生产实现应优先按 `tool_call_id` 关联，而不是按数组位置。工具可能并行运行，完成顺序并不保证与发起顺序一致。工具参数默认折叠，敏感字段应在服务端脱敏后再进入事件流。

### 4.3 子代理面板的两种数据源

子代理进度可以来自：

- **namespace/运行 metadata**：能够准确反映子图开始、输出和结束，适合通用调试器；
- **自定义业务事件**：包含产品需要的阶段、总数和可读文案，适合面向用户的进度面板。

本文选择自定义事件作为 UI 契约，同时开启 `streamSubgraphs` 以获得完整子图事件。不要把 namespace 字符串直接展示给用户：它通常含运行 ID，适合关联和调试，却不一定稳定或可读。

如果多个同名子代理并行，事件键不能只用 `agent`，应由后端增加 `task_id`：

```json
{
  "type": "subagent_progress",
  "agent": "researcher",
  "task_id": "competitor-analysis",
  "stage": "search",
  "completed": 2,
  "total": 3,
  "message": "已检查 2/3 个数据源"
}
```

前端再使用 `${agent}:${task_id}` 作为稳定键。

## 五、Interrupt：流结束不一定代表任务结束

当工具配置了 Human-in-the-loop 审批，图会在执行工具之前产生 interrupt 并保存 checkpoint。此时：

- `isLoading` 可能变回 `false`；
- 线程仍然存在，任务也没有失败；
- UI 必须展示待审批动作；
- 用户决策必须提交回原 thread；
- 恢复运行使用 `Command(resume=...)` 对应的 API 语义。

DeepAgents 常见决策为：

```json
{ "type": "approve" }
```

```json
{
  "type": "edit",
  "edited_action": {
    "name": "send_email",
    "args": {
      "to": "reviewer@example.com",
      "subject": "修改后的主题"
    }
  }
}
```

```json
{
  "type": "reject",
  "message": "不要发送邮件，请只生成草稿。"
}
```

具体 payload 应以中断中返回的 `review_configs.allowed_decisions` 为准。前端不应擅自展示后端没有允许的操作。恢复按钮还要防止双击，因为相同 checkpoint 被重复恢复可能造成重复副作用。

## 六、把 LangSmith Trace 与前端线程关联起来

开启 tracing 后，模型、工具、图节点和子代理运行会形成 run tree。只有“打开 LangSmith”还不够；要快速定位一次用户投诉，必须能从产品侧找到对应 trace。

### 6.1 写入可检索的 metadata 与 tags

直接调用 Agent 时，可以在 config 中附加：

```python
config = {
    "configurable": {
        "thread_id": "thread-01HXYZ",
    },
    "metadata": {
        "user_id": "user-1842",
        "conversation_id": "conversation-9001",
        "release": "web-2026.07.31",
        "surface": "research-chat",
    },
    "tags": [
        "production",
        "deepagents",
        "research-assistant",
    ],
}
```

通过 LangGraph API 运行时，至少应在应用日志中记录：

- `thread_id`；
- assistant/graph ID；
- 前端生成的 request ID；
- 当前 release 或 commit 标识；
- LangSmith trace/run ID（SDK 或回调能够取得时）。

不要把姓名、邮件正文、访问令牌等敏感数据直接放入 tags。tags 更适合低基数分类，metadata 适合精确筛选；高基数的 ID 全塞进 tags 会让查询和统计变得混乱。

### 6.2 在前端生成 request ID

用户每次提交前生成 ID，并通过允许的配置通道传给服务端：

```ts
const requestId = crypto.randomUUID();

stream.submit(
  {
    messages: [{ role: "user", content }],
  },
  {
    config: {
      metadata: {
        client_request_id: requestId,
        surface: "research-chat",
      },
    },
  },
);
```

是否允许客户端 metadata 透传，应由服务端配置决定。服务端必须覆盖可信字段，例如真实 `user_id` 与租户 ID，不能信任浏览器自行声明的身份。

### 6.3 用 Trace 回答四类问题

在 LangSmith 中打开一次 trace，建议按以下顺序排查：

1. **结果错误**：先看最终 state 和消息，再向上追溯相关模型输入、工具返回和子代理输出。
2. **响应很慢**：看首 token 延迟、各模型调用耗时、工具耗时以及子代理是否串行执行。
3. **工具重复执行**：确认模型是否产生重复 tool call、interrupt 是否重复 resume、客户端是否重复 submit。
4. **页面没有进度**：确认工具 run 是否存在；若存在，再检查 `custom` 事件是否发出、API 是否订阅对应 mode、`onCustomEvent` 是否被触发。

Trace 展示的是执行真相，前端展示的是用户视图。二者通过 `thread_id`、request ID 与时间范围关联，调试效率会远高于只看浏览器控制台。

## 七、建立一套可操作的流式调试方法

### 7.1 没有逐字输出

按数据链路从里到外检查：

1. 模型是否支持 streaming；
2. `astream` 是否订阅 `messages`；
3. LangGraph API 是否保持流式响应，没有被反向代理缓冲；
4. `useStream` 是否指向正确 assistant；
5. UI 是否直接使用 SDK 聚合后的 `messages`。

如果后端原始脚本能看到 token，而浏览器只能一次得到整段，多半是 API、代理缓冲或前端订阅问题，而不是模型问题。

### 7.2 Messages 重复

常见原因是业务代码把 token 追加成消息，同时又接收最终消息。正确做法是让 `useStream` 根据 message ID 合并流式 chunk；自定义 reducer 也必须按稳定 ID upsert。

### 7.3 Todo 回退或乱序

不要假设网络到达的每个瞬时事件都代表新的持久状态。Todo 面板应读取 `stream.values.todos` 的最新快照。若应用允许多个并发 run 修改同一 thread，还要在产品层禁止冲突提交或实现版本控制。

### 7.4 子代理一直显示“运行中”

自定义进度协议最好增加终态：

```json
{
  "type": "subagent_status",
  "agent": "researcher",
  "task_id": "competitor-analysis",
  "status": "completed",
  "message": "研究摘要已返回"
}
```

同时处理 `failed` 与 `cancelled`。只发送百分比而没有终态，异常时 UI 就无法收口。还可以用子图结束事件作为兜底，但业务事件更容易生成面向用户的说明。

### 7.5 Interrupt 刷新后消失

Interrupt 属于线程 checkpoint，而不应只存在 React 本地 state。页面刷新后要用同一 `threadId` 恢复线程状态，并重新读取待处理中断。thread ID 应进入路由、服务端会话或可靠的本地存储，具体取决于产品的访问控制模型。

### 7.6 LangSmith 有 Trace，但找不到用户那一次

通常是关联字段不足。至少统一记录：

```text
frontend request_id
        ↕
LangGraph thread_id
        ↕
LangSmith trace/run_id
```

再加入 `release`、`assistant_id` 和服务端认证得到的 `user_id`，就能把一次页面操作、应用日志与 run tree 串起来。

## 八、生产化时必须补上的边界

### 8.1 断线、重连与幂等

流式连接断开不等于后端 run 已取消。重连前应先查询线程/run 状态，不要立刻重复提交用户消息。所有有外部副作用的工具——付款、发信、建工单——都应接受幂等键。

### 8.2 背压与事件采样

工具每处理一条记录就发事件，在万级任务里会淹没浏览器。可以按以下方式限流：

- 每 N 条或每 200～500 ms 发一次进度；
- 阶段变化立即发；
- 错误与终态立即发；
- 日志明细写入 observability 系统，不全部推给用户。

### 8.3 数据脱敏

三个出口都要审查：

- Message 和 Tool Message 中是否包含密钥、内部提示词或个人信息；
- custom event 是否携带原始文档内容；
- LangSmith tracing 是否记录不应离开业务域的数据。

必要时在工具返回、事件 writer 和 tracing 配置三个层面分别做脱敏。隐藏前端字段不是安全措施，因为数据已经到达浏览器。

### 8.4 取消语义

`stream.stop()` 首先停止客户端继续消费；后端运行是否同步取消，取决于部署与 SDK 的取消实现。涉及成本或副作用时，要验证服务端 run 状态，而不能只根据按钮变回“发送”判断任务已终止。

### 8.5 UI 不暴露内部思维链

进度面板应展示可验证的操作事实，例如“正在检索”“已读取 3 个来源”“等待审批”，而不是输出模型隐藏推理。良好的可观测性来自结构化事件与 trace，不依赖泄露内部思维过程。

## 九、建议的组件与事件契约

随着项目扩大，可以将单文件示例拆分为：

```text
AgentChat
├── MessageList
│   ├── MessageCard
│   └── ToolCallCard
├── Composer
├── TodoPanel
├── SubagentPanel
├── InterruptPanel
└── RunStatusBar
```

后端自定义事件采用版本化 envelope：

```json
{
  "schema_version": 1,
  "type": "subagent_progress",
  "event_id": "evt_01",
  "timestamp": "2026-07-31T10:30:00Z",
  "agent": "researcher",
  "task_id": "competitor-analysis",
  "payload": {
    "stage": "search",
    "completed": 2,
    "total": 3,
    "message": "已检查 2/3 个数据源"
  }
}
```

版本化的好处是后端增加字段时，旧前端仍可忽略未知字段；真正发生不兼容变化时，则可以显式升级 `schema_version`。`event_id` 还可以用于重连后的去重。

## 十、上线前检查清单

- Messages 能逐步显示，刷新后与 checkpoint 一致。
- Tool Call 使用稳定 ID 关联结果，并对敏感参数脱敏。
- Todos 来自持久状态快照，而不是只存在组件本地。
- 子代理事件包含 `agent`、`task_id`、阶段、进度和终态。
- Interrupt 能批准、修改、拒绝，且恢复到原 thread。
- 双击提交和重复 resume 不会产生重复副作用。
- 断线重连不会自动重复用户请求。
- 浏览器没有模型或 LangSmith 密钥。
- LangSmith 能按 thread/request/release 定位一次运行。
- Trace 中可以区分模型、工具、主代理与子代理耗时。
- custom event 有采样或节流，不会形成事件风暴。
- 用户界面只展示操作进度，不暴露内部思维链。

## 总结

DeepAgents 的对话产品化不是给最终答案加一个打字机动画。完整体验来自三层配合：

- **event streaming** 提供 Messages、状态增量、自定义进度和子图事件；
- **`useStream`** 管理 thread、合并消息、投影 Todos/Tool Calls/Subagents，并通过 command 恢复 Interrupt；
- **LangSmith tracing** 记录执行树，用 thread ID、request ID 和 release metadata 将用户界面与后端现场关联。

把状态与瞬时事件分开、把自定义事件设计成稳定协议、把 trace 关联字段从第一天就纳入架构，才能让长时间、多工具、多子代理的运行既对用户透明，也对开发者可调试。当 UI 显示的每一个状态都能在事件流中解释、在 Trace 中追溯时，一个“能运行的 Agent”才真正成为“可运营的对话产品”。
