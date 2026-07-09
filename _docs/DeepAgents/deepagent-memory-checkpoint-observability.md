---
layout: doc
title: 让 DeepAgent 可恢复、可追踪、可复盘：任务记忆、检查点与执行日志设计
category: DeepAgents
date: '2026-07-09'
tags:
  - DeepAgents
  - Agent Memory
  - Checkpoint
---

很多人做 DeepAgent，第一版通常都能跑起来：拿到目标，规划几步，调用几个工具，最后输出结果。但只要进入真实环境，问题马上出现了：

1. 进程中断以后，任务要从头再跑。
2. 跑错了以后，根本不知道哪一步出的问题。
3. 同一类任务反复出现，Agent 却每次都像第一次做。

这说明单纯的“规划 + 执行”还不够。一个真正可用的 DeepAgent，至少要补上三层能力：

1. 短期状态：当前任务做到哪一步、每一步产出了什么。
2. 长期记忆：上一次类似任务沉淀了什么经验。
3. 可观测日志：执行链路能不能被回放、排查和复盘。

这篇文章不依赖具体框架，而是用一个最小可运行的 Python 版本，把这三层能力一次串起来。你理解了这个运行时骨架，再替换成 LangGraph、AutoGen 或你自己的模型编排层都不难。

## 设计目标

我们先把目标说清楚。这个示例里的 DeepAgent 要满足四件事：

1. 每执行完一个步骤，都把状态持久化成检查点。
2. 进程中断后，可以从上一个已完成步骤继续跑。
3. 每次任务结束后，把结果摘要写入长期记忆。
4. 整个执行过程写成 JSONL 事件日志，方便检索和回放。

对应到目录结构，大致会是这样：

```text
agent_data/
├─ checkpoints/
│  └─ article-demo.json
├─ traces/
│  └─ article-demo.jsonl
└─ memories.json
```

## 完整代码示例

下面是一份完整的单文件示例。为了突出运行时设计，规划器和工具都做成了可替换接口；示例工具本身是确定性的，不依赖外部 API，所以你可以直接运行它来观察“中断后恢复”的过程。

```python
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

Tool = Callable[[str], str]
UTC = timezone.utc

STOP_WORDS = {
    "的", "了", "和", "是", "在", "要", "把", "与", "及",
    "the", "a", "an", "to", "for", "of", "and", "or", "with",
}

KNOWLEDGE_BASE = [
    {
        "tags": ["deepagents", "memory", "state"],
        "text": "任务状态至少要保存目标、计划、已完成步骤、中间结果和下一步游标。",
    },
    {
        "tags": ["deepagents", "checkpoint", "resume"],
        "text": "检查点不要只在任务结束时保存，而要在每个步骤前后都保存，减少状态丢失窗口。",
    },
    {
        "tags": ["deepagents", "trace", "observability"],
        "text": "执行日志最好使用 JSONL，每一行一个事件，便于按任务回放、过滤和聚合。",
    },
    {
        "tags": ["deepagents", "memory", "retrieval"],
        "text": "长期记忆不等于完整对话历史，应该写入压缩后的经验摘要，供后续任务检索复用。",
    },
]


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def tokenize(text: str) -> set[str]:
    parts = re.findall(r"[A-Za-z0-9_\u4e00-\u9fff]+", text.lower())
    return {part for part in parts if part not in STOP_WORDS}


class JsonStore:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def load(self, default: Any) -> Any:
        if not self.path.exists():
            return default
        return json.loads(self.path.read_text(encoding="utf-8"))

    def save(self, value: Any) -> None:
        self.path.write_text(
            json.dumps(value, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


class JsonlTraceWriter:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def write(self, event: dict[str, Any]) -> None:
        with self.path.open("a", encoding="utf-8") as file:
            file.write(json.dumps(event, ensure_ascii=False) + "\n")


class MemoryStore:
    def __init__(self, path: Path):
        self.store = JsonStore(path)

    def search(self, query: str, limit: int = 3) -> list[dict[str, Any]]:
        query_tokens = tokenize(query)
        memories = self.store.load([])
        scored: list[tuple[int, dict[str, Any]]] = []

        for item in memories:
            score = len(query_tokens & set(item.get("tokens", [])))
            if score > 0:
                scored.append((score, item))

        scored.sort(key=lambda row: row[0], reverse=True)
        return [item for _, item in scored[:limit]]

    def remember(self, goal: str, summary: str, tags: list[str]) -> None:
        memories = self.store.load([])
        memories.append(
            {
                "goal": goal,
                "summary": summary,
                "tags": tags,
                "tokens": sorted(tokenize(goal + " " + summary + " " + " ".join(tags))),
                "created_at": now_iso(),
            }
        )
        self.store.save(memories)


def build_plan(goal: str, memories: list[dict[str, Any]]) -> list[dict[str, str]]:
    del goal
    del memories
    return [
        {
            "name": "collect_notes",
            "tool": "search_notes",
            "input": "任务目标：{{goal}}\n历史经验：\n{{memories}}",
        },
        {
            "name": "draft_outline",
            "tool": "draft_outline",
            "input": "任务目标：{{goal}}\n参考资料：\n{{step:collect_notes}}",
        },
        {
            "name": "final_answer",
            "tool": "write_final",
            "input": "任务目标：{{goal}}\n历史经验：\n{{memories}}\n结构草稿：\n{{step:draft_outline}}",
        },
    ]


def render_template(template: str, state: dict[str, Any]) -> str:
    rendered = template.replace("{{goal}}", state["goal"])

    memory_lines = [
        f"- {item['summary']}"
        for item in state.get("memories", [])
    ]
    rendered = rendered.replace(
        "{{memories}}",
        "\n".join(memory_lines) if memory_lines else "- 无可复用经验",
    )

    for step_name, output in state["step_outputs"].items():
        rendered = rendered.replace(f"{{{{step:{step_name}}}}}", output)

    return rendered


def search_notes(payload: str) -> str:
    query_tokens = tokenize(payload)
    scored: list[tuple[int, str]] = []

    for item in KNOWLEDGE_BASE:
        score = len(query_tokens & set(item["tags"])) + len(query_tokens & tokenize(item["text"]))
        if score > 0:
            scored.append((score, item["text"]))

    scored.sort(key=lambda row: row[0], reverse=True)

    if not scored:
        return "- 没有找到相关资料，请人工补充。"

    return "\n".join(f"- {text}" for _, text in scored[:3])


def draft_outline(payload: str) -> str:
    notes = [line[2:] for line in payload.splitlines() if line.startswith("- ")]
    if not notes:
        notes = [
            "说明任务状态为什么要保存步骤游标和中间结果。",
            "解释检查点为什么应在步骤前后都落盘。",
            "说明事件日志和长期记忆如何支撑复盘与复用。",
        ]

    return "\n".join(
        f"{index}. {item}"
        for index, item in enumerate(notes[:3], start=1)
    )


def write_final(payload: str) -> str:
    outline_lines = [
        line.strip()
        for line in payload.splitlines()
        if re.match(r"^\d+\.\s", line.strip())
    ]

    bullet_points = []
    for line in outline_lines:
        _, content = line.split(". ", 1)
        bullet_points.append(f"- {content}")

    return (
        "最终结论：\n"
        + "\n".join(bullet_points)
        + "\n- 实践上要把状态、检查点、记忆和日志当成同一个运行时问题，而不是四个零散功能。"
    )


class DeepAgentRuntime:
    def __init__(self, base_dir: Path, tools: dict[str, Tool]):
        self.base_dir = base_dir
        self.tools = tools
        self.memory_store = MemoryStore(base_dir / "memories.json")

    def checkpoint_store(self, task_id: str) -> JsonStore:
        return JsonStore(self.base_dir / "checkpoints" / f"{task_id}.json")

    def trace_writer(self, task_id: str) -> JsonlTraceWriter:
        return JsonlTraceWriter(self.base_dir / "traces" / f"{task_id}.jsonl")

    def load_or_create_state(self, task_id: str, goal: str | None) -> dict[str, Any]:
        store = self.checkpoint_store(task_id)
        state = store.load(None)
        if state is not None:
            return state

        if not goal:
            raise ValueError("首次运行任务时必须提供 goal。")

        memories = self.memory_store.search(goal)
        state = {
            "task_id": task_id,
            "goal": goal,
            "memories": memories,
            "plan": build_plan(goal, memories),
            "step_outputs": {},
            "next_step": 0,
            "status": "running",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        store.save(state)
        self.trace_writer(task_id).write(
            {
                "time": now_iso(),
                "stage": "task_created",
                "task_id": task_id,
                "goal": goal,
                "recalled_memories": [item["summary"] for item in memories],
            }
        )
        return state

    def run(
        self,
        task_id: str,
        goal: str | None = None,
        simulate_crash_after: int | None = None,
    ) -> dict[str, Any]:
        state = self.load_or_create_state(task_id, goal)
        if state["status"] == "completed":
            return state

        trace = self.trace_writer(task_id)
        checkpoint = self.checkpoint_store(task_id)
        executed_in_this_run = 0

        while state["next_step"] < len(state["plan"]):
            step = state["plan"][state["next_step"]]
            rendered_input = render_template(step["input"], state)

            trace.write(
                {
                    "time": now_iso(),
                    "stage": "step_started",
                    "task_id": task_id,
                    "step_name": step["name"],
                    "tool": step["tool"],
                }
            )

            checkpoint.save(state)
            output = self.tools[step["tool"]](rendered_input)

            state["step_outputs"][step["name"]] = output
            state["next_step"] += 1
            state["updated_at"] = now_iso()

            checkpoint.save(state)
            trace.write(
                {
                    "time": now_iso(),
                    "stage": "step_finished",
                    "task_id": task_id,
                    "step_name": step["name"],
                    "tool": step["tool"],
                    "output_preview": output[:120],
                }
            )

            executed_in_this_run += 1
            if simulate_crash_after is not None and executed_in_this_run >= simulate_crash_after:
                raise RuntimeError("模拟进程中断，请稍后重新调用 run() 恢复任务。")

        state["status"] = "completed"
        state["updated_at"] = now_iso()
        checkpoint.save(state)

        self.memory_store.remember(
            goal=state["goal"],
            summary=state["step_outputs"]["final_answer"][:180],
            tags=["deepagents", "memory", "checkpoint"],
        )

        trace.write(
            {
                "time": now_iso(),
                "stage": "task_completed",
                "task_id": task_id,
                "final_output_preview": state["step_outputs"]["final_answer"][:120],
            }
        )
        return state


def build_demo_runtime(base_dir: Path) -> DeepAgentRuntime:
    return DeepAgentRuntime(
        base_dir=base_dir,
        tools={
            "search_notes": search_notes,
            "draft_outline": draft_outline,
            "write_final": write_final,
        },
    )


if __name__ == "__main__":
    runtime = build_demo_runtime(Path("agent_data"))
    task_id = "article-demo"
    goal = "整理一份关于 DeepAgent 可恢复执行机制的简要说明"

    try:
        runtime.run(task_id=task_id, goal=goal, simulate_crash_after=1)
    except RuntimeError as error:
        print(f"第一次运行被打断：{error}")

    final_state = runtime.run(task_id=task_id, goal=goal)
    print("恢复后的任务状态：", final_state["status"])
    print(final_state["step_outputs"]["final_answer"])
```

## 这段代码到底解决了什么

如果你只看表面，这段代码像是一个很简单的任务编排器；但真正关键的是它把 DeepAgent 运行时里最容易被忽略的三件事补齐了。

### 1. `state` 不是日志，它是“继续执行”的依据

`state` 里保存了这些字段：

- `goal`：当前任务目标。
- `plan`：规划后的步骤列表。
- `step_outputs`：已经完成步骤的产出。
- `next_step`：下一个要执行的步骤索引。
- `status`：当前任务状态。

这里最关键的是 `next_step` 和 `step_outputs`。很多初版 Agent 只记录“做过什么”，但恢复执行真正需要的是“下一步从哪里接上”。只要这两个字段可靠落盘，进程重启以后就不用把前面步骤再重跑一遍。

### 2. 检查点必须按步骤保存，而不是按任务保存

很多人会在任务结束后才写一次结果文件，这不叫检查点，只能叫最终产物。真正的检查点策略应该是：

1. 步骤开始前先保存一次状态。
2. 工具执行完成、状态更新后再保存一次。

这样做的原因很直接：

- 如果工具调用前进程挂了，恢复后可以安全重试当前步骤。
- 如果工具调用成功但状态还没写盘就挂了，第二次保存能缩小结果丢失窗口。

示例里的 `checkpoint.save(state)` 出现了两次，这不是重复，而是为了让“副作用”和“运行时状态”尽量贴近。

### 3. 长期记忆保存的是摘要，不是整段历史

`MemoryStore` 没有把整个任务上下文原样保存，而是只写入：

- `goal`
- `summary`
- `tags`
- `tokens`

这是一个非常重要的边界。长期记忆的职责不是当归档系统，而是为未来任务提供低成本、可检索的经验复用。完整历史应该去对象存储、数据库或日志系统；而 Agent 在下一次决策前只需要读到压缩过的经验摘要。

### 4. 事件日志解决的是“为什么这样跑”

检查点能回答“现在做到哪”，但不能完整回答“为什么跑成这样”。这个问题要靠 `traces/article-demo.jsonl`。

每条事件至少带上这些字段：

- `time`
- `stage`
- `task_id`
- `step_name`
- `tool`

这样你就能很方便地做三件事：

1. 回放某个任务的完整执行顺序。
2. 统计哪类工具最慢、最容易失败。
3. 对比不同版本 Planner 在同类任务上的路径差异。

## 运行一次，你会看到什么

示例主程序故意让第一次运行在完成一个步骤后中断：

```python
runtime.run(task_id=task_id, goal=goal, simulate_crash_after=1)
```

第二次再调用：

```python
final_state = runtime.run(task_id=task_id, goal=goal)
```

由于 `article-demo.json` 里已经保存了：

- 已完成的 `collect_notes`
- `next_step = 1`
- 对应的中间结果

所以第二次运行不会重复第一步，而是直接从 `draft_outline` 继续。这就是检查点真正创造的价值：不是“保存了文件”，而是“保存了执行位置”。

## 把这个骨架迁移到真实 DeepAgent 的方法

如果你已经在用 LangGraph、LangChain 或其他 Agent 框架，这个骨架可以直接映射过去：

1. `state` 对应图运行时里的共享状态对象。
2. `checkpoint` 对应节点级持久化或图级快照。
3. `memory_store.search()` 对应任务启动前的记忆检索。
4. `trace_writer.write()` 对应回调、事件总线或 observability pipeline。

也就是说，框架替你处理的是“节点怎么连”，但真正决定系统能不能上线的，往往是这篇文章讨论的这层运行时设计。

## 工程上再往前走一步

如果你准备把它放进生产环境，建议继续补这几项：

1. 给每个工具调用增加幂等键，避免恢复执行时重复写外部系统。
2. 把检查点从本地文件迁移到数据库或对象存储，解决多实例调度问题。
3. 在长期记忆写入前增加摘要压缩和质量过滤，避免“错误经验”污染后续任务。
4. 把 JSONL 事件日志接到统一检索系统，支持按 `task_id`、`tool`、`stage` 查询。

## 小结

一个能演示的 DeepAgent，重点是“会不会做事”；一个能落地的 DeepAgent，重点是“断了能不能续、错了能不能查、做完能不能复用”。

所以在工程实现上，建议你把运行时拆成这三个最小部件：

1. 用 `state` 管当前任务。
2. 用 `checkpoint` 管恢复执行。
3. 用 `memory + trace` 管经验沉淀和问题复盘。

这三层补齐以后，DeepAgent 才真正从“智能体脚本”升级为“可持续运行的智能体系统”。
