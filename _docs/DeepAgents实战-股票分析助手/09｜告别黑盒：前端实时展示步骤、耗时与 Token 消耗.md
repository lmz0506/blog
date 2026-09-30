---
layout: doc
title: '09｜告别黑盒：前端实时展示步骤、耗时与 Token 消耗'
category: DeepAgents实战-股票分析助手
date: '2026-09-30'
tags:
  - DeepAgents
  - SSE
  - 可观测性
  - Token统计
---

用户点击“开始分析”以后，页面如果只有一个旋转图标，就无法回答几个最基本的问题：现在分析到了哪里？为什么迟迟没有结果？是在等待行情接口，还是正在生成报告？这次分析用了多少 Token？

本篇为股票分析助手增加独立的运行追踪链路：后端用统一事件协议记录任务规划、模型请求和工具调用，前端通过 SSE 实时更新时间线，并提供可展开的输入输出摘要、错误信息以及耗时和 Token 统计。

这里的“透明”是展示任务计划、外部工具交互和执行状态，不是展示模型内部思维链。报告结论仍需要行情时间、信息来源和风险提示支撑；进度条本身不代表结论可靠。

## 一、先把一次分析定义为 Run

一次分析请求对应一个 `run_id`，一个 Run 包含多个 Step。模型请求、行情查询、搜索新闻、保存报告都可以成为 Step。

最少需要区分三种标识：

| 字段 | 含义 | 示例 |
| --- | --- | --- |
| `run_id` | 一次用户分析请求 | UUID |
| `step_id` | 一次具体调用 | LangChain callback run ID |
| `parent_step_id` | 父调用，用于表达嵌套关系 | 上级 callback run ID |
| `seq` | 当前 Run 内单调递增的事件序号 | 1、2、3 |

同一个工具被调用两次，必须得到两个不同的 `step_id`。同一调用失败后的重试也应该单独记录，不能因为工具名称相同就覆盖原来的记录。

`parent_step_id` 可能指向框架内部未展示的 Chain。页面可以先按事件顺序排列；如果需要调用树，应补采集 Chain 回调，或在适配层把父节点映射到最近的可见节点，不能假设父节点总在页面上。

### 状态与时间的口径

Run 的状态是 `running → completed / failed`；Step 的状态是 `running → completed / failed`。取消、排队和跳过可在生产版本中扩展为额外状态。

- `timestamp` 是 UTC 墙上时间，负责展示和跨系统关联。
- `duration_ms` 使用后端单调时钟计算，负责真实耗时。
- Run 总耗时是从分析开始到终止的墙钟耗时，不等于步骤耗时之和。
- 模型请求、并行工具和子 Agent 可以相互重叠，所以步骤求和往往大于 Run 总耗时。

Token 是另一个独立指标：调用运行中显示“等待结算”；模型返回 usage 后才累计，不能把尚未返回的统计显示成确定的零消耗。

## 二、定义可以演进的事件协议

所有事件使用同一个 envelope：

```json
{
  "schema_version": 1,
  "run_id": "478e…",
  "seq": 8,
  "type": "step.finished",
  "timestamp": "2026-09-30T08:30:12.123+00:00",
  "elapsed_ms": 2350,
  "step_id": "model-call-2",
  "parent_step_id": null,
  "data": {
    "status": "completed",
    "duration_ms": 1450,
    "output_summary": "已生成股票分析报告",
    "usage": {
      "input_tokens": 620,
      "output_tokens": 210,
      "total_tokens": 830
    }
  }
}
```

事件类型保持精简：

| 类型 | 用途 |
| --- | --- |
| `run.started` | 初始化 Run |
| `plan.updated` | 更新当前任务清单 |
| `step.started` | 新建模型或工具步骤 |
| `step.finished` | 更新步骤结果、耗时和可用 usage |
| `step.failed` | 展示步骤错误 |
| `usage.updated` | 发布整个 Run 的累计 Token 快照 |
| `run.completed` | 发布最终报告摘要和终态耗时 |
| `run.failed` | 发布运行级错误和终态耗时 |

`usage.updated` 采用**累计快照**而不是增量。浏览器重连时即使收到重放数据，也不会再次把同一批 Token 加入总数。前端还必须按照 `seq` 去重。

SSE 帧使用 `seq` 作为 `id`，业务类型放在 JSON 中：

```text
id: 8
data: {"schema_version":1,"run_id":"478e…","seq":8,"type":"step.finished",...}

```

这里只使用默认的 `message` 事件，前端通过 `onmessage` 接收。若后端增加 `event: step.finished`，前端也必须改用 `addEventListener("step.finished", ...)`，否则看起来会像事件丢失。

## 三、为什么本例选择 SSE

股票分析的主要实时数据是“服务端向浏览器推送进度”。请求创建使用 POST，事件订阅使用 GET，SSE 足够直接，也支持浏览器自动重连。

WebSocket 更适合持续双向交互，例如分析过程中频繁确认工具权限、发送语音或修改执行参数。取消 Run 则可以单独增加一个 POST 接口，不必仅为一个取消按钮引入 WebSocket。

本例使用以下接口：

```text
POST /api/runs                  创建分析，返回 run_id
GET  /api/runs/{run_id}/events  订阅事件并支持重放
GET  /                          展示追踪页面
```

下面给出两个完整文件。默认模式使用**明确标记的演示行情和演示 Token 数值**，可以在没有 API Key 时检查页面交互；打开真实模式后，才调用 DeepAgents 并从模型响应中提取 usage。

这些文件应放入股票分析助手应用的同一个目录；它们是文章中的应用示例，不需要在博客仓库内执行。

## 四、完整后端：事件日志、SSE 与 DeepAgents 适配

安装示例依赖：

```bash
python -m pip install fastapi "uvicorn[standard]" deepagents langchain-openai
```

示例采用 `create_deep_agent`、异步 `ainvoke` 和 LangChain `AsyncCallbackHandler` 的公开接口。DeepAgents 与模型适配包更新较快，项目落地时应锁定自己验证过的依赖版本；不同供应商是否返回 usage，需要单独核对。

保存为 `main.py`，文件编码使用 UTF-8：

```python
import asyncio
import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel, Field
from langchain_core.callbacks import AsyncCallbackHandler

app = FastAPI()
BASE = Path(__file__).resolve().parent
TERMINAL = {"run.completed", "run.failed"}
RUNS: dict[str, "Run"] = {}
TASKS: set[asyncio.Task] = set()


def summary(value: Any, limit: int = 1400) -> str:
    # 本例只允许公开股票问题及公开演示数据进入事件流。
    # 真实系统应在这里做字段白名单和脱敏，再做截断。
    if isinstance(value, str):
        text = value
    else:
        text = json.dumps(value, ensure_ascii=False, default=str)
    return text if len(text) <= limit else text[:limit] + "…[已截断]"


@dataclass
class Run:
    id: str
    started: float = field(default_factory=time.perf_counter)
    events: list[dict] = field(default_factory=list)
    condition: asyncio.Condition = field(default_factory=asyncio.Condition)
    done: bool = False
    totals: dict = field(default_factory=lambda: {
        "input_tokens": 0, "output_tokens": 0, "total_tokens": 0,
        "accounted_calls": 0, "unknown_calls": 0,
    })
    counted: set[str] = field(default_factory=set)

    async def emit(self, kind: str, data: dict,
                   step_id: str | None = None,
                   parent_step_id: str | None = None):
        async with self.condition:
            if self.done:
                return
            event = {
                "schema_version": 1,
                "run_id": self.id,
                "seq": len(self.events) + 1,
                "type": kind,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "elapsed_ms": round((time.perf_counter() - self.started) * 1000),
                "step_id": step_id,
                "parent_step_id": parent_step_id,
                "data": data,
            }
            self.events.append(event)
            if kind in TERMINAL:
                self.done = True
            self.condition.notify_all()

    async def account(self, call_id: str, usage: dict | None):
        # 去重边界是底层模型调用，不是 AIMessage ID 或步骤名称。
        # 此段在一个事件循环中执行，第一次 await 之前完成更新。
        if call_id in self.counted:
            return
        self.counted.add(call_id)
        if usage is None:
            self.totals["unknown_calls"] += 1
        else:
            for key in ("input_tokens", "output_tokens", "total_tokens"):
                self.totals[key] += usage[key]
            self.totals["accounted_calls"] += 1
        await self.emit("usage.updated", dict(self.totals))


def normalize_usage(raw: Any) -> dict | None:
    if not isinstance(raw, dict):
        return None
    inp = raw.get("input_tokens", raw.get("prompt_tokens"))
    out = raw.get("output_tokens", raw.get("completion_tokens"))
    if inp is None or out is None:
        return None
    # 不把缺失 usage 当成 0；0 本身可能是供应商合法返回值。
    try:
        inp, out = int(inp), int(out)
        total = int(raw.get("total_tokens", inp + out))
    except (TypeError, ValueError):
        return None
    if min(inp, out, total) < 0:
        return None
    return {"input_tokens": inp, "output_tokens": out, "total_tokens": total}


def extract_usage(result: Any) -> dict | None:
    # 本示例每次模型请求只有一个输入和一个候选回答。
    # 优先使用标准化 AIMessage.usage_metadata；不可与 llm_output 叠加。
    generations = getattr(result, "generations", [])
    for group in generations:
        for generation in group:
            message = getattr(generation, "message", None)
            usage = normalize_usage(getattr(message, "usage_metadata", None))
            if usage is not None:
                return usage
    output = getattr(result, "llm_output", None) or {}
    return normalize_usage(output.get("token_usage") or output.get("usage"))


class TraceCallbacks(AsyncCallbackHandler):
    def __init__(self, run: Run):
        self.run = run
        self.active: dict[str, dict] = {}

    async def start(self, run_id, parent_run_id, kind, name, value):
        sid = str(run_id)
        if sid in self.active:
            return
        parent = str(parent_run_id) if parent_run_id else None
        self.active[sid] = {
            "started": time.perf_counter(), "parent": parent,
            "kind": kind, "name": name, "input": value,
        }
        await self.run.emit("step.started", {
            "kind": kind, "name": name, "input_summary": summary(value),
            "status": "running",
        }, sid, parent)

    async def finish(self, run_id, value, usage=None, error=None):
        sid = str(run_id)
        info = self.active.pop(sid, None)
        if info is None:
            return
        data = {
            "status": "failed" if error is not None else "completed",
            "duration_ms": round((time.perf_counter() - info["started"]) * 1000),
            "output_summary": summary(value) if error is None else "",
        }
        if error is not None:
            # 避免异常文本中的 Key、URL 查询参数等泄漏到浏览器。
            data["error"] = {
                "code": type(error).__name__,
                "message": "调用失败，请使用 run_id 查询受控后端日志。",
            }
        if info["kind"] == "model":
            data["usage"] = usage
            await self.run.account(sid, usage)
        await self.run.emit(
            "step.failed" if error is not None else "step.finished",
            data, sid, info["parent"],
        )
        if error is None and info["name"] == "write_todos":
            source = info["input"]
            if isinstance(source, str):
                try:
                    source = json.loads(source)
                except json.JSONDecodeError:
                    source = {}
            todos = source.get("todos") if isinstance(source, dict) else None
            if isinstance(todos, list):
                # 从成功的规划工具输入提取快照，不解析模型自然语言。
                await self.run.emit("plan.updated", {"todos": todos})

    async def on_chat_model_start(self, serialized, messages, *, run_id,
                                  parent_run_id=None, **kwargs):
        # 默认不上传完整提示词、系统消息或用户的潜在敏感内容。
        await self.start(run_id, parent_run_id, "model", "chat_model", {
            "message_count": sum(len(batch) for batch in messages)
        })

    async def on_llm_start(self, serialized, prompts, *, run_id,
                           parent_run_id=None, **kwargs):
        await self.start(run_id, parent_run_id, "model", "llm", {
            "prompt_count": len(prompts)
        })

    async def on_llm_end(self, response, *, run_id, **kwargs):
        # 输出内容可能包含 reasoning 字段，只展示完成摘要。
        await self.finish(run_id, "模型请求完成", extract_usage(response))

    async def on_llm_error(self, error, *, run_id, **kwargs):
        await self.finish(run_id, None, error=error)

    async def on_tool_start(self, serialized, input_str, *, run_id,
                            parent_run_id=None, inputs=None, **kwargs):
        name = (serialized or {}).get("name", "tool")
        await self.start(run_id, parent_run_id, "tool", name,
                         inputs if inputs is not None else input_str)

    async def on_tool_end(self, output, *, run_id, **kwargs):
        # 框架可能把工具异常转为带 error 状态的 ToolMessage。
        if getattr(output, "status", None) == "error":
            await self.finish(run_id, None, error=RuntimeError("tool error"))
        else:
            await self.finish(run_id, getattr(output, "content", output))

    async def on_tool_error(self, error, *, run_id, **kwargs):
        await self.finish(run_id, None, error=error)

    async def fail_open_steps(self, error):
        for sid in list(self.active):
            await self.finish(sid, None, error=error)


async def demo(run: Run):
    await run.emit("plan.updated", {"todos": [
        {"content": "读取演示行情", "status": "in_progress"},
        {"content": "生成示例报告", "status": "pending"},
    ]})
    callbacks = TraceCallbacks(run)
    sid = str(uuid4())
    await callbacks.start(sid, None, "tool", "demo_quote", {"symbol": "DEMO"})
    await asyncio.sleep(0.7)
    await callbacks.finish(sid, {"price": 100, "source": "虚构演示行情"})
    await run.emit("plan.updated", {"todos": [
        {"content": "读取演示行情", "status": "completed"},
        {"content": "生成示例报告", "status": "in_progress"},
    ]})
    sid = str(uuid4())
    await callbacks.start(sid, None, "model", "demo_model", "根据演示数据生成报告")
    await asyncio.sleep(1)
    await callbacks.finish(sid, "示例报告完成", {
        "input_tokens": 120, "output_tokens": 80, "total_tokens": 200,
    })
    await run.emit("plan.updated", {"todos": [
        {"content": "读取演示行情", "status": "completed"},
        {"content": "生成示例报告", "status": "completed"},
    ]})
    return "【演示报告】行情和 Token 都是演示值，不构成投资建议。"


async def real_analysis(run: Run, question: str):
    from deepagents import create_deep_agent
    from langchain_openai import ChatOpenAI

    def demo_quote(symbol: str) -> dict:
        """返回虚构行情，仅用于验证分析追踪，不能用于投资判断。"""
        return {"symbol": symbol, "price": 100, "source": "虚构演示行情"}

    model = ChatOpenAI(model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"))
    agent = create_deep_agent(
        model=model,
        tools=[demo_quote],
        system_prompt=(
            "你是股票分析教学助手。先用 write_todos 规划，并及时更新状态。"
            "使用 demo_quote 获取演示数据。报告必须明确行情是虚构数据，"
            "只展示数据依据、结论与风险，不披露内部思维链。"
        ),
    )
    callbacks = TraceCallbacks(run)
    try:
        result = await agent.ainvoke(
            {"messages": [{"role": "user", "content": question}]},
            config={"callbacks": [callbacks], "recursion_limit": 60,
                    "metadata": {"analysis_run_id": run.id}},
        )
        messages = result.get("messages", [])
        content = messages[-1].content if messages else "分析结束，未返回报告。"
        # 最终报告不再次累计 Token；底层模型回调已经负责统计。
        return summary(content, 6000)
    except BaseException as exc:
        # 包含外层超时导致的取消，关闭尚未终止的可见步骤。
        await callbacks.fail_open_steps(exc)
        raise


async def execute(run: Run, question: str):
    real = os.getenv("TRACE_REAL") == "1"
    await run.emit("run.started", {
        "mode": "真实模型＋演示行情" if real else "演示行情＋演示Token",
        "question_summary": summary(question),
    })
    try:
        work = real_analysis(run, question) if real else demo(run)
        report = await asyncio.wait_for(work, timeout=180)
        await run.emit("run.completed", {"report_summary": report})
    except Exception as exc:
        await run.emit("run.failed", {"error": {
            "code": type(exc).__name__,
            "message": "分析未完成，请使用 run_id 查询受控后端日志。",
        }})


class CreateRun(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


@app.get("/", response_class=HTMLResponse)
async def index():
    return HTMLResponse((BASE / "index.html").read_text(encoding="utf-8"))


@app.post("/api/runs", status_code=202)
async def create_run(body: CreateRun):
    run = Run(id=str(uuid4()))
    RUNS[run.id] = run
    task = asyncio.create_task(execute(run, body.question))
    TASKS.add(task)  # 保持强引用，任务生命周期不依赖 SSE 连接。
    task.add_done_callback(TASKS.discard)
    return {"run_id": run.id, "events_url": f"/api/runs/{run.id}/events"}


@app.get("/api/runs/{run_id}/events")
async def events(run_id: str, request: Request):
    run = RUNS.get(run_id)
    if run is None:
        raise HTTPException(404, "Run 不存在或已过期")
    try:
        # 浏览器自动重连携带 Last-Event-ID；手动重建连接可用 after。
        cursor = int(request.headers.get("last-event-id")
                     or request.query_params.get("after", "0"))
    except ValueError:
        raise HTTPException(400, "事件游标格式错误")
    if cursor < 0 or cursor > len(run.events):
        raise HTTPException(400, "事件游标超出范围")

    async def stream():
        nonlocal cursor
        while True:
            if await request.is_disconnected():
                return
            async with run.condition:
                # 检查日志和进入等待共享同一把锁，避免丢掉唤醒。
                if cursor >= len(run.events) and not run.done:
                    try:
                        await asyncio.wait_for(run.condition.wait(), timeout=15)
                    except asyncio.TimeoutError:
                        pass
                batch = run.events[cursor:]
                done = run.done
            # 不在锁内向网络写数据，慢客户端不能阻塞事件生产者。
            for event in batch:
                cursor = event["seq"]
                payload = json.dumps(event, ensure_ascii=False)
                yield f"id: {cursor}\ndata: {payload}\n\n"
            if done:
                return
            if not batch:
                yield ": heartbeat\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })
```

### 回调是如何接上 DeepAgents 的

`ainvoke(..., config={"callbacks": [...]})` 把追踪处理器传入本次执行，标准 LangChain Runnable 调用通常会把 callback 上下文传给模型与工具。回调中的 `run_id` 是**某次底层调用 ID**，不是我们创建的分析 Run ID；适配器通过保存 `self.run` 把两者关联。

如果自己写子 Agent 或自定义 Runnable，要继续向下传递 `config`。通过独立进程或外部服务发起的工作，不会自动出现在这些回调中，需要额外传播分析 Run ID 并接入相同事件协议。

示例把 `write_todos` 成功调用中的 `todos` 当成计划快照。规划项与工具调用不是一对一关系：一个计划可能需要调用多个工具，一个工具也可能服务多个计划。本例将计划面板和实际调用时间线分别展示，避免用模型自然语言推测两者关系。

示例统计的是框架暴露的模型调用。模型 SDK 内部自动重试如果没有发出独立回调，就无法从这一层完整还原每次 HTTP 尝试；需要接入 SDK 或供应商网关日志才能进一步追踪。

## 五、完整前端：时间线、详情与实时指标

保存为同目录下的 `index.html`，使用 UTF-8。页面无第三方前端依赖，接收事件后按 `step_id` 更新条目，按 `seq` 去重，直接展示后端返回的累计快照。

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>股票分析运行追踪</title>
  <style>
    body { max-width: 1060px; margin: 32px auto; padding: 0 16px;
      font: 16px/1.6 system-ui, sans-serif; color: #182235; background: #f5f7fa; }
    form { display: flex; gap: 12px; flex-wrap: wrap; }
    input { flex: 1; min-width: 220px; padding: 10px; }
    button { padding: 10px 20px; cursor: pointer; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr));
      gap: 12px; margin: 20px 0; }
    .card, details { background: white; border: 1px solid #d7deea;
      border-radius: 8px; padding: 14px; }
    details { margin-bottom: 10px; border-left: 5px solid #52657c; }
    details[data-state="running"] { border-left-color: #2869c7; }
    details[data-state="completed"] { border-left-color: #21804a; }
    details[data-state="failed"] { border-left-color: #bb3434; }
    summary { cursor: pointer; overflow-wrap: anywhere; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; font: 14px/1.6 monospace; }
    #error { color: #a51e1e; }
    small { color: #536176; }
  </style>
</head>
<body>
  <h1>股票分析运行追踪</h1>
  <p>计划、模型调用与工具结果实时展示；默认使用演示数据。</p>
  <form id="form">
    <label for="question">分析问题</label>
    <input id="question" required maxlength="2000" value="分析 DEMO 股票并给出风险提示">
    <button id="submit">开始分析</button>
  </form>
  <p id="connection" role="status" aria-live="polite">尚未开始</p>
  <small id="identity"></small>
  <div class="metrics">
    <div class="card" id="elapsed">总耗时：—</div>
    <div class="card" id="tokens">Token：等待统计</div>
    <div class="card" id="calls">模型统计覆盖：—</div>
  </div>
  <p id="error" role="alert"></p>
  <h2>任务规划</h2>
  <ul id="plan"></ul>
  <h2>执行时间线</h2>
  <div id="timeline"></div>
  <h2>报告摘要</h2>
  <pre id="report" class="card">等待分析</pre>
<script>
const $ = id => document.getElementById(id);
const states = {running:"执行中", completed:"已完成", failed:"失败",
  pending:"待开始", in_progress:"执行中"};
const steps = new Map();
let source = null, activeRun = null, lastSeq = 0, terminal = false;
let elapsedBase = 0, elapsedAnchor = performance.now();
let mode = "", latestUsage = null;
const ms = n => `${(n / 1000).toFixed(2)} 秒`;
const elapsedNow = () => elapsedBase + (terminal ? 0 : performance.now() - elapsedAnchor);

function renderUsage() {
  const pending = [...steps.values()].filter(s =>
    s.data.kind === "model" && s.data.status === "running").length;
  if (!latestUsage) {
    $("tokens").textContent = "Token：等待结算";
    $("calls").textContent = `模型统计覆盖：暂无；${pending} 次执行中`;
    return;
  }
  const u = latestUsage;
  $("tokens").textContent = `已知 Token：${u.total_tokens}（输入 ${u.input_tokens} / 输出 ${u.output_tokens}）`;
  $("calls").textContent = `已统计 ${u.accounted_calls} 次，缺失 ${u.unknown_calls} 次，执行中 ${pending} 次`;
}

function renderStep(s) {
  const d = s.data;
  const duration = d.duration_ms ?? Math.max(0, elapsedNow() - s.started);
  s.heading.textContent = `${d.kind} · ${d.name} · ${states[d.status] || d.status} · ${ms(duration)}`;
  s.node.dataset.state = d.status;
  const usage = d.kind !== "model" ? "不适用" :
    d.usage ? JSON.stringify(d.usage) :
    d.status === "running" ? "等待结算" : "供应商未返回或调用失败，消耗未知";
  s.detail.textContent = [
    `步骤 ID：${s.id}`,
    `父步骤：${s.parent || "无"}`,
    `开始时间：${s.timestamp}`,
    `输入摘要：${d.input_summary || "—"}`,
    `输出摘要：${d.output_summary || "—"}`,
    `Token：${usage}`,
    `错误：${d.error ? JSON.stringify(d.error) : "无"}`,
  ].join("\n\n");
}

function finishConnection(text) {
  terminal = true;
  source?.close();
  $("submit").disabled = false;
  $("connection").textContent = text;
}

function applyEvent(e) {
  if (e.run_id !== activeRun || e.seq <= lastSeq) return;
  if (e.seq !== lastSeq + 1) {
    $("error").textContent = "事件不连续，请重新连接并从已确认序号重放。";
    source?.close();
    subscribe();
    return;
  }
  lastSeq = e.seq;
  elapsedBase = e.elapsed_ms;
  elapsedAnchor = performance.now();
  const d = e.data;
  if (e.type === "run.started") {
    mode = d.mode;
    $("identity").textContent = `Run ID：${activeRun} ｜ 模式：${mode}`;
  } else if (e.type === "plan.updated") {
    $("plan").replaceChildren();
    for (const todo of d.todos) {
      const li = document.createElement("li");
      li.textContent = `${states[todo.status] || todo.status} · ${todo.content}`;
      $("plan").append(li);
    }
  } else if (e.type === "step.started") {
    const node = document.createElement("details");
    const heading = document.createElement("summary");
    const detail = document.createElement("pre");
    node.append(heading, detail);
    $("timeline").append(node);
    steps.set(e.step_id, {id: e.step_id, parent: e.parent_step_id,
      started: e.elapsed_ms, timestamp: e.timestamp,
      data: {...d}, node, heading, detail});
    renderStep(steps.get(e.step_id));
  } else if (e.type === "step.finished" || e.type === "step.failed") {
    const s = steps.get(e.step_id);
    if (s) { Object.assign(s.data, d); renderStep(s); }
  } else if (e.type === "usage.updated") {
    latestUsage = d; // 累计快照覆盖，绝不再次 +=。
  } else if (e.type === "run.completed") {
    $("report").textContent = d.report_summary;
    finishConnection("分析完成");
  } else if (e.type === "run.failed") {
    $("error").textContent = `${d.error.code}：${d.error.message}`;
    finishConnection("分析失败");
  }
  renderUsage();
  $("elapsed").textContent = `总耗时：${ms(elapsedNow())}${terminal ? "" : "（估计）"}`;
}

function subscribe() {
  source = new EventSource(`/api/runs/${encodeURIComponent(activeRun)}/events?after=${lastSeq}`);
  source.onopen = () => { $("connection").textContent = "实时连接已建立"; };
  source.onmessage = message => {
    try { applyEvent(JSON.parse(message.data)); }
    catch (err) {
      source.close();
      $("connection").textContent = "事件解析失败";
      $("error").textContent = String(err);
    }
  };
  source.onerror = () => {
    if (!terminal) $("connection").textContent = "连接中断，正在自动重连；分析可能仍在继续";
  };
}

$("form").addEventListener("submit", async event => {
  event.preventDefault();
  source?.close();
  steps.clear(); lastSeq = 0; terminal = false; activeRun = null;
  latestUsage = null; elapsedBase = 0; elapsedAnchor = performance.now();
  $("timeline").replaceChildren(); $("plan").replaceChildren();
  $("error").textContent = ""; $("identity").textContent = "";
  $("report").textContent = "等待分析";
  $("submit").disabled = true;
  $("connection").textContent = "正在创建分析";
  renderUsage();
  try {
    const response = await fetch("/api/runs", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({question: $("question").value}),
    });
    if (!response.ok) throw new Error(`创建失败：HTTP ${response.status}`);
    const data = await response.json();
    activeRun = data.run_id;
    subscribe();
  } catch (err) {
    $("error").textContent = String(err);
    finishConnection("未能创建分析");
  }
});

setInterval(() => {
  if (!activeRun || terminal) return;
  $("elapsed").textContent = `总耗时：${ms(elapsedNow())}（估计）`;
  for (const s of steps.values()) {
    if (s.data.status === "running") renderStep(s);
  }
}, 100);
</script>
</body>
</html>
```

页面没有反复重建所有 `<details>`，所以新事件到来时，用户已经展开的详情不会突然折叠。模型输出和工具结果使用 `textContent` 写入，避免外部文本被当成 HTML 执行。正式报告如果需要 Markdown 渲染，应额外加入 HTML 清理，不能直接赋值给 `innerHTML`。

前端运行中计时是估计值：以最近一次事件的 `elapsed_ms` 为基准，使用浏览器单调时钟继续递增。由于网络传输会有延迟，它不适合计费或服务等级统计；终态显示后端确认的时间。

## 六、启动与观察

在示例应用目录执行：

```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1
```

打开 `http://127.0.0.1:8000`，点击开始分析。默认模式会依次出现计划、行情工具、模型步骤和报告，累计 Token 最终为 200，且页面标注这些数值是演示数据。

真实模型模式的 PowerShell 启动方式：

```powershell
$env:TRACE_REAL = '1'
$env:OPENAI_API_KEY = '替换为你的APIKey'
$env:OPENAI_MODEL = 'gpt-4.1-mini'
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1
```

真实模式消耗实际模型 Token，但行情工具仍是演示数据。接入前文实现的行情、财务和搜索工具时，在 `tools` 参数中替换 `demo_quote` 并相应调整提示词即可；不要将虚构行情用于真实投资结论。

运行过程中可通过浏览器开发者工具临时切换离线再恢复，观察自动重连与事件重放。此示例支持同一页面连接中断后的恢复；整页刷新会丢失当前 Run ID，若要支持刷新恢复，需要把 Run ID 保存到 URL，并从零重放或从后端加载状态快照，不能只保存 `lastSeq` 而丢掉其之前的页面状态。

## 七、Token 统计必须说明边界

Token 面板看起来只是三个数字，实际最容易产生误导。

### 1. 只在一个层级累计

本例只从每次模型请求结束回调累计。不能同时统计 token chunk、完整 AIMessage、Agent 最终返回值和父 Chain 汇总值，否则一次请求可能重复计数。

`counted` 按模型 callback ID 去重。子 Agent 的模型调用如果正确继承回调，会各自拥有独立 ID，分别计入总量；不要再叠加子 Agent 返回的总计。

### 2. 缺失 usage 不是免费

供应商没有返回 usage、超时或中途断开，都可能导致 Token 消耗未知。因此页面同时显示：已统计调用数、未知调用数和正在执行的调用数。

一次失败的请求也可能已产生费用。`unknown_calls > 0` 时，面板的总数只是**已知消耗**，最终账单应以供应商账单或网关结算为准。

### 3. 不通过中文字符数推算真实账单

字符串长度不是模型 Token 数。若确实需要估计，可以单独增加 `estimated_tokens`，并明确标记估算，不能把估算写进供应商返回的 usage 字段。

### 4. 缓存、推理 Token 和费用应另行扩展

缓存命中 Token 和推理 Token 可能是输入或输出 Token 的子集，不能不加区分地再次加入 `total_tokens`。扩展协议时保留供应商、模型、usage 来源和子项口径，计费时使用对应模型的费率与版本。

本例故意没有展示金额：模型价格、缓存折扣和失败请求的计费规则不一致，简单地用总 Token 乘一个单价会制造虚假的精确度。

## 八、错误、断线与业务失败要分别展示

工具失败不等于整个 Run 失败。Agent 可能捕获行情接口异常、切换数据源，最后仍成功生成报告。此时应保留失败步骤，同时把 Run 标成完成，不要抹掉失败历史。

SSE 连接失败也不等于分析失败。后端任务独立于浏览器连接运行，浏览器应显示“重连中”，而不是把所有步骤改为失败。

只有 `run.failed` 或 `run.completed` 才是当前协议中的业务终态。前端收到终态以后主动关闭 EventSource，避免浏览器对已经结束的事件流反复重连。

生产系统还应区分登录失效、Run 不存在、事件已过期与临时断网。原生 EventSource 不方便读取错误响应状态，可以增加 `GET /api/runs/{run_id}` 状态接口，在多次重连失败后核查原因；事件日志过期应返回明确错误并引导加载快照，而不是无限重试。

## 九、从教学示例到可部署系统

本例采用单进程内存事件日志，目的是把完整链路放在两个文件中。进程重启会丢失 Run，多个 Worker 不共享内存，事件列表和 Run 字典也没有自动回收，因此不能直接作为长期运行的生产服务。

上线前应补齐以下机制：

| 问题 | 建议实现 |
| --- | --- |
| 进程重启和多实例部署 | 使用 Redis Streams 或数据库事件表，执行器与 SSE 网关共享日志 |
| 事件唯一性 | 数据库约束 `(run_id, seq)` 唯一，使用事务或原子操作分配序号 |
| 长时间运行的存储增长 | 配置 Run 保留期、单事件大小上限和事件快照，过期游标返回显式恢复协议 |
| 慢客户端 | 限制重放批次、连接数和输出缓冲；超限断开后允许从已确认游标恢复 |
| 工作进程崩溃 | 租约与心跳检测，把长期无心跳的运行收敛到可解释的失败状态 |
| 访问权限 | 每次创建、订阅和读取详情均校验用户身份及 Run 归属，UUID 不等于授权 |
| 敏感信息 | 输入输出字段白名单、凭证脱敏、详情访问审计；不把原始堆栈发送到浏览器 |
| 重复提交 | 创建接口支持幂等键，避免请求成功但响应丢失时重复启动分析 |

原生 EventSource 不能随意设置 Authorization 请求头。同源应用可以用安全的 HttpOnly Cookie；需要 Bearer Token 时，可以使用 fetch 读取事件流并自行实现重连，避免把长期有效凭证放进查询字符串。使用 Cookie 的创建接口也应配套 CSRF 防护。

如果前面有 Nginx，SSE 路径至少要关闭响应缓冲，并把读取超时设置得长于心跳间隔：

```nginx
location ~ ^/api/runs/[^/]+/events$ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 60s;
}
```

15 秒心跳只能防止空闲连接被过早清理，不能解决平台强制限制响应时长的问题。遇到这类平台，应依赖游标续传，或者使用支持长连接的部署环境。

## 十、验收时检查用户能否解释这次分析

追踪页面的价值不是“看起来数据很多”，而是让用户能回答发生了什么。接入自己的分析工具后，建议按以下场景验收：

1. 正常完成：计划状态更新，工具和模型步骤都有终态，最终耗时停止变化。
2. 工具失败后恢复：失败步骤保留错误，后续调用继续出现，Run 最终状态反映整体结果。
3. 模型 usage 缺失：显示未知调用数量，不把缺失值误报为零成本。
4. 并行执行：每次调用单独展示，Run 耗时不使用步骤耗时求和。
5. 断网重连：按 `Last-Event-ID` 重放，步骤不重复，累计 Token 不翻倍。
6. 超时：开放步骤被收敛，运行级错误可见，页面停止等待。
7. 不可信输出：工具返回 HTML 或脚本片段时，页面只将其展示为文本。

完成这一层后，用户看到的就不再只有最终报告：他们可以沿着 Run ID，从计划、数据查询、模型请求一路追到结果，并清楚区分已完成、仍在执行、失败和统计未知的部分。
