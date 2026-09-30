---
layout: doc
title: '04｜用 write_todos 实现可观察的任务规划链路'
category: DeepAgents实战-股票分析助手
date: '2026-09-30'
tags:
  - DeepAgents
  - write_todos
  - 可观察性
  - 任务规划
---

股票分析助手收到“分析某只股票”后，往往需要获取行情、计算技术指标、读取基本面、检索新闻，最后生成报告。如果前端只有一个持续旋转的加载图标，用户就无法判断：现在在做什么？为什么还没有报告？新闻服务失败后，结论是否仍然可信？

本篇把这个过程拆成两个相互配合的部分：用 DeepAgents 的 `write_todos` 表达和更新计划，用应用层执行器管理依赖、重试、降级和证据，再将它们转换成前端可以消费的标准事件。

前文已经涉及项目环境以及 Agent 的提示词、状态与结构化输出，本篇聚焦任务从“被规划”到“可被观察”的完整链路。所有股票数据均为演示数据，不代表真实行情或投资建议。

## 一、先明确 write_todos 的边界

DeepAgents 通常通过内置待办中间件提供 `write_todos`。它接收完整的 `todos` 列表，将列表写入 Agent 状态，并返回工具响应。常见调用格式如下：

```json
{
  "todos": [
    {"content": "[quote] 获取行情快照", "status": "in_progress"},
    {"content": "[technical] 基于行情分析技术面", "status": "pending"},
    {"content": "[fundamental] 读取基本面", "status": "pending"},
    {"content": "[news] 检索消息面", "status": "pending"},
    {"content": "[report] 汇总证据并生成报告", "status": "pending"}
  ]
}
```

这里有三个需要先说明的事实。

第一，`write_todos` 是计划状态工具，并不是工作流调度器。它不会因为任务 A 完成就自动启动任务 B，也不会自动重试失败请求。

第二，常见原生状态只有 `pending`、`in_progress`、`completed`。不要直接向原生工具传入 `blocked`、`failed`、`skipped`，也不要假设它识别 `depends_on`、`attempt` 等自定义字段。

第三，它通常更新整份待办列表。修改一个任务时，应携带当前完整列表，避免遗漏其他待办。具体导入路径、工具签名和流格式应以项目锁定的 DeepAgents、LangChain、LangGraph 版本为准。

因此，我们建立两层状态：

| 层次 | 保存什么 | 谁负责更新 |
| --- | --- | --- |
| Agent 的 `todos` | 自然语言任务及三个原生状态 | 模型调用 `write_todos` |
| 应用层任务图 | 稳定 ID、依赖、尝试次数、失败原因、产物引用 | 服务端执行器 |

在轻量助手中，可以让模型主动执行并更新待办；在需要严格审计的业务中，应由服务端校验计划、执行工具并确认任务结果。不能把模型写下“已完成”当成数据请求已经成功的证明。

## 二、按产物拆任务，再建立依赖

本例使用下面的任务图：

```text
quote ───────→ technical ──┐
  └───────────────────────┤
fundamental ──────────────┼──→ report
news ─────────────────────┘
```

行情、基本面、消息面可以独立获取；技术面依赖行情中的历史收盘价；报告依赖各部分产物。

| ID | 产物 | 完成条件 | 缺失后的处理 |
| --- | --- | --- | --- |
| quote | 带时间与来源的价格序列 | 非空且口径明确 | 阻止技术面与报告 |
| technical | 指标值及输入引用 | 指标计算成功 | 阻止完整报告 |
| fundamental | 财务指标快照 | 包含统计期间 | 阻止完整报告 |
| news | 新闻检索结果 | 请求成功；允许零条结果 | 重试耗尽后降级 |
| report | 带证据引用的结论 | 引用可解析，覆盖缺失项 | 不发布无依据结论 |

“依赖关系”应表达数据需求，而不只是展示顺序。比如技术面依赖行情，是因为移动平均值需要历史收盘价。消息面暂时不可用，并不意味着可以编造“无重大新闻”；只能在报告中声明“消息面未覆盖”。

## 三、状态迁移、重试和计划调整

应用层允许比原生待办更丰富的状态：

```text
pending → in_progress → completed
                    └→ failed → pending       # 可重试
                             └→ skipped       # 可选任务降级
pending → blocked                            # 必需依赖不可用
```

关键规则如下：

- 只有依赖满足后才能从 `pending` 进入 `in_progress`。
- `attempt` 在实际发起工具执行前递增。
- 请求成功后先保存产物和证据，再把任务标记为 `completed`。
- 可重试错误才进入重试路径；认证错误、参数错误应直接暴露。
- 可选任务降级必须生成计划调整事件，并影响报告的覆盖说明。
- 必需任务最终失败时，下游进入 `blocked`，不能显示整个分析成功。

向原生待办投影时，`completed` 对应 `completed`，`in_progress` 对应 `in_progress`；其他应用层状态可以保留为 `pending` 并在文案中说明原因。前端以应用层状态渲染失败、跳过和阻塞，避免把“已放弃”伪装成“已完成”。

生产环境中的重试还应结合超时、指数退避与随机抖动。对报告发布、订单等有副作用的动作，应使用幂等键；不能因为一次响应超时就无条件重复执行。

## 四、统一前端事件协议

事件是服务端对外的稳定契约。前端不应该直接解析模型自由文本，也不应该依赖某个 LangGraph 节点的内部名称。

```json
{
  "schema_version": "1.0",
  "run_id": "run-123",
  "event_id": "run-123:8",
  "seq": 8,
  "ts": "2026-09-30T02:00:00+00:00",
  "type": "tool.selected",
  "task_id": "technical",
  "payload": {
    "tool": "calculate_ma",
    "reason": "行情证据已就绪，计算技术指标",
    "attempt": 1,
    "call_id": "technical:1"
  }
}
```

推荐保留这些事件：

| 事件 | 前端展示 | 事实来源 |
| --- | --- | --- |
| plan.created | 初始任务清单 | 已校验的任务图 |
| plan.updated | 任务及依赖调整 | 新计划版本与调整原因 |
| task.status_changed | 任务状态与尝试次数 | 执行器状态迁移 |
| tool.selected | 当前工具与用途 | 实际工具调用请求 |
| tool.result | 成功摘要或错误分类 | 实际工具返回 |
| task.retry_scheduled | 重试提示 | 服务端重试策略 |
| evidence.added | 数据来源卡片 | 已保存产物 |
| conclusion.ready | 结论与证据引用 | 报告生成及引用校验 |
| run.finished | 总体完成或失败 | 所有任务的终态 |

这里的 `reason` 是可以公开的简短用途说明，例如“使用已获取的价格序列计算均线”。它不是模型隐藏思维链，也不需要展示逐步私有推理。透明性来自可核验的输入、动作、结果与证据。

`seq` 在一次运行内严格递增，`event_id` 用于去重，`call_id` 区分同一任务的不同尝试。跨运行不要比较 `seq`。工具返回体应经过裁剪与脱敏，避免把 API 密钥、完整付费正文或过大的原始数据推送给浏览器。

## 五、完整示例：可运行的任务执行器

下面是只依赖 Python 标准库的完整示例，可保存为 `observable_plan.py`，用 `python observable_plan.py` 运行。它专门演示应用层的可靠执行，不会调用模型或真实行情接口，也不会把自定义状态直接传给 `write_todos`。

演示中，消息面第一次超时、第二次成功。使用 `python observable_plan.py --news-down` 可让它连续失败，观察计划降级和报告覆盖范围变化。程序向标准输出打印 JSON Lines 事件，不生成额外文件。

```python
from __future__ import annotations

import argparse
import json
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Task:
    id: str
    content: str
    tool: str
    reason: str
    deps: list[str] = field(default_factory=list)
    optional: bool = False
    status: str = "pending"
    attempt: int = 0


class AnalysisRun:
    def __init__(self, news_down: bool = False):
        self.run_id = str(uuid.uuid4())
        self.seq = 0
        self.revision = 1
        self.max_attempts = 2
        self.news_down = news_down
        self.outputs: dict[str, dict[str, Any]] = {}
        self.evidence: dict[str, dict[str, Any]] = {}
        self.tasks = {
            "quote": Task("quote", "获取行情快照", "fetch_quote",
                          "获取技术分析需要的价格序列"),
            "technical": Task("technical", "分析技术面", "calculate_ma",
                              "行情证据已就绪，计算技术指标", ["quote"]),
            "fundamental": Task("fundamental", "分析基本面",
                                "fetch_fundamentals", "读取财务期间与估值口径"),
            "news": Task("news", "检索消息面", "search_news",
                         "补充事件背景", optional=True),
            "report": Task("report", "生成证据报告", "build_report",
                           "汇总已验证产物并标注覆盖范围",
                           ["quote", "technical", "fundamental", "news"]),
        }
        self.handlers = {
            "fetch_quote": self.fetch_quote,
            "calculate_ma": self.calculate_ma,
            "fetch_fundamentals": self.fetch_fundamentals,
            "search_news": self.search_news,
            "build_report": self.build_report,
        }
        self.validate_plan()

    def emit(self, kind: str, task_id: str | None = None, **payload):
        self.seq += 1
        event = {
            "schema_version": "1.0",
            "run_id": self.run_id,
            "event_id": f"{self.run_id}:{self.seq}",
            "seq": self.seq,
            "ts": utc_now(),
            "type": kind,
            "task_id": task_id,
            "payload": payload,
        }
        print(json.dumps(event, ensure_ascii=False), flush=True)

    def validate_plan(self):
        visiting, visited = set(), set()

        def visit(task_id):
            if task_id in visiting:
                raise ValueError("任务依赖存在环")
            if task_id in visited:
                return
            if task_id not in self.tasks:
                raise ValueError(f"不存在的依赖: {task_id}")
            visiting.add(task_id)
            task = self.tasks[task_id]
            if task.tool not in self.handlers:
                raise ValueError(f"工具未注册: {task.tool}")
            for dep in task.deps:
                visit(dep)
            visiting.remove(task_id)
            visited.add(task_id)

        for task_id in self.tasks:
            visit(task_id)

    def snapshot(self):
        return [
            {"id": t.id, "content": t.content, "status": t.status,
             "depends_on": list(t.deps), "attempt": t.attempt,
             "optional": t.optional}
            for t in self.tasks.values()
        ]

    def native_todos(self):
        # 这是 write_todos 入参的投影，不会自行修改 Agent 状态。
        result = []
        for t in self.tasks.values():
            native = t.status if t.status in {
                "pending", "in_progress", "completed"
            } else "pending"
            suffix = "" if native == t.status else f"（执行状态：{t.status}）"
            result.append({"content": f"[{t.id}] {t.content}{suffix}",
                           "status": native})
        return result

    def change(self, task: Task, status: str, reason: str):
        old = task.status
        task.status = status
        self.emit("task.status_changed", task.id, previous=old,
                  status=status, reason=reason, attempt=task.attempt)

    def save_evidence(self, task: Task, data: dict):
        evidence_id = f"ev:{task.id}:{task.attempt}"
        self.evidence[evidence_id] = {
            "task_id": task.id,
            "source": data["source"],
            "as_of": data["as_of"],
            "retrieved_at": utc_now(),
            "data": data,
        }
        self.outputs[task.id] = {"evidence_id": evidence_id, "data": data}
        self.emit("evidence.added", task.id, evidence_id=evidence_id,
                  source=data["source"], as_of=data["as_of"])

    def fetch_quote(self, task):
        return {"symbol": "DEMO", "closes": [10, 11, 12, 11, 13],
                "price_basis": "演示用同口径价格，不含真实复权处理",
                "source": "fixture:quote", "as_of": "2026-09-30"}

    def calculate_ma(self, task):
        quote = self.outputs["quote"]
        prices = quote["data"]["closes"]
        if len(prices) < 5:
            raise ValueError("计算 MA5 至少需要 5 个收盘价")
        return {"ma5": sum(prices[-5:]) / 5, "latest": prices[-1],
                "input_evidence_ids": [quote["evidence_id"]],
                "source": "derived:ma5", "as_of": quote["data"]["as_of"]}

    def fetch_fundamentals(self, task):
        return {"revenue_growth_yoy": 0.08, "period": "2026H1",
                "source": "fixture:financial_statement",
                "as_of": "2026-08-31"}

    def search_news(self, task):
        if self.news_down or task.attempt == 1:
            raise TimeoutError("演示新闻服务超时")
        return {"items": [{"title": "演示公司发布半年报",
                           "published_at": "2026-08-31"}],
                "source": "fixture:news", "as_of": "2026-09-30"}

    def build_report(self, task):
        technical = self.outputs["technical"]
        fundamental = self.outputs["fundamental"]
        values = technical["data"]
        direction = "高于" if values["latest"] > values["ma5"] else "不高于"
        claims = [
            {"text": f"最新演示收盘价{direction} MA5，不能单独据此预测收益。",
             "evidence_ids": [technical["evidence_id"]]},
            {"text": "演示财报营收同比增长 8%，仅覆盖 2026H1。",
             "evidence_ids": [fundamental["evidence_id"]]},
        ]
        if "news" in self.outputs:
            claims.append({"text": "消息面检索返回一条演示半年报记录。",
                           "evidence_ids": [self.outputs["news"]["evidence_id"]]})
        missing = [t.id for t in self.tasks.values() if t.status == "skipped"]
        for claim in claims:
            if not claim["evidence_ids"]:
                raise ValueError("结论缺少证据引用")
            if any(ref not in self.evidence for ref in claim["evidence_ids"]):
                raise ValueError("结论引用了不存在的证据")
        return {"claims": claims, "missing_sections": missing,
                "coverage": "partial" if missing else "full",
                "notice": "消息面未覆盖" if "news" in missing else "均为演示数据"}

    def revise_after_skip(self, task):
        affected = []
        for child in self.tasks.values():
            if task.id in child.deps:
                child.deps.remove(task.id)
                affected.append(child.id)
        self.validate_plan()
        self.revision += 1
        self.emit("plan.updated", revision=self.revision,
                  reason=f"可选任务 {task.id} 不可用，移除其硬依赖并保留缺失声明",
                  affected_tasks=affected, tasks=self.snapshot(),
                  todos=self.native_todos())

    def execute(self, task):
        task.attempt += 1
        call_id = f"{task.id}:{task.attempt}"
        self.change(task, "in_progress", "依赖已满足")
        self.emit("tool.selected", task.id, tool=task.tool,
                  reason=task.reason, attempt=task.attempt, call_id=call_id)
        try:
            result = self.handlers[task.tool](task)
            if task.id != "report":
                self.save_evidence(task, result)
        except Exception as exc:
            retryable = isinstance(exc, TimeoutError)
            self.emit("tool.result", task.id, call_id=call_id, ok=False,
                      error={"code": type(exc).__name__, "message": str(exc)},
                      retryable=retryable)
            self.change(task, "failed", "工具执行或产物校验失败")
            if retryable and task.attempt < self.max_attempts:
                delay = 0.1 * (2 ** (task.attempt - 1))
                self.emit("task.retry_scheduled", task.id,
                          next_attempt=task.attempt + 1, delay_seconds=delay)
                time.sleep(delay)  # 仅为短时串行演示
                self.change(task, "pending", "等待下一次执行")
            elif task.optional and retryable:
                self.change(task, "skipped", "重试耗尽，执行已声明的降级策略")
                self.revise_after_skip(task)
            return
        self.emit("tool.result", task.id, call_id=call_id, ok=True,
                  summary="报告已生成" if task.id == "report" else "产物已保存")
        self.change(task, "completed", "产物已保存或报告已校验")
        if task.id == "report":
            self.outputs["report"] = result
            self.emit("conclusion.ready", task.id, **result)

    def run(self):
        self.emit("plan.created", revision=self.revision,
                  tasks=self.snapshot(), todos=self.native_todos())
        while True:
            pending = [t for t in self.tasks.values() if t.status == "pending"]
            if not pending:
                break
            progressed = False
            for task in pending:
                unavailable = [dep for dep in task.deps
                               if self.tasks[dep].status in {"failed", "blocked"}]
                if unavailable:
                    self.change(task, "blocked", f"必需依赖不可用: {unavailable}")
                    progressed = True
                elif all(self.tasks[dep].status == "completed" for dep in task.deps):
                    self.execute(task)
                    progressed = True
            if not progressed:
                for task in pending:
                    self.change(task, "blocked", "没有可执行路径，需要调整计划")
                break
        report_ok = self.tasks["report"].status == "completed"
        skipped = any(t.status == "skipped" for t in self.tasks.values())
        status = ("completed_with_gaps" if skipped else "completed") if report_ok else "failed"
        self.emit("run.finished", status=status, tasks=self.snapshot())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--news-down", action="store_true")
    args = parser.parse_args()
    AnalysisRun(news_down=args.news_down).run()
```

这个例子采用串行调度，便于看清状态变化。虽然行情、基本面、消息面之间没有依赖，这并不代表示例已经并行执行。改成异步调度时，需要额外处理并发上限、事件序号分配和状态更新冲突。

另一个细节是：可选任务的任意错误并不会都被悄悄吞掉。示例只允许对超时执行降级；例如基本面字段缺失导致 `ValueError`，应保留失败事实，而不是当成“暂无数据”。

## 六、接入真实 DeepAgents 的 write_todos

上面的执行器说明了应用层规则，下面单独展示模型主动规划模式中的真实 `write_todos` 观察入口。两段代码是两种运行层次的示例，不能同时各自执行同一组分析工具，否则会重复请求数据。

此示例面向提供 `create_deep_agent` 与内置待办工具的 DeepAgents API，使用 LangGraph 的 `values` 流观察状态。模型供应商包及凭据沿用前文配置；可通过 `MODEL` 环境变量替换模型。示例工具仍只返回演示数据。

实际脚本如下，可保存为 `agent_plan_stream.py`：

```python
import json
import os
import uuid
from datetime import datetime, timezone

from deepagents import create_deep_agent
from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.tools import tool


@tool
def get_demo_section(section: str) -> dict:
    """读取演示股票的 quote、technical、fundamental 或 news 数据。"""
    data = {
        "quote": {"closes": [10, 11, 12, 11, 13], "as_of": "2026-09-30"},
        "technical": {"ma5": 11.4, "latest": 13,
                      "input_evidence_ids": ["demo:quote"]},
        "fundamental": {"revenue_growth_yoy": 0.08, "period": "2026H1"},
        "news": {"items": [], "coverage": "仅演示空结果"},
    }
    if section not in data:
        return {"ok": False, "error": "unsupported_section"}
    return {"ok": True, "evidence_id": f"demo:{section}",
            "source": "fixture", "data": data[section]}


agent = create_deep_agent(
    model=os.environ.get("MODEL", "openai:gpt-4.1"),
    tools=[get_demo_section],
    system_prompt="""
你是演示股票分析助手，所有数据必须标注为演示。
先调用 write_todos 创建 quote、technical、fundamental、news、report 五项任务。
content 使用 [任务ID] 开头。使用原生 pending/in_progress/completed 状态。
每次更新传入完整 todos 列表；开始任务和完成任务时都更新计划。
quote 完成后再读取 technical；报告需要前三类数据和消息面覆盖说明。
数据任务调用 get_demo_section，section 为对应任务ID。
只有工具明确返回 ok=true 才能将数据任务声明为完成。
最后输出包含 evidence_id 引用的报告，不得把空新闻列表解释成没有风险。
""",
)

run_id = str(uuid.uuid4())
seq = 0
seen_calls = set()
seen_results = set()
last_todos = None


def emit(kind, **payload):
    global seq
    seq += 1
    print(json.dumps({
        "schema_version": "1.0", "run_id": run_id,
        "event_id": f"{run_id}:{seq}", "seq": seq,
        "ts": datetime.now(timezone.utc).isoformat(),
        "type": kind, "task_id": None, "payload": payload,
    }, ensure_ascii=False), flush=True)


try:
    for state in agent.stream(
        {"messages": [{"role": "user", "content": "分析 DEMO 演示股票并生成报告。"}]},
        stream_mode="values",
    ):
        # values 返回累积状态，因此工具请求和响应均需要去重。
        for message in state.get("messages", []):
            if isinstance(message, AIMessage):
                for call in message.tool_calls:
                    call_id = call["id"]
                    if call_id in seen_calls:
                        continue
                    seen_calls.add(call_id)
                    emit("tool.selected", call_id=call_id, tool=call["name"],
                         reason="模型请求调用该工具；执行结果以工具响应为准")
            elif isinstance(message, ToolMessage):
                call_id = message.tool_call_id
                if call_id in seen_results:
                    continue
                seen_results.add(call_id)
                # 这里只标记工具协议层状态，不把它等同于业务成功。
                emit("tool.result", call_id=call_id, tool=message.name,
                     transport_status=getattr(message, "status", "unknown"),
                     summary="工具已返回；业务产物需要单独解析和校验")

        todos = state.get("todos")
        if todos is not None:
            canonical = json.dumps(todos, ensure_ascii=False, sort_keys=True)
            if canonical != last_todos:
                emit("plan.created" if last_todos is None else "plan.updated",
                     origin="agent_todos", authoritative=False, todos=todos)
                last_todos = canonical
    emit("agent.finished", status="returned", business_status="unverified")
except Exception as exc:
    emit("agent.finished", status="failed", error_code=type(exc).__name__)
    raise
```

这里没有再次注册名为 `write_todos` 的工具，因为它由 DeepAgents 的待办中间件提供。如果项目定制过中间件，先确认该能力仍然存在；不要添加同名工具覆盖内置行为。

适配器输出的 `plan.updated` 带有 `origin=agent_todos` 和 `authoritative=false`，表示“模型计划声明”。真实业务中，应解析 `ToolMessage` 对应的业务响应，检查字段、证据和依赖，再由执行器发出权威的 `task.status_changed`。协议层工具调用正常返回，仍然可能携带 `ok=false` 的业务错误。

这个示例不发出 `conclusion.ready`，因为它没有实现最终报告的业务校验。模型流结束，只能说明 Agent 返回了；不能据此把整个分析显示成成功。

如果需要严格控制依赖，推荐按以下顺序接线：

1. 模型使用 `write_todos` 提出计划，服务端读取 `todos` 快照。
2. 服务端将任务映射成结构化任务图，检查任务 ID、工具白名单、依赖和循环。
3. 执行器调用行情等业务工具，生成权威执行事件。
4. 调整计划时保留旧版本，并把执行反馈交给下一次模型调用；模型再通过 `write_todos` 更新完整列表。
5. 服务端校验报告引用后发出 `conclusion.ready`，最后发出 `run.finished`。

原生待办通常没有稳定 ID。本篇的 `[quote]` 等前缀只是约定，不能靠自然语言文案猜测身份。生产系统应校验允许的 ID 集合，并持久化任务映射。重命名任务时保留 ID，新增任务则创建新 ID。

注意不要让模型和执行器同时写同一份权威执行状态。`native_todos()` 只是投影函数；输出这个列表不会自动触发 `write_todos`，也不会自动修改 LangGraph 状态。

## 七、前端如何展示这些事件

前端可以采用三块区域：左侧任务清单，中央执行时间线，右侧证据与报告。任务清单显示状态、尝试次数和依赖；执行时间线显示工具用途与结果；证据卡片显示数据来源、数据时点和获取时点。

对于消息面超时，应展示类似下面的过程：

```text
消息面：执行中，第 1 次尝试
消息面：超时，准备第 2 次尝试
消息面：执行中，第 2 次尝试
消息面：重试耗尽，已跳过
计划版本 2：报告取消消息面硬依赖，保留覆盖缺失声明
报告：已完成，消息面未覆盖
```

这比单独显示“分析完成”更准确。`completed_with_gaps` 代表报告存在且有缺项，不应和完整覆盖使用相同文案。

以下浏览器端代码演示 SSE 消费。服务端需要将事件持久化，并通过 `/api/runs/{run_id}/events` 提供 SSE；前面的 Python 脚本仅输出 JSON Lines，没有实现这个 HTTP 接口。

```javascript
export function observeRun(runId, render) {
  const seen = new Set();
  const tasks = new Map();
  const timeline = [];
  let report = null;
  let status = "running";
  const source = new EventSource(
    `/api/runs/${encodeURIComponent(runId)}/events`
  );

  source.onmessage = ({ data }) => {
    const event = JSON.parse(data);
    if (event.run_id !== runId || seen.has(event.event_id)) return;
    seen.add(event.event_id);
    const payload = event.payload;

    if (["plan.created", "plan.updated"].includes(event.type)) {
      // 模型的 todos 声明不覆盖服务端任务执行状态。
      if (payload.tasks) {
        tasks.clear();
        for (const task of payload.tasks) tasks.set(task.id, task);
      }
    } else if (event.type === "task.status_changed") {
      const previous = tasks.get(event.task_id) || { id: event.task_id };
      tasks.set(event.task_id, {
        ...previous, status: payload.status, attempt: payload.attempt,
      });
    } else if (event.type === "conclusion.ready") {
      report = payload;
    } else if (event.type === "run.finished") {
      status = payload.status;
      source.close();
    }

    timeline.push(event);
    render({ tasks: [...tasks.values()], timeline: [...timeline], report, status });
  };

  source.onerror = () => {
    // EventSource 会自动重连；网络断开不等于任务失败。
    render({ tasks: [...tasks.values()], timeline: [...timeline], report,
             status: "reconnecting" });
  };
  return () => source.close();
}
```

服务端 SSE 消息应使用 `id: run_id:seq` 和 `data: JSON`，不设置自定义 `event:` 时由上面的 `onmessage` 接收。重连后根据 `Last-Event-ID` 补发缺失事件，并保证单次运行按 `seq` 顺序交付。首次加载也需要完整重放或提供带序号的状态快照，否则前端可能先收到“任务完成”，却不知道任务名称和依赖。

长期运行时应限制浏览器保存的时间线长度，并把历史分页交给服务端。渲染工具摘要和新闻标题时使用文本节点或框架默认转义，不直接插入未经处理的 HTML。

## 八、证据链比进度条更重要

示例中的技术面结论引用技术指标产物，指标产物再通过 `input_evidence_ids` 指向行情。这样可以从结论追溯到指标，再追溯到输入数据。

真实项目还应补充以下字段：

| 字段 | 用途 |
| --- | --- |
| symbol、market、currency | 避免同名证券和币种混淆 |
| as_of、retrieved_at | 区分数据时点与抓取时间 |
| period、price_basis | 明确财报期间与复权口径 |
| source_url、provider | 定位原始来源 |
| input_evidence_ids | 追溯派生指标输入 |
| content_hash | 检测已保存内容是否变化 |

引用存在只是最低要求，不代表引用内容足以支持结论。生产校验还需要检查来源时间、统计口径，以及结论是否夸大了证据。例如“价格高于 MA5”不能直接支持“未来一定上涨”；营收增长也不能直接支持“估值便宜”。

## 九、实现时需要检查的几条路径

正常路径应产生完整计划、工具请求、工具响应、证据、报告和总体完成事件。临时超时应保留第一次失败与第二次尝试，而不是用成功响应覆盖历史。

可选数据持续不可用时，应看到计划版本递增、可选任务 `skipped`、报告覆盖声明以及 `completed_with_gaps`。必需数据不可用时，应看到依赖任务 `blocked` 和运行失败，不能继续输出一份伪装完整的报告。

此外，还要区分“新闻检索成功但没有结果”与“新闻服务失败”，并检查前端重连是否重复插入事件、历史事件是否能恢复到相同最终状态。上面代码是教学示例，本文未执行运行验证；实际接入时需结合项目锁定版本和真实工具响应验证这些路径。

`write_todos` 让计划显式进入 Agent 状态，应用层任务图让执行规则可控，标准事件让前端看到真实进展，证据引用让最终结论可以追溯。把这四部分连起来，股票分析助手才具备从任务规划到报告交付的可观察链路。
