---
layout: doc
title: DeepAgents 入门：概念、定位与本地开发环境搭建
category: DeepAgents
date: '2026-07-06'
tags:
  - DeepAgents
  - LangChain
  - LangGraph
  - Agent
  - uv
---

# DeepAgents 入门：概念、定位与本地开发环境搭建

很多人第一次接触 DeepAgents，会把它和“带工具调用的聊天机器人”混为一谈。这个理解不能说完全错，但明显不够。`DeepAgents` 解决的不是“让模型偶尔调一个工具”的问题，而是“让模型在较长任务里持续规划、拆解、调用工具、维护状态，并在需要时把子任务交给别的 agent 去做”的问题。

如果你已经接触过 `Chatbot`、`Workflow`、`LLM Agent`、`LangChain`、`LangGraph` 这些词，这篇文章的目标就是把它们放到一张清晰的地图里，然后带你从零搭起一个本地可运行的最小 DeepAgents 项目。

## 什么是 DeepAgents

可以把 DeepAgents 理解为一层面向复杂任务的 Agent 工程化封装：

- 它不是单独的大模型。
- 它也不是只会“问一句答一句”的聊天壳。
- 它建立在 LangChain/LangGraph 生态之上，提供更强的任务分解、上下文管理、子代理协作和执行控制能力。

从官方定位看，DeepAgents 是一个“开箱即用、内置电池”的 agent harness。它的目标不是让你从零手搓一整套多 agent 系统，而是给你一套已经带有复杂任务执行能力的基础骨架，你在这个骨架上继续补业务工具、提示词和权限约束即可。

换句话说，DeepAgents 更像：

- 一套复杂任务执行框架
- 一套带默认工程约定的 agent runtime
- 一套站在 LangGraph 之上的高层应用入口

而不是：

- 一个新的模型供应商
- 一个新的向量库
- 一个简单的对话 SDK

## DeepAgents、传统 LLM Agent、Workflow、Chatbot 的区别

这几个概念最容易混。区分它们时，最有用的不是看“有没有调用工具”，而是看它们怎么执行任务、怎么维护状态、怎么处理不确定性。

| 形态 | 核心执行方式 | 状态管理 | 适合场景 | 主要短板 |
| --- | --- | --- | --- | --- |
| Chatbot | 单轮或多轮对话，主要靠提示词直接回答 | 通常只有聊天历史 | FAQ、陪聊、轻问答 | 很难稳定完成多步骤任务 |
| Workflow | 预先写死执行路径，按固定步骤流转 | 由代码显式维护 | 审批流、ETL、固定报表 | 对异常和开放任务适应差 |
| 传统 LLM Agent | 模型根据上下文决定是否调用工具 | 有基本消息状态和工具结果 | 通用工具调用、简单任务自动化 | 长任务容易漂移，规划与上下文控制不够强 |
| DeepAgents | 在 agent 基础上强化规划、拆解、子任务委派、上下文管理 | 有更完整的运行状态与长期执行能力 | 编码、研究、文档整理、跨工具复杂任务 | 成本更高，工程治理要求更高 |

可以用一句话概括：

- `Chatbot` 重点是对话。
- `Workflow` 重点是确定性流程。
- `传统 LLM Agent` 重点是工具增强。
- `DeepAgents` 重点是复杂任务执行。

## DeepAgents 在 LangChain 栈里的定位

很多初学者会问：`LangChain`、`LangGraph`、`DeepAgents` 到底谁负责什么？

一个好记的分层方式是：

```text
模型提供方（OpenAI / Anthropic / 兼容 OpenAI 的平台）
        ↓
LangChain：统一模型、消息、工具、提示词等基础抽象
        ↓
LangGraph：负责状态图、节点、边、持久化、长任务执行
        ↓
DeepAgents：在上层提供面向复杂任务的 Agent 运行骨架
```

具体来说：

### 1. LangChain 负责“标准零件”

LangChain 主要负责统一这些能力：

- 模型调用接口
- 消息格式
- 工具定义
- 提示词组织
- 基础 agent 抽象

如果把 Agent 系统比作搭积木，LangChain 更像“积木标准件”。

### 2. LangGraph 负责“执行引擎”

LangGraph 的核心价值是把 LLM 应用从“单次调用”提升为“可编排、可恢复、可持久化的状态机”。它非常适合：

- 多步骤任务
- 条件分支
- 长时运行
- 人机协作
- 检查点恢复

如果说 LangChain 给你零件，那么 LangGraph 给你的就是“底盘和传动系统”。

### 3. DeepAgents 负责“复杂任务模式”

DeepAgents 站在更高一层，它把复杂任务里常见的模式进一步封装起来，例如：

- 任务拆解
- 上下文裁剪与管理
- 子 agent 协作
- 文件系统或工具密集型执行
- 更适合真实工作流的运行约定

所以它的定位不是替代 LangChain 或 LangGraph，而是：

- 基于 LangChain 的基础抽象
- 运行在 LangGraph 这类可持久化运行时之上
- 面向复杂任务提供更强的默认能力

## Agent 的基本组成：模型、工具、记忆、状态到底是什么关系

理解 DeepAgents，先要把 Agent 的四个核心部件拆开。

| 组件 | 作用 | 典型内容 | 关键问题 |
| --- | --- | --- | --- |
| 模型 | 做推理、生成、决策 | GPT、Claude、Qwen 等聊天模型 | 它该不该调用工具、下一步做什么 |
| 工具 | 连接外部世界 | 搜索、文件读写、数据库、HTTP、Shell | 它能做什么、权限到哪里 |
| 记忆 | 保留需要复用的信息 | 会话历史、用户偏好、长期知识 | 哪些信息要保留到后续轮次 |
| 状态 | 承载当前运行中的全部上下文 | messages、任务进度、工具结果、中间产物 | 当前这次执行到底进行到哪里 |

这里最容易混淆的是“记忆”和“状态”。

### 记忆不是状态，状态也不等于聊天记录

可以这样理解：

- `记忆` 是你希望系统“记住”的内容。
- `状态` 是系统这一次运行中“正在携带”的内容。

举个例子。一个 DeepAgent 在帮你整理项目周报时：

- 用户姓名、偏好的输出格式，这些更像长期记忆。
- 当前已经分析了哪些文件、调用过哪些工具、草稿写到第几段，这些属于运行状态。

状态通常会比记忆更宽：

- 记忆是状态的一部分。
- 但状态还包含临时变量、分支决策、中间结果、错误信息、待执行任务等。

### 模型通过状态理解任务，通过工具改变世界

在实际运行里，四者关系通常是：

1. 模型读取当前状态
2. 模型判断下一步是直接回答还是调用工具
3. 工具返回结果，更新状态
4. 需要保留的内容再写入记忆
5. 系统继续下一步，直到得到最终输出

这也是为什么 Agent 系统设计里，真正的安全边界不应该只靠提示词，而应该靠：

- 工具能力设计
- 工具权限控制
- 运行环境隔离
- 状态与记忆的审计能力

## 什么任务适合用 DeepAgents

DeepAgents 并不是越高级越该上。它适合的是那些“一个模型回复远远不够”的任务。

比较典型的场景有：

- 代码生成后还要继续读文件、改文件、跑命令、修错误
- 研究任务需要分步骤搜集材料、对比、总结、复核
- 文档任务需要拆章节、逐段生成、回读上下文、反复修订
- 任务规模较大，需要多个子 agent 分工协作
- 任务不能一轮完成，需要中间状态、检查点或人工确认

不太适合的场景也很明确：

- 只是做问答机器人
- 只是固定规则的审批流
- 可以用普通脚本稳定完成的确定性流程
- 对时延和成本极其敏感的小任务

一个经验判断是：

如果任务的难点在“步骤多、上下文长、情况不确定、需要不断决定下一步”，DeepAgents 往往比普通 chatbot 或固定 workflow 更合适。

## 本地开发环境搭建

下面开始落到工程实践。为了让初学者最容易跑通，这里采用：

- Python 3.11+
- `uv` 管理环境和依赖
- `deepagents`
- `langchain-openai`
- `python-dotenv`

### 1. 准备前提

请先确认本地具备：

1. 已安装 Python 3.11 或更高版本
2. 已安装 `uv`
3. 已准备可用的模型 API Key
4. 如果使用 OpenAI 兼容网关，知道对应的 `base_url`

`uv` 安装完成后，可以先检查版本：

```bash
uv --version
python --version
```

### 2. 初始化最小项目

新建项目并安装依赖：

```bash
mkdir deepagents-starter
cd deepagents-starter
uv init --package deepagents_starter
uv add deepagents langchain-openai python-dotenv
```

如果你后续需要链路追踪，可以额外安装：

```bash
uv add langsmith
```

### 3. 推荐目录设计

对于入门项目，不要一开始就堆太多文件。先保持简单、可运行，再逐步演进。

```text
deepagents-starter/
├─ .env.example
├─ pyproject.toml
├─ README.md
└─ src/
   └─ deepagents_starter/
      ├─ __init__.py
      └─ main.py
```

这个结构背后的考虑是：

- `.env.example`：告诉团队需要哪些环境变量
- `pyproject.toml`：统一项目元数据和依赖
- `src/deepagents_starter/main.py`：先放一个最小可运行入口

等项目复杂后，再继续拆分成：

- `tools/`
- `prompts/`
- `memory/`
- `agents/`
- `workflows/`

但对初学者来说，第一步目标只有一个：先跑起来。

## API 配置

先创建 `.env.example`：

```dotenv
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=your_tool_calling_model_name
OPENAI_BASE_URL=
```

说明如下：

- `OPENAI_API_KEY`：模型服务凭证
- `OPENAI_MODEL`：你实际可用、支持工具调用的模型名
- `OPENAI_BASE_URL`：可选；如果你使用兼容 OpenAI 接口的平台，再填写它

真正本地运行时，你可以复制一份为 `.env`，并填入真实值。

## 最小可运行示例

下面给出完整的最小代码。这个例子做三件事：

- 接入一个聊天模型
- 注册两个简单工具
- 发起一次基础调用，让 agent 同时用到“时间查询”和“任务估算”

### `pyproject.toml`

```toml
[project]
name = "deepagents-starter"
version = "0.1.0"
description = "Minimal starter project for DeepAgents"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
  "deepagents",
  "langchain-openai",
  "python-dotenv",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

### `src/deepagents_starter/main.py`

```python
import os
from datetime import datetime
from zoneinfo import ZoneInfo

from deepagents import create_deep_agent
from dotenv import load_dotenv
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI


load_dotenv()


@tool
def get_beijing_time() -> str:
    """Return the current Beijing time."""
    now = datetime.now(ZoneInfo("Asia/Shanghai"))
    return now.strftime("%Y-%m-%d %H:%M:%S")


@tool
def estimate_story_points(task: str) -> str:
    """Estimate story points for a software task and explain briefly."""
    text = task.strip()
    length = len(text)

    if length < 20:
        points = 1
    elif length < 80:
        points = 3
    elif length < 160:
        points = 5
    else:
        points = 8

    return (
        f"建议 {points} 点。"
        f"依据：根据任务描述长度、可能涉及的实现范围和沟通成本做粗略估算。"
        f"任务内容：{text}"
    )


def build_model() -> ChatOpenAI:
    model_name = os.environ["OPENAI_MODEL"]
    api_key = os.environ["OPENAI_API_KEY"]
    base_url = os.getenv("OPENAI_BASE_URL")

    kwargs = {
        "model": model_name,
        "api_key": api_key,
        "temperature": 0,
    }

    if base_url:
        kwargs["base_url"] = base_url

    return ChatOpenAI(**kwargs)


def build_agent():
    return create_deep_agent(
        model=build_model(),
        tools=[get_beijing_time, estimate_story_points],
        system_prompt=(
            "你是一个严谨的技术助理。"
            "回答时先给结论，再给简短说明。"
            "当问题依赖外部事实或现时信息时，优先调用工具。"
        ),
    )


def main() -> None:
    agent = build_agent()

    result = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": (
                        "现在北京时间是多少？"
                        "另外请估算这个任务："
                        "为博客后台新增文章批量发布功能，并补 3 个集成测试。"
                    ),
                }
            ]
        }
    )

    print(result["messages"][-1].content)


if __name__ == "__main__":
    main()
```

### 运行方式

```bash
uv run python -m deepagents_starter.main
```

如果环境变量配置正确，你会看到 agent 返回一段组合结果：

- 先给出北京时间
- 再给出对任务点数的粗略估算

这说明最基本的三件事已经打通：

1. 模型可调用
2. 工具可调用
3. Agent 可根据问题自行决定工具使用

## 代码逐段讲解

初学者第一次看 Agent 代码，容易把重点放在“模型怎么连上”。实际上更应该关注“系统是怎么组织决策和执行的”。

### 1. `@tool` 定义的是 agent 的能力边界

这两个函数不是普通辅助函数，而是明确暴露给模型的外部能力：

- `get_beijing_time()`：提供时效性事实
- `estimate_story_points(task)`：提供一个简单的估算工具

模型本身不会真的知道“当前北京时间”。它只能决定要不要调用 `get_beijing_time`。

所以你应该把工具理解成：

- 模型可申请使用的能力
- 你作为工程师授予模型的权限边界

### 2. `build_model()` 负责隔离供应商配置

很多入门项目会把模型参数直接写死在业务代码里，这是后期最容易失控的地方。

单独做一个 `build_model()` 有两个好处：

- 后续切换模型提供方时，改动集中
- 可以把认证参数和 agent 逻辑解耦

如果未来你想替换成别的兼容接口，通常也只需要调整环境变量和这里的初始化代码。

### 3. `create_deep_agent(...)` 才是真正的 agent 装配点

这里发生了三件关键事情：

1. 绑定模型
2. 注册工具
3. 提供系统级行为约束

这一步之后，你得到的已经不是“一个模型客户端”，而是“一个可以自行决策是否调用工具的 agent”。

### 4. `agent.invoke(...)` 传入的是一次运行的初始状态

这里虽然只传了 `messages`，但你可以把它理解成“这次运行的入口状态”。

随着任务变复杂，状态里通常还会加入更多内容，例如：

- 当前任务 ID
- 中间草稿
- 审批标记
- 子任务结果
- 外部系统返回值

这也是 DeepAgents 和普通聊天接口的重要区别之一：它天然更适合承载“持续推进的任务状态”。

## 从最小示例到真实项目，通常怎么演进

一个真实可用的 DeepAgents 项目，一般会从上面的单文件版本逐步演进到下面这种结构：

```text
deepagents-project/
├─ .env.example
├─ pyproject.toml
├─ src/
│  └─ my_agent/
│     ├─ main.py
│     ├─ agent.py
│     ├─ tools/
│     │  ├─ file_tools.py
│     │  ├─ search_tools.py
│     │  └─ db_tools.py
│     ├─ prompts/
│     │  └─ system_prompt.txt
│     ├─ memory/
│     │  └─ store.py
│     └─ state/
│        └─ schema.py
└─ tests/
   └─ test_smoke.py
```

拆分时建议遵循这几个原则：

- 工具按外部系统边界拆，不要按函数名随便堆
- 提示词独立存放，避免和业务代码混在一起
- 状态结构尽早显式化，别让临时字段无序扩散
- 先有 smoke test，再谈复杂自治

## 初学者最常见的三个坑

### 1. 把 DeepAgents 当成“更聪明的 Chatbot”

如果只是做文档问答或轻客服，先用普通 chatbot 即可。DeepAgents 的价值在复杂任务，不在简单对话。

### 2. 工具给得太大，权限边界太模糊

例如直接给 agent 一个无限制的文件系统写权限、Shell 权限、数据库写权限，却没有任何隔离和审计。这样一开始也许方便，但后期一定难管。

正确思路是：

- 只暴露必要工具
- 尽量缩小工具能力面
- 让每个工具只做一类事

### 3. 没有显式设计状态

很多项目一开始“能跑”，后面一复杂就崩，根因往往不是模型不够强，而是：

- 中间结果没有结构化保存
- 工具输出格式不稳定
- 运行状态和长期记忆混在一起

一旦任务跨越多个步骤，状态设计就会直接决定系统可维护性。

## 一句话总结 LangChain、LangGraph、DeepAgents 的分工

如果你只记一件事，记住这句就够了：

- `LangChain` 提供统一抽象
- `LangGraph` 提供状态化运行时
- `DeepAgents` 提供复杂任务的高层 agent 形态

它们不是互斥关系，而是分层协作关系。

## 下一步可以继续学什么

当你已经跑通本文的最小示例后，下一阶段建议继续深入这些方向：

1. 给 agent 增加真正有业务价值的工具，例如文件检索、HTTP API、数据库查询
2. 把提示词从代码里拆出去，形成可维护的 prompt 资产
3. 开始显式定义状态结构，理解什么时候该上 LangGraph 的持久化和检查点
4. 再进一步学习子 agent 协作、人工审批、人机共治

## 参考资料

- DeepAgents 官方文档：<https://docs.langchain.com/oss/python/deepagents/overview>
- DeepAgents GitHub：<https://github.com/langchain-ai/deepagents>
- LangChain 官方概览：<https://docs.langchain.com/oss/python/langchain/overview>
- LangGraph 官方概览：<https://docs.langchain.com/oss/python/langgraph/overview>
