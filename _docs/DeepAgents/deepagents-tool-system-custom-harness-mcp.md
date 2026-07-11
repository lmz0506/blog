---
layout: doc
title: 工具系统实战：自定义 Tool、内置 Harness Tool 与 MCP 接入
category: DeepAgents
date: '2026-07-12'
tags:
  - DeepAgents
  - LangChain
  - MCP
  - Tools
---

# 工具系统实战：自定义 Tool、内置 Harness Tool 与 MCP 接入

Deep Agents 真正的生产力，不在于“会不会调用一个函数”，而在于你能不能把工具层拆成清晰的三层：

1. 进程内自定义 Tool：把你自己的 Python 能力直接暴露给 Agent。
2. Harness 内置 Tool：让 Agent 原生具备文件、命令、子代理、todo 等执行能力。
3. MCP Tool/Resource/Prompt：把数据库、浏览器、企业文档服务做成标准协议能力，跨语言、跨进程、跨团队复用。

这一篇不讲抽象概念，直接讲怎么落地，尤其是：

- 自定义函数与 `@tool` 的边界
- Deep Agents 自带 Harness Tool 到底干什么
- `MultiServerMCPClient` 怎么接多个 MCP 服务
- MCP 的 `tools`、`resources`、`prompts`、`structuredContent`、stateful session 怎么串起来
- 数据库、浏览器、企业文档服务的完整代码骨架怎么写

## 先建立一个工具分层心智模型

很多团队把所有外部能力都塞进一堆 `@tool` 函数里，短期能跑，长期会出现三个问题：

- 工具描述越来越长，模型选错工具的概率越来越高
- 同一能力无法被别的 Agent、别的语言、别的服务复用
- 需要会话状态的能力（登录态浏览器、长事务数据库、分页式文档 API）很难维护

更稳的分层是：

| 层级 | 适合放什么 | 典型例子 |
| --- | --- | --- |
| 进程内自定义 Tool | 轻量业务逻辑、格式转换、简单查询 | SKU 映射、规则引擎、单次 SQL 汇总 |
| Harness Tool | 代理执行环境能力 | `read_file`、`edit_file`、`execute`、`task`、`write_todos` |
| MCP | 需要标准化复用、隔离、跨进程状态的系统 | 数据库网关、浏览器自动化、企业知识库 |

一句话总结：

- 同进程、低延迟、你自己完全掌控：先用自定义 Tool。
- 文件系统、命令行、子代理这些“代理基础设施能力”：直接吃 Harness。
- 外部系统、长连接、跨团队共享能力：上 MCP。

## 一、自定义 Tool：普通函数够用时，不要先上协议

Deep Agents 可以直接吃普通 Python callable，也可以吃 LangChain 的 `@tool`。两者都能工作，但使用场景不同：

- 普通函数：最省事，适合内部辅助逻辑。
- `@tool`：需要自定义工具名、描述、参数 schema、`return_direct`、`ToolRuntime` 注入时更合适。

### 1. 普通函数：让 Deep Agents 自动推断 schema

下面这个例子是一个很轻量的“指标词典”工具。它没有协议层，没有额外注册成本，但足够给 Agent 提供稳定知识。

```python
from typing import Any


def lookup_metric_dictionary(metric_name: str, language: str = "zh-CN") -> dict[str, Any]:
    """查询业务指标口径，返回适合 LLM 阅读的结构化说明。"""
    glossary = {
        "gmv": {
            "zh-CN": {
                "metric": "GMV",
                "definition": "成交总额，包含已支付但未必已完成履约的订单金额。",
                "notes": [
                    "通常不等于已确认收入",
                    "退款和取消单需要按业务约定回冲",
                ],
            }
        },
        "net_revenue": {
            "zh-CN": {
                "metric": "Net Revenue",
                "definition": "扣除退款、折扣和税费后的净收入。",
                "notes": [
                    "更接近财务口径",
                    "适合做区域对比和利润分析",
                ],
            }
        },
    }

    metric = glossary.get(metric_name.lower())
    if not metric:
        return {
            "metric": metric_name,
            "found": False,
            "message": f"未找到指标 {metric_name} 的口径说明",
        }

    return {
        "metric": metric_name,
        "found": True,
        "content": metric.get(language, metric["zh-CN"]),
    }
```

接入 Agent 时不需要额外包装：

```python
from deepagents import create_deep_agent


agent = create_deep_agent(
    model="openai:gpt-5.5",
    tools=[lookup_metric_dictionary],
)
```

这个层级的优点是快，缺点也很明显：

- 工具说明主要依赖函数名和 docstring
- 参数控制能力有限
- 如果你要给模型更强的参数约束，普通函数通常不如 `@tool`

### 2. `@tool`：把参数、描述、返回语义讲清楚

当你要让模型稳定地查数据库、带筛选条件聚合数据时，`@tool` 更合适。下面是一个完整的 SQLite 示例，代码包含初始化、样例数据和查询逻辑。

```python
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Literal

from langchain.tools import tool
from pydantic import BaseModel, Field


DB_PATH = Path("data/analytics.db")


def bootstrap_demo_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sales_orders (
                order_id TEXT PRIMARY KEY,
                region TEXT NOT NULL,
                order_date TEXT NOT NULL,
                revenue REAL NOT NULL
            )
            """
        )

        existing = conn.execute("SELECT COUNT(*) FROM sales_orders").fetchone()[0]
        if existing == 0:
            conn.executemany(
                """
                INSERT INTO sales_orders(order_id, region, order_date, revenue)
                VALUES (?, ?, ?, ?)
                """,
                [
                    ("SO-1001", "APAC", "2026-06-01", 12000.0),
                    ("SO-1002", "APAC", "2026-06-18", 14500.0),
                    ("SO-1003", "APAC", "2026-07-02", 17800.0),
                    ("SO-1004", "EMEA", "2026-06-03", 9800.0),
                    ("SO-1005", "EMEA", "2026-07-05", 11100.0),
                ],
            )
        conn.commit()


class RevenueQuery(BaseModel):
    region: str = Field(description="销售区域，例如 APAC、EMEA、NA")
    start_date: str = Field(description="开始日期，格式 YYYY-MM-DD")
    end_date: str = Field(description="结束日期，格式 YYYY-MM-DD")
    granularity: Literal["day", "month"] = Field(
        default="month",
        description="按天或按月聚合",
    )


@tool("query_sales_revenue", args_schema=RevenueQuery)
def query_sales_revenue(
    region: str,
    start_date: str,
    end_date: str,
    granularity: str = "month",
) -> dict:
    """按区域和时间范围聚合销售额，返回结构化结果。"""
    bootstrap_demo_db()

    bucket_expr = {
        "day": "order_date",
        "month": "substr(order_date, 1, 7)",
    }[granularity]

    sql = f"""
        SELECT
            {bucket_expr} AS bucket,
            ROUND(SUM(revenue), 2) AS total_revenue,
            COUNT(*) AS order_count
        FROM sales_orders
        WHERE region = :region
          AND order_date BETWEEN :start_date AND :end_date
        GROUP BY bucket
        ORDER BY bucket
    """

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = [
            dict(row)
            for row in conn.execute(
                sql,
                {
                    "region": region,
                    "start_date": start_date,
                    "end_date": end_date,
                },
            )
        ]

    grand_total = round(sum(row["total_revenue"] for row in rows), 2)

    return {
        "region": region,
        "start_date": start_date,
        "end_date": end_date,
        "granularity": granularity,
        "grand_total": grand_total,
        "rows": rows,
    }
```

接入方式：

```python
from deepagents import create_deep_agent


agent = create_deep_agent(
    model="openai:gpt-5.5",
    tools=[lookup_metric_dictionary, query_sales_revenue],
)
```

### 3. 什么时候必须用 `@tool`

当你遇到下面这些需求时，优先用 `@tool`：

- 需要更清晰的工具名和描述
- 需要 `args_schema` 做强约束
- 需要 `return_direct=True` 直接把工具结果返回给用户
- 需要 `ToolRuntime` 访问 state、context、store、stream writer

工程上最重要的一点是：**工具 docstring 不是注释，而是模型的 API 文档。**

如果 docstring 写得含糊，模型就会：

- 误用工具
- 缺参数
- 在多个相似工具之间摇摆

所以，工具设计时至少保证三件事：

1. 名字用 `snake_case`
2. docstring 明确“什么时候用”
3. 参数字段名和描述都站在模型视角写

## 二、Harness 内置 Tool：你没有手动注册，但它们一直都在

Deep Agents 的另一个优势是：就算你什么工具都不传，Harness 也会带一套基础执行能力。官方文档当前列出的内置工具包括：

- `ls`
- `read_file`
- `write_file`
- `edit_file`
- `delete`
- `glob`
- `grep`
- `execute`
- `task`
- `write_todos`

这套工具不是“业务工具”，而是“代理基础设施工具”。

### 1. 它们分别解决什么问题

| 工具 | 作用 |
| --- | --- |
| `read_file` / `write_file` / `edit_file` | 读写项目文件，形成闭环执行 |
| `glob` / `grep` / `ls` | 找文件、找文本、建立局部上下文 |
| `execute` | 调 shell 命令，适合脚本型操作 |
| `task` | 把问题拆给子代理 |
| `write_todos` | 显式维护任务清单，降低长链任务丢步 |
| `delete` | 清理文件或目录，风险最高 |

### 2. Harness Tool 的核心价值

Harness Tool 最大的价值不是“多”，而是它们让 Agent 具备了可执行环境：

- 会先 `write_todos` 拆解任务
- 再 `grep`、`glob`、`read_file` 建立代码上下文
- 需要重活时用 `task` 派子代理
- 最后用 `edit_file`、`write_file`、`execute` 真的改东西

也就是说，Harness Tool 解决的是“代理怎么工作”，不是“业务系统怎么接”。

### 3. 不要手动重复实现 Harness 已有能力

很多人第一次做 Agent 时会自己写这些工具：

- `search_files`
- `read_local_file`
- `run_shell_command`
- `spawn_worker_agent`

如果你已经在 Deep Agents 里，这些能力大多已经由 Harness 提供。重复实现只会带来两个坏处：

- 工具列表冗余，模型更难选
- 权限控制和中断审批分散在两套机制里

### 4. 对高风险 Harness Tool 加人工审批

真正的生产实践不是“给 Agent 最多权限”，而是“给它可审计的最小权限”。对于 `delete`、`execute` 这类高风险工具，推荐直接配置 human-in-the-loop。

```python
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver


checkpointer = MemorySaver()

agent = create_deep_agent(
    model="openai:gpt-5.5",
    tools=[lookup_metric_dictionary, query_sales_revenue],
    interrupt_on={
        "delete": True,
        "execute": {"allowed_decisions": ["approve", "reject"]},
    },
    checkpointer=checkpointer,
)
```

这个配置背后的思路很简单：

- 业务读查询工具默认放行
- 会改环境的 Harness Tool 默认拦截
- 把风险控制放在 Harness 层，而不是把每个业务工具都做成人工审批

## 三、什么时候该把能力升级成 MCP

如果一个能力满足下面任意两条，就应该认真考虑 MCP：

- 不是单纯 Python 逻辑，而是外部系统接入
- 需要被多个 Agent 或多个项目复用
- 需要独立部署、独立鉴权、独立限流
- 需要资源读取、提示模板、结构化输出
- 需要会话状态，而不是“一次调用就结束”

MCP 的好处不是“更高级”，而是**把能力标准化**。

标准化以后，一个服务不只暴露 `tools`，还可以同时暴露：

- `resources`：只读上下文，比如报表、文档、配置、页面快照
- `prompts`：预制消息模板，比如“请按安全视角审查这份文档”
- `structuredContent`：让工具返回人能看、程序也能吃的数据

## 四、用 FastMCP 封装三个真实系统

下面我们直接写三个 MCP 服务：

1. 数据库服务：负责读销售数据
2. 浏览器服务：负责打开页面并提取内容
3. 企业文档服务：负责检索和读取内部文档

### 1. 数据库 MCP 服务：Tool + Resource + Prompt 一起暴露

文件：`analytics_db_server.py`

```python
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from fastmcp import FastMCP
from fastmcp.tools.tool import ToolResult


DB_PATH = Path("data/analytics.db")
mcp = FastMCP("analytics-db")


def bootstrap_demo_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sales_orders (
                order_id TEXT PRIMARY KEY,
                region TEXT NOT NULL,
                order_date TEXT NOT NULL,
                revenue REAL NOT NULL
            )
            """
        )

        existing = conn.execute("SELECT COUNT(*) FROM sales_orders").fetchone()[0]
        if existing == 0:
            conn.executemany(
                """
                INSERT INTO sales_orders(order_id, region, order_date, revenue)
                VALUES (?, ?, ?, ?)
                """,
                [
                    ("SO-1001", "APAC", "2026-06-01", 12000.0),
                    ("SO-1002", "APAC", "2026-06-18", 14500.0),
                    ("SO-1003", "APAC", "2026-07-02", 17800.0),
                    ("SO-1004", "EMEA", "2026-06-03", 9800.0),
                    ("SO-1005", "EMEA", "2026-07-05", 11100.0),
                ],
            )
        conn.commit()


@mcp.tool(
    annotations={
        "readOnlyHint": True,
        "idempotentHint": True,
    }
)
def run_revenue_query(region: str, start_date: str, end_date: str) -> ToolResult:
    """按区域和时间范围汇总营收。"""
    bootstrap_demo_db()

    sql = """
        SELECT
            substr(order_date, 1, 7) AS month_bucket,
            ROUND(SUM(revenue), 2) AS total_revenue,
            COUNT(*) AS order_count
        FROM sales_orders
        WHERE region = :region
          AND order_date BETWEEN :start_date AND :end_date
        GROUP BY month_bucket
        ORDER BY month_bucket
    """

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = [
            dict(row)
            for row in conn.execute(
                sql,
                {
                    "region": region,
                    "start_date": start_date,
                    "end_date": end_date,
                },
            )
        ]

    grand_total = round(sum(row["total_revenue"] for row in rows), 2)

    return ToolResult(
        content=(
            f"{region} 在 {start_date} 到 {end_date} 的总营收为 {grand_total}。"
            f" 共返回 {len(rows)} 个聚合桶。"
        ),
        structured_content={
            "region": region,
            "start_date": start_date,
            "end_date": end_date,
            "grand_total": grand_total,
            "rows": rows,
        },
        meta={"source": "analytics-db", "currency": "USD"},
    )


@mcp.resource(
    "warehouse://report/{report_id}",
    annotations={
        "readOnlyHint": True,
        "idempotentHint": True,
    },
)
def get_report(report_id: str) -> str:
    """返回一个报表资源。"""
    reports = {
        "2026-q2-apac": {
            "report_id": "2026-q2-apac",
            "title": "APAC Q2 Revenue Snapshot",
            "summary": "APAC 区域连续两个月增长，主要由渠道订单拉动。",
            "risks": ["新折扣政策尚未完全同步到区域销售团队"],
        }
    }
    return json.dumps(reports.get(report_id, {"report_id": report_id, "summary": "not found"}), ensure_ascii=False)


@mcp.prompt
def finance_review(report_id: str, focus: str = "异常波动") -> str:
    """生成财务分析提示词。"""
    return (
        f"请以财务分析师身份审阅资源 warehouse://report/{report_id}。"
        f"重点关注：{focus}。"
        "输出请分为现象、原因、建议三个部分。"
    )


if __name__ == "__main__":
    mcp.run(transport="stdio")
```

这个服务一口气示范了三件事：

- `tool` 负责执行查询
- `resource` 负责暴露可读报表
- `prompt` 负责暴露可复用的消息模板

最关键的是 `ToolResult(... structured_content=...)`。这意味着：

- 大模型能看到可读文本摘要
- 你的程序还能拿到机器可解析的结构化数据

这就是 MCP `structuredContent` 的价值。

### 2. 浏览器 MCP 服务：典型的 stateful server

文件：`browser_mcp_server.py`

```python
from __future__ import annotations

import json

from fastmcp import FastMCP
from playwright.async_api import Browser, Page, Playwright, async_playwright


mcp = FastMCP("browser-ops")
_playwright: Playwright | None = None
_browser: Browser | None = None
_page: Page | None = None


async def get_page() -> Page:
    global _playwright, _browser, _page

    if _playwright is None:
        _playwright = await async_playwright().start()

    if _browser is None:
        _browser = await _playwright.chromium.launch(headless=True)

    if _page is None:
        _page = await _browser.new_page()

    return _page


@mcp.tool
async def open_page(url: str) -> dict:
    """打开页面并返回标题与最终 URL。"""
    page = await get_page()
    await page.goto(url, wait_until="domcontentloaded")
    return {
        "url": page.url,
        "title": await page.title(),
    }


@mcp.tool
async def click_selector(css_selector: str) -> str:
    """点击页面元素。"""
    page = await get_page()
    await page.locator(css_selector).first.click()
    return f"clicked: {css_selector}"


@mcp.tool
async def extract_visible_text(css_selector: str = "body", max_chars: int = 4000) -> str:
    """提取页面可见文本。"""
    page = await get_page()
    text = await page.locator(css_selector).first.inner_text()
    return text[:max_chars]


@mcp.resource("browser://current-page")
async def current_page_snapshot() -> str:
    """读取当前页面状态。"""
    page = await get_page()
    payload = {
        "url": page.url,
        "title": await page.title(),
    }
    return json.dumps(payload, ensure_ascii=False)


if __name__ == "__main__":
    mcp.run(transport="stdio")
```

这个服务故意把页面对象保存在进程内全局变量里，就是为了说明“浏览器是天然 stateful 的”：

- 先 `open_page()`
- 再 `click_selector()`
- 再 `extract_visible_text()`

这三步如果不在**同一 MCP session** 里执行，页面状态就丢了。

### 3. 企业文档 MCP 服务：把内部知识库统一成标准接口

下面这个例子不绑定具体厂商。无论你后面接的是 Confluence、SharePoint、Notion，还是公司内部知识库网关，这个骨架都成立。

文件：`enterprise_docs_server.py`

```python
from __future__ import annotations

import json
import os

import httpx
from fastmcp import FastMCP
from fastmcp.tools.tool import ToolResult


DOCS_BASE_URL = os.environ["DOCS_BASE_URL"]
DOCS_API_TOKEN = os.environ["DOCS_API_TOKEN"]
mcp = FastMCP("enterprise-docs")


async def request_json(path: str, params: dict | None = None) -> dict:
    headers = {
        "Authorization": f"Bearer {DOCS_API_TOKEN}",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(base_url=DOCS_BASE_URL, timeout=20.0) as client:
        response = await client.get(path, params=params, headers=headers)
        response.raise_for_status()
        return response.json()


@mcp.tool(
    annotations={
        "readOnlyHint": True,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
async def search_enterprise_docs(query: str, space: str = "engineering", limit: int = 5) -> ToolResult:
    """搜索企业文档服务中的页面。"""
    data = await request_json(
        "/search",
        params={"q": query, "space": space, "limit": limit},
    )

    results = data.get("results", [])
    lines = [
        f"- {item['title']} (doc_id={item['id']})"
        for item in results
    ] or ["- 没有检索到结果"]

    return ToolResult(
        content="检索结果：\n" + "\n".join(lines),
        structured_content={
            "query": query,
            "space": space,
            "results": results,
        },
    )


@mcp.resource("kb://document/{doc_id}")
async def get_document(doc_id: str) -> str:
    """读取指定文档。"""
    data = await request_json(f"/documents/{doc_id}")
    payload = {
        "id": data["id"],
        "title": data["title"],
        "content_markdown": data["content_markdown"],
        "updated_at": data["updated_at"],
    }
    return json.dumps(payload, ensure_ascii=False)


@mcp.prompt
def summarize_policy_change(doc_id: str, audience: str = "engineering") -> str:
    """生成针对政策变更文档的总结提示。"""
    return (
        f"请阅读资源 kb://document/{doc_id}，"
        f"面向 {audience} 总结这份文档的变化点、影响范围和落地动作。"
    )


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
```

这个服务体现的重点是：

- `tool` 用于“搜索”
- `resource` 用于“读取”
- `prompt` 用于“规定分析姿势”

企业系统接入时，这种分工比单纯暴露一个 `search_docs` 工具更稳定。

## 五、客户端接入：`MultiServerMCPClient` 把多个系统接成一个 Agent

有了三个 MCP 服务，客户端就可以统一接入。这里先给出最常见的**无状态接法**。

文件：`mcp_agent_stateless.py`

```python
import asyncio

from deepagents import create_deep_agent
from langchain_mcp_adapters.client import MultiServerMCPClient


async def main() -> None:
    client = MultiServerMCPClient(
        {
            "analytics_db": {
                "transport": "stdio",
                "command": "python",
                "args": ["analytics_db_server.py"],
            },
            "browser": {
                "transport": "stdio",
                "command": "python",
                "args": ["browser_mcp_server.py"],
            },
            "enterprise_docs": {
                "transport": "http",
                "url": "http://127.0.0.1:8090/mcp",
                "headers": {
                    "Authorization": "Bearer internal-gateway-token",
                },
            },
        }
    )

    tools = await client.get_tools()

    agent = create_deep_agent(
        model="openai:gpt-5.5",
        tools=tools,
    )

    result = await agent.ainvoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": "先搜索内部文档里的 SEC-017，然后汇总 APAC 最近两个月营收。",
                }
            ]
        },
        config={"configurable": {"thread_id": "tool-demo-stateless"}},
    )

    print(result)


if __name__ == "__main__":
    asyncio.run(main())
```

这段代码很适合：

- 单次查询
- 无需保持外部状态
- 工具之间互相独立

但要注意，`MultiServerMCPClient` 默认是**stateless** 的。也就是每次工具调用都可能建立新的 MCP `ClientSession`，调用完就清理。

这对数据库只读查询通常没问题，但对浏览器、登录态文档系统、多步事务流程就不够了。

## 六、stateful session：浏览器、多步工作流必须显式持久化

下面是更接近真实生产的写法：对需要状态的服务显式创建 session，再从 session 里加载 tools、resources、prompts。

文件：`mcp_agent_stateful.py`

```python
import asyncio

from deepagents import create_deep_agent
from langchain.messages import HumanMessage, ToolMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.prompts import load_mcp_prompt
from langchain_mcp_adapters.resources import load_mcp_resources
from langchain_mcp_adapters.tools import load_mcp_tools


async def main() -> None:
    client = MultiServerMCPClient(
        {
            "analytics_db": {
                "transport": "stdio",
                "command": "python",
                "args": ["analytics_db_server.py"],
            },
            "browser": {
                "transport": "stdio",
                "command": "python",
                "args": ["browser_mcp_server.py"],
            },
            "enterprise_docs": {
                "transport": "http",
                "url": "http://127.0.0.1:8090/mcp",
                "headers": {
                    "Authorization": "Bearer internal-gateway-token",
                },
            },
        }
    )

    async with client.session("analytics_db") as db_session, \
        client.session("browser") as browser_session, \
        client.session("enterprise_docs") as docs_session:

        db_tools = await load_mcp_tools(db_session)
        browser_tools = await load_mcp_tools(browser_session)
        docs_tools = await load_mcp_tools(docs_session)

        review_prompt = await load_mcp_prompt(
            docs_session,
            "summarize_policy_change",
            arguments={
                "doc_id": "SEC-017",
                "audience": "engineering managers",
            },
        )

        report_blobs = await load_mcp_resources(
            db_session,
            uris=["warehouse://report/2026-q2-apac"],
        )
        report_context = "\n\n".join(blob.as_string() for blob in report_blobs)

        agent = create_deep_agent(
            model="openai:gpt-5.5",
            tools=[*db_tools, *browser_tools, *docs_tools],
        )

        result = await agent.ainvoke(
            {
                "messages": [
                    *review_prompt,
                    HumanMessage(
                        content=(
                            "请先打开发布说明页面 https://intranet.example.com/releases/sec-017 ，"
                            "再结合下面的 APAC 报表，判断这次政策变更是否会影响销售执行。\n\n"
                            f"报表摘要：\n{report_context}"
                        )
                    ),
                ]
            },
            config={"configurable": {"thread_id": "tool-demo-stateful"}},
        )

        for message in result["messages"]:
            if isinstance(message, ToolMessage) and message.artifact:
                structured = message.artifact.get("structured_content")
                if structured:
                    print(message.name, structured)


if __name__ == "__main__":
    asyncio.run(main())
```

这段代码同时演示了五件事：

1. `client.session("server_name")` 显式创建持久会话
2. `load_mcp_tools(session)` 把 MCP tools 绑定到当前 session
3. `load_mcp_resources(session, uris=...)` 直接读资源
4. `load_mcp_prompt(session, ...)` 把 prompt 模板拿回来当消息前缀
5. 通过 `ToolMessage.artifact["structured_content"]` 读取结构化结果

### 为什么浏览器场景必须这样写

因为浏览器工作流天然依赖状态：

- 第 1 步打开页面
- 第 2 步点击按钮
- 第 3 步读取点击后的内容

如果每次工具调用都新建 session，浏览器页签、cookie、DOM 状态全会丢失。

所以，**需要跨多次调用保留上下文的 MCP 服务，都要优先考虑 stateful session。**

## 七、MCP 里的 Resources、Prompts、Structured Content 到底怎么分工

很多人接入 MCP 后，只会用 `tools`，这其实只用了协议的一半。

### 1. Tools：做动作

适合：

- 查数据库
- 点浏览器
- 调企业 API
- 执行计算

特点：

- 可执行
- 可带副作用
- 由模型主动选择调用

### 2. Resources：给上下文

适合：

- 报表快照
- 配置文件
- 页面当前状态
- 某个文档正文

特点：

- 只读
- 更像“标准化上下文入口”
- 不应该和执行动作混在一起

上面的例子里：

- `warehouse://report/2026-q2-apac` 是资源
- `kb://document/SEC-017` 也是资源
- `browser://current-page` 则把浏览器状态抽象成了资源

### 3. Prompts：给思路，不给数据

适合：

- 固定分析模板
- 固定输出格式
- 特定角色视角

比如：

- `finance_review(report_id, focus)`
- `summarize_policy_change(doc_id, audience)`

Prompt 不负责执行，不负责读数据，它负责把“这类问题应该怎么问模型”标准化。

### 4. Structured Content：给程序稳定落地

工具返回纯文本时，模型可以看，但程序后处理很脆弱。

工具返回 `structuredContent` 时：

- 模型照样能看到文本摘要
- 程序可以直接读 JSON 结构
- 你可以做自动化分支、图表渲染、结果落库、审计日志

上面数据库工具返回的：

```json
{
  "region": "APAC",
  "grand_total": 44300.0,
  "rows": [
    {
      "month_bucket": "2026-06",
      "total_revenue": 26500.0,
      "order_count": 2
    }
  ]
}
```

这类结构就非常适合：

- 交给前端渲染图表
- 交给下一个工具继续处理
- 作为审计对象持久化

## 八、MCP session 的协议生命周期，为什么你要关心

MCP 不是“发个 HTTP 请求”那么简单。它有明确的生命周期：

1. `initialize`
2. 能力协商
3. `initialized`
4. 正常运行
5. 关闭连接

这件事在工程上影响很大，因为 session 不是一个抽象概念，而是：

- 登录态是否复用
- 浏览器状态是否保留
- 工具列表、资源列表、prompt 列表是否被协商成功
- 资源订阅和列表变更通知能不能生效

换句话说：

- 一次性只读工具，stateless 更简单
- 多步流程、有缓存、有页面状态、有鉴权上下文，stateful 更合理

## 九、把三层工具体系放到一个项目里，推荐这样组织

一个比较稳的仓库结构通常长这样：

```text
app/
├─ agents/
│  └─ release_review_agent.py
├─ tools/
│  └─ custom_tools.py
├─ mcp_servers/
│  ├─ analytics_db_server.py
│  ├─ browser_mcp_server.py
│  └─ enterprise_docs_server.py
└─ clients/
   └─ mcp_agent_stateful.py
```

职责分工建议：

- `tools/`：放进程内工具，保持轻量
- `mcp_servers/`：放可复用、可独立部署的系统适配层
- `agents/`：只关心编排，不直接写数据库/浏览器实现细节

这样做的结果是：

- Agent 编排和系统接入解耦
- 同一个 MCP 服务可复用给多个 Agent
- 你可以单独治理文档权限、数据库权限、浏览器权限

## 十、实战中的常见坑

### 1. 把所有能力都做成普通 `@tool`

短期快，长期会遇到：

- 工具数量膨胀
- 描述冲突
- 无法独立部署和鉴权

经验法则：外部系统接入一旦开始复用，就迁到 MCP。

### 2. 工具只返回长文本，不返回结构化结果

后果是：

- 模型能用，程序难用
- 结果无法稳定做自动化处理

能结构化的内容，尽量同时返回 `structuredContent`。

### 3. 用默认 stateless client 驱动有状态浏览器

这是最常见的坑之一。现象通常是：

- 第一步打开了页面
- 第二步再调用时页面“像没打开过一样”

原因不是 Playwright 坏了，而是 session 生命周期不对。

### 4. 重复造 Harness Tool

如果你已经在 Deep Agents 里，还自己再写一套 `read_file`、`run_shell`、`spawn_subagent`，通常是在给模型增加噪音，而不是增加能力。

### 5. 不做风险分级

不是每个工具都应该一视同仁。建议至少分三档：

- 低风险：只读查询、只读资源
- 中风险：发起外部请求、写内部系统草稿
- 高风险：删除、执行命令、写生产数据

高风险工具尽量结合 Harness 的中断审批或你自己的审批机制。

## 十一、怎么选：自定义 Tool、Harness Tool、MCP

最后给一个简单但实用的决策表：

| 问题 | 推荐方案 |
| --- | --- |
| 只是把一段 Python 逻辑暴露给 Agent？ | 自定义函数或 `@tool` |
| 需要文件、命令、todo、子代理能力？ | 直接用 Harness Tool |
| 需要接数据库、浏览器、知识库等外部系统？ | MCP |
| 需要多个 Agent 共享同一能力？ | MCP |
| 需要跨多次调用保留状态？ | MCP + stateful session |
| 需要标准化上下文入口？ | MCP resources |
| 需要标准化分析模板？ | MCP prompts |
| 需要机器可读结果？ | `structuredContent` |

## 结语

工具层不是 Agent 的附件，而是 Agent 的执行面。

真正可维护的 Deep Agents 工程，往往不是“工具越多越好”，而是：

- 进程内逻辑留在自定义 Tool
- 执行环境能力交给 Harness
- 外部系统集成交给 MCP
- 有状态流程明确使用 stateful session
- 所有关键结果尽量结构化输出

当你按这个分层来设计时，Agent 才会从“能演示”走向“能长期维护”。

## 参考资料

- [LangChain Tools](https://docs.langchain.com/oss/python/langchain/tools)
- [Deep Agents Tools](https://docs.langchain.com/oss/python/deepagents/tools)
- [LangChain MCP Guide](https://docs.langchain.com/oss/python/langchain/mcp)
- [MCP Lifecycle Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle)
- [MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [MCP Resources Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/resources)
- [MCP Prompts Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts)
- [FastMCP Tools Docs](https://gofastmcp.com/servers/tools)
- [FastMCP Resources Docs](https://gofastmcp.com/servers/resources)
- [FastMCP Prompts Docs](https://gofastmcp.com/servers/prompts)
