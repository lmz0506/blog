---
layout: doc
title: create_deep_agent 深度定制：模型、Prompt、Profiles 与 Structured Output
category: DeepAgents
date: '2026-07-11'
tags:
  - DeepAgents
  - LangChain
  - Middleware
  - Structured Output
  - HarnessProfile
---

# create_deep_agent 深度定制：模型、Prompt、Profiles 与 Structured Output

`Deep Agents` 的价值不只是“帮你起一个 Agent”。它真正有用的地方在于：你可以在不改动主调用形态的前提下，逐层定制模型、系统提示词、默认中间件、按模型生效的 profile，以及最终输出结构。

如果你只把 `create_deep_agent()` 当成一个“传 `model` 和 `tools` 就完事”的工厂函数，实际上只用到了它最表层的能力。官方文档给它的定位很明确：这是一个带有规划、文件系统、子代理、上下文管理等能力的“agent harness”，而不是一个最小化的 tool-calling loop。

这篇文章只围绕一个问题展开：

> 如何把 `create_deep_agent` 定制成一个可切换多模型、能按企业场景注入策略、并稳定返回结构化结果的企业助手？

下文会把定制点串起来讲清楚：

1. `model` 既可以传 `provider:model` 字符串，也可以传预初始化模型实例。
2. `system_prompt` 不是简单覆盖，而是参与官方定义的 prompt assembly。
3. `middleware` 不只是日志和重试，它还能动态改 prompt、动态切模型、动态裁剪工具。
4. `HarnessProfile` 负责“按 provider / model 自动生效”的差异化定制。
5. `response_format` 让 Agent 最终产出可验证、可直接进入业务系统的结构化对象。

## 一、先建立心智模型：`create_deep_agent` 到底在组装什么

官方参考文档给出的签名里，和“深度定制”最相关的参数有这些：

```python
create_deep_agent(
    model: str | BaseChatModel | None = None,
    tools: Sequence[...] | None = None,
    *,
    system_prompt: str | SystemMessage | None = None,
    middleware: Sequence[AgentMiddleware] = (),
    subagents: list[...] | None = None,
    skills: list[str] | None = None,
    memory: list[str] | None = None,
    response_format: ResponseFormat | None = None,
    context_schema: type[Any] | None = None,
    ...
) -> CompiledStateGraph
```

这意味着 `create_deep_agent` 的定制入口并不是单点，而是至少有四层：

- 模型层：`model`
- 提示词层：`system_prompt` + prompt assembly
- 执行链路层：`middleware`
- 模型专属覆盖层：`HarnessProfile`
- 输出契约层：`response_format`

理解这五层之后，你就不会把所有逻辑都粗暴塞进一个超长 `system_prompt` 里。

## 二、`model`：字符串适合切换，实例适合精调

### 1. 什么时候传字符串

最轻量的写法，是直接传 `provider:model`：

```python
from deepagents import create_deep_agent

agent = create_deep_agent(
    model="openai:gpt-5.5",
    system_prompt="You are an enterprise support assistant.",
)
```

这种方式的优点很直接：

- 切模型最快，只改一行配置。
- `create_deep_agent` 会替你调用 `init_chat_model`。
- 最适合“同一套 agent 逻辑，在不同 provider 间 A/B 测试”。

官方文档在 `Customization` 和 `Reference` 页面里都强调了这一点：`provider:model` 是推荐的快速切换格式。

### 2. 什么时候传模型实例

如果你需要：

- 单独控制 `timeout`、`max_retries`
- 给不同模型设置不同采样参数
- 在业务代码里预先初始化模型池
- 通过中间件在运行时切换具体模型实例

那就应该直接传模型实例。

```python
from deepagents import create_deep_agent
from langchain_openai import ChatOpenAI

model = ChatOpenAI(
    model="gpt-5.5",
    timeout=30,
    max_retries=2,
)

agent = create_deep_agent(
    model=model,
    system_prompt="You are an enterprise support assistant.",
)
```

### 3. 传实例时，Profiles 还会生效吗

会，但你要理解它的匹配规则。

官方 `Profiles` 文档说明：当你传的是预初始化模型实例而不是 `provider:model` 字符串时，Deep Agents 会先从实例合成一个规范化的 `provider:identifier`，然后按下面顺序查 profile：

1. 精确匹配 `provider:identifier`
2. 仅匹配 identifier（仅当 identifier 本身已经包含 `:`）
3. provider 级别兜底

这意味着一个重要实践：

> 如果你希望“传字符串”和“传模型实例”都命中同一套 profile，最好让模型实例的 provider 和 model id 足够明确。

### 4. 当前官方建议模型

截至 **2026-07-11**，Deep Agents `Models` 文档里的 suggested models 包括：

- Google：`gemini-3.1-pro-preview`、`gemini-3.5-flash`
- OpenAI：`gpt-5.5`、`gpt-5.4`
- Anthropic：`claude-opus-4-8`、`claude-opus-4-7`、`claude-opus-4-6`

这不是说你只能用这些模型，而是它们已经过官方 Deep Agents eval suite 的验证，更适合作为企业级起点。

## 三、`system_prompt`：不要把它误解成“覆盖默认提示词”

很多人第一次看到 `system_prompt`，自然会以为：

> 我传了自己的系统提示词，官方默认提示词就没了。

Deep Agents 不是这样工作的。

官方文档明确说，Deep Agents 自带一套内建 system prompt，因为模型必须知道 harness 提供了哪些脚手架能力，比如：

- 任务规划
- 文件系统工具
- 子代理
- 上下文管理

所以正确做法不是复制官方默认 prompt 再自己改，而是：

- 把你的业务角色和规则放进 `system_prompt`
- 让 Deep Agents 继续保留它对 harness 能力的解释
- 再用 profile 或 middleware 做增量覆盖

```python
agent = create_deep_agent(
    model="openai:gpt-5.5",
    system_prompt="""
You are ACME's enterprise support assistant.
Prioritize policy accuracy, cite internal policy IDs when available,
and escalate instead of guessing.
""",
)
```

## 四、Prompt Assembly：`USER -> BASE/CUSTOM -> SUFFIX`

这部分是 `create_deep_agent` 最容易被忽略、但最值得掌握的机制。

官方 `Customization` 文档说明，Deep Agents 会把系统提示词按最多四个命名片段组装：

| 片段 | 来源 | 作用 |
| --- | --- | --- |
| `USER` | 你传入的 `system_prompt=` | 调用方自己的业务指令 |
| `BASE` | SDK 默认 `BASE_AGENT_PROMPT` | Deep Agents 内建 harness 指导 |
| `CUSTOM` | `HarnessProfile.base_system_prompt` | 完整替换 `BASE` |
| `SUFFIX` | `HarnessProfile.system_prompt_suffix` | 在最后追加模型/Provider 专属规则 |

组装顺序永远是：

```text
USER -> (BASE or CUSTOM) -> SUFFIX
```

而且官方特别强调了两个不变量：

1. `USER` 永远在最前面。
2. `SUFFIX` 永远在最后面。

这两个不变量很重要，因为它们直接决定了你该把什么内容放在哪里。

### 1. 什么时候改 `system_prompt`

适合放：

- 业务身份
- 输出目标
- 领域约束
- “宁可升级，不可猜测”这类策略

### 2. 什么时候改 `base_system_prompt`

只在你明确要**替换掉官方默认 base prompt** 时使用。

这不是“增强默认 prompt”，而是“把默认 base 整块换掉”。如果你只是想微调模型行为，通常更应该用 `system_prompt_suffix`。

### 3. 什么时候改 `system_prompt_suffix`

最适合放：

- provider 专属提示
- model 专属风格约束
- 简短而稳定的行为后缀

例如：

- OpenAI 模型统一要求“输出简洁”
- Anthropic 模型统一要求“先进行内部分析，再给最终答复”

### 4. `SystemMessage` 不是装饰品

官方还提到一个高级细节：如果你传入的是 `SystemMessage` 而不是字符串，右侧组装结果会作为额外 text block 追加到它后面，且原有 `content_blocks` 上的标记会被保留。

这在 Anthropic prompt cache 之类的高级场景里很有用，但大多数业务场景下，字符串版 `system_prompt` 已经足够。

## 五、`middleware`：Deep Agents 真正的运行时控制层

官方文档给出的默认 middleware 栈包括：

- `TodoListMiddleware`
- `FilesystemMiddleware`
- `SubAgentMiddleware`
- `SummarizationMiddleware`
- `AnthropicPromptCachingMiddleware`
- `PatchToolCallsMiddleware`

当你启用 memory、skills 或 human-in-the-loop 时，还会自动加入对应 middleware。

这说明一个事实：

> Deep Agents 不是“模型 + tools”的薄封装，而是“模型 + 多层中间件”的组合运行时。

### 1. 中间件能做什么

根据官方 `LangChain Custom middleware` 文档，middleware 至少可以做这些事：

- 在模型调用前后检查和修改状态
- 包裹每次 model call 或 tool call
- 动态修改 system prompt
- 动态切换模型
- 动态筛选工具
- 做重试、审计、日志、缓存、监控

### 2. 对这篇主题最关键的两个能力

#### 动态改 prompt

官方示例直接使用 `request.system_message` 和 `request.override(system_message=...)` 来在每次模型调用前补充上下文。

这非常适合企业助手：

- 注入租户信息
- 注入合规边界
- 注入当前会话的优先级

#### 动态切模型

官方示例还展示了 `wrap_model_call` 中用 `request.override(model=model)` 根据上下文切换模型。

这就给了我们一个非常实用的架构：

- 日常问答走便宜、快的模型
- 复杂升级、疑难策略、长上下文分析切到强模型

### 3. 一个常见误区

Deep Agents 文档明确提醒：

> 不要在 middleware 实例属性上做可变状态累积。

原因很简单：subagents、并行工具调用、并发线程都可能同时运行，直接改 `self.xxx` 很容易产生竞态条件。要累积状态，请写回 graph state。

## 六、`HarnessProfile`：把“模型差异化策略”从业务代码里拿出来

如果说 `system_prompt` 是一次调用的定制，`HarnessProfile` 就是“按 provider / model 自动生效的定制包”。

官方 `Profiles` 文档给出的定义很清楚：它可以封装这些内容：

- `base_system_prompt`
- `system_prompt_suffix`
- `tool_description_overrides`
- `excluded_tools`
- `excluded_middleware`
- `extra_middleware`
- `general_purpose_subagent`

这正适合企业场景，因为企业通常不是“永远只跑一个模型”，而是：

- 不同 provider 有不同风格和成本
- 同一个 agent 需要在不同模型上保持一致业务行为
- 又希望针对个别模型做局部优化

### 1. 注册 key 的两层粒度

官方支持两种 key：

- provider 级：比如 `"openai"`
- model 级：比如 `"openai:gpt-5.5"`

当二者同时存在时：

- provider 级是基线
- model 级是在基线上覆盖

### 2. 合并规则值得记住

官方文档列出了 merge semantics，最实用的几条是：

- `base_system_prompt`、`system_prompt_suffix`：新值覆盖旧值
- `tool_description_overrides`：按 key 合并，新值覆盖旧值
- `excluded_tools`、`excluded_middleware`：集合并集
- `extra_middleware`：按名字合并，同名替换、不同名追加
- `general_purpose_subagent`：按字段合并

这意味着 `HarnessProfile` 不是“一次性替换”，而是可以层层叠加。

### 3. 企业里最常见的两个用法

#### 用法 A：按 provider 统一加后缀

例如对 OpenAI 模型统一要求：

- 回答更精炼
- 先引用政策 ID，再给建议

#### 用法 B：按模型隐藏危险工具

例如企业客服类 agent 根本不需要 shell 能力，那么直接通过：

```python
excluded_tools={"execute"}
```

把它拿掉，比在 prompt 里写“不要调用 execute”可靠得多。

### 4. 一个重要限制

官方文档还特别说明：

- `FilesystemMiddleware`
- `SubAgentMiddleware`
- 内部 permission middleware

这些属于必要脚手架，不能简单通过 `excluded_middleware` 去掉；如果你只是想让模型“看不到某些工具”，应该用 `excluded_tools`。

## 七、`response_format`：让 Deep Agent 从“会回答”升级为“能对接系统”

企业助手如果最终只是吐一段自然语言，往往还不够。

你通常还需要它给出：

- 分类标签
- 风险等级
- 下一步动作
- 是否升级
- 草拟回复

这就是 `response_format` 的价值。

官方文档说明，Deep Agents 支持结构化输出；你把 schema 传给 `create_deep_agent(response_format=...)` 之后，模型生成的结构化结果会被校验，并放到最终 state 的 `structured_response` 键里。

### 1. 最简单的写法：直接传 schema

```python
from pydantic import BaseModel, Field

class SupportDecision(BaseModel):
    priority: str = Field(description="low / medium / high / critical")
    needs_escalation: bool
    reply: str

agent = create_deep_agent(
    model="openai:gpt-5.5",
    response_format=SupportDecision,
)
```

### 2. 自动策略选择

LangChain 的结构化输出文档说明：

- 如果模型/provider 支持原生 structured output，就走 `ProviderStrategy`
- 否则走 `ToolStrategy`

也就是说，直接传 schema 往往已经够用。

### 3. 什么时候显式指定策略

如果你特别明确自己的意图，也可以手工指定：

```python
from langchain.agents.structured_output import ProviderStrategy, ToolStrategy

response_format = ProviderStrategy(SupportDecision)
# 或
response_format = ToolStrategy(SupportDecision)
```

### 4. 一个企业场景里的关键提醒

官方结构化输出文档提醒：如果 tools 也存在，模型必须支持**工具调用与结构化输出同时工作**。

而 Deep Agents 默认就带内建工具，所以这不是可忽略细节。选模型时，不能只看聊天质量，还要看它在 agent 场景里对 tool calling 和 structured output 的兼容性。

## 八、完整示例：一个可切换多模型的企业支持助手

下面这个示例把本文几个定制点放到同一个工程化版本里：

- `model` 支持字符串和模型实例两种入口
- `system_prompt` 只描述业务身份，不去复制官方 base prompt
- `middleware` 在运行时注入企业上下文、按复杂度切模型、记录工具调用
- `HarnessProfile` 对 OpenAI / Anthropic 做差异化覆盖
- `response_format` 返回稳定的 `SupportDecision`

```python
import os
from collections.abc import Callable
from typing import Literal

from deepagents import (
    GeneralPurposeSubagentProfile,
    HarnessProfile,
    create_deep_agent,
    register_harness_profile,
)
from langchain.agents.middleware import (
    ModelRequest,
    ModelResponse,
    wrap_model_call,
    wrap_tool_call,
)
from langchain.messages import SystemMessage, ToolMessage
from langchain.tools import tool
from langchain.tools.tool_node import ToolCallRequest
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langgraph.types import Command
from pydantic import BaseModel, Field


os.environ["OPENAI_API_KEY"] = "sk-..."
os.environ["ANTHROPIC_API_KEY"] = "sk-ant-..."


TENANT_CONTEXT = {
    "company": "ACME Cloud",
    "support_tier": "enterprise",
    "compliance": ["SOC 2", "ISO 27001"],
    "regions": ["us-east-1", "eu-west-1"],
}


@tool
def search_kb(query: str) -> list[dict]:
    """Search internal knowledge base articles relevant to the user's issue."""
    return [
        {
            "doc_id": "KB-1421",
            "title": "SAML login loops after IdP metadata rotation",
            "summary": "Rotate the SP certificate and re-upload IdP metadata.",
        },
        {
            "doc_id": "KB-1770",
            "title": "API 429 spikes during regional failover",
            "summary": "Enable burst queueing and lower retry concurrency.",
        },
    ]


@tool
def lookup_account_policy(policy_key: Literal["sla", "security", "refund"]) -> dict:
    """Return the enterprise policy currently in force for the requested policy area."""
    policies = {
        "sla": {
            "policy_id": "POL-SLA-009",
            "content": "Critical production incidents require 15-minute first response.",
        },
        "security": {
            "policy_id": "POL-SEC-014",
            "content": "Never disclose tenant-isolated diagnostics in a customer reply.",
        },
        "refund": {
            "policy_id": "POL-BILL-003",
            "content": "Billing credits above 20% must be approved by finance.",
        },
    }
    return policies[policy_key]


@tool
def draft_escalation(
    severity: Literal["high", "critical"],
    summary: str,
    owner_team: Literal["identity", "platform", "billing"],
) -> dict:
    """Draft an internal escalation payload for the on-call team."""
    return {
        "ticket_type": "internal_escalation",
        "severity": severity,
        "owner_team": owner_team,
        "summary": summary,
    }


class SupportDecision(BaseModel):
    """Final structured result expected from the support assistant."""

    issue_type: Literal["how_to", "bug", "billing", "security", "incident"]
    priority: Literal["low", "medium", "high", "critical"]
    needs_escalation: bool
    cited_policy_ids: list[str] = Field(
        description="Policy IDs or KB IDs explicitly referenced in the answer."
    )
    customer_reply: str = Field(
        description="Final customer-facing answer. Clear, professional, and actionable."
    )
    internal_summary: str = Field(
        description="Short internal summary for CRM or handoff."
    )


FAST_MODEL = ChatOpenAI(
    model="gpt-5.5",
    timeout=20,
    max_retries=2,
)

DEEP_MODEL = ChatAnthropic(
    model="claude-opus-4-6",
    timeout=45,
    max_retries=2,
)


@wrap_model_call
def add_enterprise_context(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    """Append tenant and compliance context without replacing existing prompt layers."""
    extra_blocks = list(request.system_message.content_blocks) + [
        {
            "type": "text",
            "text": (
                "Enterprise context:\n"
                f"- Company: {TENANT_CONTEXT['company']}\n"
                f"- Support tier: {TENANT_CONTEXT['support_tier']}\n"
                f"- Compliance: {', '.join(TENANT_CONTEXT['compliance'])}\n"
                f"- Regions: {', '.join(TENANT_CONTEXT['regions'])}\n"
                "- Never expose internal-only diagnostics or raw tenant data.\n"
                "- If confidence is low, recommend escalation instead of guessing."
            ),
        }
    ]
    return handler(
        request.override(system_message=SystemMessage(content=extra_blocks))
    )


@wrap_model_call
def route_model(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    """Use a stronger model for incident/security/long-context cases."""
    last_user_text = str(request.messages[-1].content).lower()
    complex_signals = (
        "security",
        "incident",
        "root cause",
        "outage",
        "sev1",
        "critical",
    )
    chosen_model = (
        DEEP_MODEL
        if len(request.messages) > 10
        or any(signal in last_user_text for signal in complex_signals)
        else FAST_MODEL
    )
    return handler(request.override(model=chosen_model))


@wrap_tool_call
def audit_tool_calls(
    request: ToolCallRequest,
    handler: Callable[[ToolCallRequest], ToolMessage | Command],
) -> ToolMessage | Command:
    """Simple audit log for tool usage."""
    print(f"[tool] {request.tool_call['name']} args={request.tool_call['args']}")
    return handler(request)


register_harness_profile(
    "openai",
    HarnessProfile(
        system_prompt_suffix=(
            "Prefer concise customer-facing prose. "
            "Cite policy IDs or KB IDs whenever they materially support the answer."
        ),
        excluded_tools={"execute"},
        tool_description_overrides={
            "task": (
                "Delegate only when the request clearly benefits from isolated "
                "research or multi-step analysis."
            )
        },
        general_purpose_subagent=GeneralPurposeSubagentProfile(
            system_prompt=(
                "You are ACME's research subagent. "
                "Gather evidence, cite policy IDs and KB IDs, and avoid drafting the final customer reply."
            )
        ),
    ),
)

register_harness_profile(
    "anthropic",
    HarnessProfile(
        system_prompt_suffix=(
            "Be methodical. Keep private reasoning internal, but return a concise final answer."
        ),
        excluded_tools={"execute"},
    ),
)

register_harness_profile(
    "openai:gpt-5.5",
    HarnessProfile(
        system_prompt_suffix=(
            "When multiple valid remedies exist, prefer the one with the lowest operational risk."
        )
    ),
)


def build_agent(model_spec):
    """
    model_spec can be either:
    - a provider:model string, e.g. 'openai:gpt-5.5'
    - a preconfigured model instance, e.g. ChatAnthropic(...)
    """
    return create_deep_agent(
        model=model_spec,
        tools=[search_kb, lookup_account_policy, draft_escalation],
        system_prompt=(
            "You are ACME's enterprise support assistant. "
            "Your job is to diagnose the issue, use policies and KB evidence, "
            "draft a safe customer reply, and escalate when risk is high."
        ),
        middleware=[
            add_enterprise_context,
            route_model,
            audit_tool_calls,
        ],
        response_format=SupportDecision,
        name="acme_enterprise_support",
    )


agent = build_agent("openai:gpt-5.5")

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "Our enterprise tenant is seeing repeated SAML login loops after "
                    "rotating IdP metadata. Please explain likely causes, cite any "
                    "relevant KB or policy, and tell me whether this needs escalation."
                ),
            }
        ]
    }
)

print(result["structured_response"].model_dump())


# If you want to pass a model instance instead of a string:
vip_agent = build_agent(
    ChatAnthropic(
        model="claude-opus-4-6",
        timeout=60,
        max_retries=2,
    )
)
```

## 九、逐段拆解这个示例

### 1. 为什么 `system_prompt` 只写业务身份

因为 harness 本身已经有官方默认 base prompt，负责告诉模型：

- 有哪些内建能力
- 什么时候该用工具
- 什么时候该用子代理

业务代码只需要补充“你是谁、为谁服务、什么算高风险”，不要把系统脚手架知识再复制一遍。

### 2. 为什么把“企业上下文”放 middleware，不放 `system_prompt`

因为这类内容通常会变：

- 不同租户不同
- 不同环境不同
- 不同会话优先级不同

如果把这些信息硬编码进 `system_prompt`，你得到的是一个静态 agent；如果在 `wrap_model_call` 里追加，你得到的是一个可按请求实时装配的 agent。

### 3. 为什么模型切换也放 middleware

因为模型选择本质上是运行时决策。

示例里我们做的是：

- 简单问题走 `FAST_MODEL`
- 安全、事故、长上下文问题走 `DEEP_MODEL`

这比在业务代码外层写一堆 `if/else` 再决定创建哪个 agent 更合理，因为：

- Agent 的其他配置不变
- 只把“模型路由”作为横切逻辑单独维护
- 更容易复用和测试

### 4. 为什么 `HarnessProfile` 要做两层注册

示例里有三次注册：

- `"openai"`：给所有 OpenAI 模型统一加后缀和安全限制
- `"anthropic"`：给所有 Anthropic 模型统一加后缀和安全限制
- `"openai:gpt-5.5"`：只给 `gpt-5.5` 加一个更具体的风险偏好规则

这就是官方文档所说的 provider 级和 model 级叠加。

### 5. 为什么要 `excluded_tools={"execute"}`

企业支持助手通常不应该有 shell 执行能力。

如果只是写在 prompt 里说“不要调用 execute”，模型仍然可能犯错；而 profile 层直接把工具排除掉，才是更稳的工程做法。

### 6. 为什么结构化输出要用 `SupportDecision`

因为对接下游系统时，真正需要的通常不是“模型说了一段很像样的话”，而是：

- 工单分类
- 优先级
- 是否升级
- 客服回复草稿
- 内部摘要

`structured_response` 让这些字段成为受 schema 约束的数据，而不是后处理里的 fragile regex。

## 十、什么时候该用 `system_prompt`，什么时候该用 Profile，什么时候该用 Middleware

可以按这个判断：

### 用 `system_prompt`

当规则是“这个 agent 的业务身份和目标”：

- 你是谁
- 服务对象是谁
- 遇到不确定性怎么办
- 最终输出应该偏什么风格

### 用 `HarnessProfile`

当规则是“只要选中某个 provider / model，就自动生效”：

- OpenAI 一律简洁
- Anthropic 一律更 methodical
- 某些模型禁用 `execute`
- 某些模型统一改 tool description

### 用 `middleware`

当规则是“取决于本次请求上下文或执行过程”：

- 动态加租户信息
- 动态切模型
- 动态筛工具
- 记录审计日志
- 做重试、兜底、缓存、熔断

一句话总结：

> `system_prompt` 管身份，`HarnessProfile` 管模型差异，`middleware` 管运行时行为。

## 十一、几个高频坑

### 1. 想“补充默认 prompt”，却用了 `base_system_prompt`

`base_system_prompt` 是替换 `BASE`，不是在 `BASE` 后面追加。只想补充行为时，优先考虑：

- `system_prompt`
- `system_prompt_suffix`
- middleware 动态追加

### 2. 传了模型实例，却发现 profile 没命中预期

检查两件事：

- 这个实例能否被识别出 provider 和 model identifier
- 你注册的是 provider 级 key 还是 model 级 key

### 3. 在 middleware 里改 `self.counter += 1`

官方明确不建议这么做。并发执行时很容易出问题。要统计次数，请写入 graph state。

### 4. 以为 `response_format` 会替代自然语言输出

不是。自然语言消息流依然存在；结构化结果会单独放在：

```python
result["structured_response"]
```

所以在 UI 层和系统集成层，通常要分别消费：

- `messages`
- `structured_response`

## 十二、收束：企业场景下最稳的一套分层方式

如果你要把 `create_deep_agent` 用到企业系统里，一个非常稳的分层方式是：

1. `model` 用配置切 provider，用实例做精调。
2. `system_prompt` 只负责业务身份和总原则。
3. `middleware` 负责动态上下文、模型路由、审计与治理。
4. `HarnessProfile` 负责 provider / model 级差异化。
5. `response_format` 负责把最终结果变成可验证的业务对象。

这样做的好处是，你不会把所有复杂度都挤进一个超长 prompt，而是把“静态身份、模型差异、运行时控制、输出契约”拆到各自最适合的层里。

`create_deep_agent` 真正适合企业的地方，也正是在这里：它不是只让你“能跑起来”，而是让你有办法把 Agent 的可维护性、可迁移性和可治理性做出来。

## 参考资料

- Deep Agents GitHub README: <https://github.com/langchain-ai/deepagents>
- Deep Agents Overview: <https://docs.langchain.com/oss/python/deepagents/overview>
- Customize Deep Agents: <https://docs.langchain.com/oss/python/deepagents/customization>
- Deep Agents Profiles: <https://docs.langchain.com/oss/python/deepagents/profiles>
- Deep Agents Models: <https://docs.langchain.com/oss/python/deepagents/models>
- `create_deep_agent` API Reference: <https://reference.langchain.com/python/deepagents/graph/>
- LangChain Structured Output: <https://docs.langchain.com/oss/python/langchain/structured-output>
- LangChain Custom Middleware: <https://docs.langchain.com/oss/python/langchain/middleware/custom>
