---
layout: doc
title: '02｜使用 uv 搭建 DeepAgents 股票分析项目'
category: DeepAgents实战-股票分析助手
date: '2026-09-30'
tags:
  - DeepAgents
  - uv
  - Python工程化
  - 环境配置
---

上一篇介绍了股票分析助手的整体设计。本篇开始搭建工程基础：用 uv 管理 Python、虚拟环境与依赖，将源码、工具、提示词、报告、日志和测试放到明确的位置，并打通命令行与 API 的最小运行链路。

本篇示例使用 Python 3.12，开发命令以 Windows PowerShell 为主。完成后，项目可以在**没有模型密钥的情况下**生成一份演示报告，也可以启动 FastAPI 服务。DeepAgents 依赖会安装到工程中，真实 Agent、行情工具和模型调用留给后续章节实现。这样可以先排除环境和目录问题，再调试外部服务。

> 演示程序不查询行情，也不生成投资建议。报告中的股票代码只是输入回显，不代表该证券已经经过市场有效性校验。

## 一、理解 uv 在项目中负责什么

uv 将常见的 Python 工程操作放在同一个命令入口下：

| 工程对象 | 文件或目录 | 作用 |
| --- | --- | --- |
| Python 选择 | `.python-version` | 为 uv 提供项目默认 Python 版本请求 |
| 项目声明 | `pyproject.toml` | 描述包、Python 范围、直接依赖和开发工具配置 |
| 依赖解析结果 | `uv.lock` | 记录解析后的依赖版本、来源及相关制品信息 |
| 本地环境 | `.venv/` | 安装当前平台实际需要的依赖 |
| 本地配置 | `.env` | 保存不提交的环境设置和密钥 |

`pyproject.toml` 表达“允许什么依赖”，`uv.lock` 表达“这次具体解析成什么依赖”。仅固定顶层库并不能固定所有间接依赖；团队复现环境时，应同时使用项目声明和锁文件。

锁文件也不是完整操作系统快照。Python、系统库、CPU 架构、包索引及 uv 版本仍可能影响安装和运行，调用远端模型时还会受到模型行为变化影响。本篇建立的是可复现的工程依赖基础。

## 二、初始化一个独立的 Python 项目

下面的 `stock-assistant` 是读者创建的示例代码工程，与保存本文的博客目录是两个概念。

### 1. 安装并确认 uv

Windows 可以使用：

```powershell
winget install --id astral-sh.uv --exact
```

安装后重新打开终端，检查版本，并安装所需 Python：

```powershell
uv --version
uv python install 3.12
uv init --package --python 3.12 stock-assistant
Set-Location stock-assistant
uv python pin 3.12
```

`--package` 创建可安装的项目，便于把命令行入口、API 和测试统一到同一个 Python 包中。发行包名称可以包含连字符，例如 `stock-assistant`；Python 导入名称使用下划线，例如 `stock_assistant`。

`.python-version` 中写 `3.12` 表示选择这个次版本系列，并不固定补丁版本。团队需要更严格的复现时，可在确认本机补丁版本后统一精确版本：

```powershell
uv run python --version
# 将团队选定的完整版本写入 .python-version，例如 3.12.x 的实际版本号。
# uv python pin <完整版本号>
```

### 2. 写入项目声明，再添加依赖

将初始化生成的 `pyproject.toml` 替换为以下内容。这里先给出可直接使用的基础文件，第三方依赖交给下一组 `uv add` 命令写入，避免在教程里手工编造版本组合。

```toml
[build-system]
requires = ["hatchling>=1.26,<2"]
build-backend = "hatchling.build"

[project]
name = "stock-assistant"
version = "0.1.0"
description = "A reproducible foundation for a DeepAgents stock assistant"
requires-python = ">=3.12,<3.13"
dependencies = []

[project.scripts]
stock-assistant = "stock_assistant.cli:main"

[dependency-groups]
dev = []

[tool.hatch.build.targets.wheel]
packages = ["src/stock_assistant"]

[tool.pytest.ini_options]
testpaths = ["tests"]

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I"]
```

接着执行：

```powershell
uv add deepagents langchain-openai pydantic-settings fastapi "uvicorn[standard]"
uv add --dev pytest httpx ruff
uv sync --locked
```

各依赖的职责如下：

- `deepagents`：后续构建具备规划、工具调用等能力的 Agent。
- `langchain-openai`：后续连接 OpenAI 或支持兼容协议的模型服务；具体兼容能力需要实测。
- `pydantic-settings`：加载、转换和验证配置。
- `fastapi`、`uvicorn`：提供 HTTP 接口并运行开发服务。
- `pytest`、`httpx`：执行测试，并支持 FastAPI 的测试客户端。
- `ruff`：统一静态检查与格式化。

`uv add` 会更新 `pyproject.toml`、解析锁文件并同步环境。首次执行时得到的是当时可解析的版本组合；团队共享的是执行后生成的 `pyproject.toml` 和 `uv.lock`，不能要求每个成员各自从这个空依赖模板开始解析。

如果依赖解析失败，应先检查 Python 要求、包索引可达性和冲突信息，不要删除锁文件后盲目重试。本文不依赖具体 DeepAgents API 签名，后续接入 Agent 时，应以项目锁定版本的文档为准。

## 三、规划目录：代码、资源和运行产物分开

最终结构如下。空目录中的 `.gitkeep` 仅用于让版本控制保留目录结构。

```text
stock-assistant/
├── .python-version
├── .env.example
├── .env                         # 本地配置，不提交
├── .gitignore
├── pyproject.toml
├── uv.lock
├── .venv/                       # uv 生成，不提交
├── config/
│   └── README.md                # 配置约定，不放密钥副本
├── src/
│   └── stock_assistant/
│       ├── __init__.py
│       ├── settings.py
│       ├── logging_config.py
│       ├── service.py
│       ├── cli.py
│       ├── api.py
│       ├── agents/
│       │   └── __init__.py       # 后续放 Agent 构建逻辑
│       ├── tools/
│       │   ├── __init__.py
│       │   └── symbols.py
│       └── prompts/
│           └── analyst.md
├── reports/
│   └── .gitkeep
├── logs/
│   └── .gitkeep
└── tests/
    ├── test_settings.py
    └── test_service.py
```

采用 `src` 布局后，包需要正确安装才能导入，有助于避免“在仓库根目录偶然能运行，换个位置就失败”的问题。提示词放在包内部，可以随发行包一起交付；报告和日志属于运行产物，放在源码之外。

在项目根目录创建所需路径和空文件：

```powershell
$utf8 = [System.Text.UTF8Encoding]::new($false)
$dirs = @(
    'config', 'reports', 'logs', 'tests',
    'src/stock_assistant/agents',
    'src/stock_assistant/tools',
    'src/stock_assistant/prompts'
)
foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}
$emptyFiles = @(
    'src/stock_assistant/__init__.py',
    'src/stock_assistant/agents/__init__.py',
    'src/stock_assistant/tools/__init__.py',
    'reports/.gitkeep', 'logs/.gitkeep'
)
foreach ($file in $emptyFiles) {
    if (-not (Test-Path -LiteralPath $file)) {
        [System.IO.File]::WriteAllText(
            (Join-Path (Get-Location).Path $file), '', $utf8
        )
    }
}
```

下文列出的文件都使用 UTF-8 保存。PowerShell 5.1 的重定向默认编码容易造成混淆，因此写文本时可以沿用上面的 `WriteAllText` 与 `$utf8`，或者在编辑器中明确选择 UTF-8。

## 四、配置与密钥：只保留一个加载入口

### 1. 配置模板和忽略规则

创建 `.env.example`：

```dotenv
STOCK_APP_ENV=development
STOCK_REPORTS_DIR=reports
STOCK_LOGS_DIR=logs
STOCK_LOG_LEVEL=INFO

# 以下字段供后续真实模型调用使用；本篇演示不需要密钥。
OPENAI_API_KEY=
OPENAI_MODEL=
```

复制为本地配置，显式使用 UTF-8 读写：

```powershell
$root = (Get-Location).Path
if (-not (Test-Path -LiteralPath '.env')) {
    $template = [System.IO.File]::ReadAllText(
        (Join-Path $root '.env.example'), [System.Text.Encoding]::UTF8
    )
    [System.IO.File]::WriteAllText((Join-Path $root '.env'), $template, $utf8)
}
```

将以下内容合并进 `.gitignore`，保留项目已有的其他规则：

```gitignore
.venv/
__pycache__/
*.py[cod]
.pytest_cache/
.ruff_cache/
dist/
build/
*.egg-info/

.env
.env.*
!.env.example

reports/*
!reports/.gitkeep
logs/*
!logs/.gitkeep
```

不要忽略 `uv.lock`。`.gitignore` 只影响尚未跟踪的文件，如果密钥已被提交，补上一条忽略规则不能撤回泄露，应立即撤销或轮换密钥，并按团队流程处理历史记录。

### 2. 实现类型化配置

创建 `src/stock_assistant/settings.py`：

```python
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="STOCK_",
        extra="ignore",
    )

    app_env: Literal["development", "test", "production"] = "development"
    reports_dir: Path = Path("reports")
    logs_dir: Path = Path("logs")
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    openai_api_key: SecretStr | None = Field(
        default=None, validation_alias="OPENAI_API_KEY"
    )
    openai_model: str | None = Field(default=None, validation_alias="OPENAI_MODEL")

    def prepare_directories(self) -> None:
        self.reports_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)

    def require_model_credentials(self) -> tuple[str, str]:
        key = self.openai_api_key.get_secret_value() if self.openai_api_key else ""
        model = (self.openai_model or "").strip()
        if not key.strip() or not model:
            raise ValueError("真实模型调用需要 OPENAI_API_KEY 和 OPENAI_MODEL")
        return key, model
```

普通字段使用 `STOCK_` 前缀；模型字段通过 `validation_alias` 接收显式指定的变量名，不再叠加前缀。进程环境变量优先于 `.env`，显式传入 `Settings(...)` 的参数通常又优先于这些配置来源，便于测试注入临时目录。

这里由 `pydantic-settings` 读取 `.env`，无须再用其他库重复加载。`.env` 和相对目录均以**启动时的工作目录**为基准，所以本文的所有运行命令都要求在项目根目录执行。部署到服务环境时，建议使用绝对报告路径和日志路径。

`SecretStr` 会在常见展示场景中隐藏值，但它不等于加密存储。不要记录完整设置对象、请求头或 `get_secret_value()` 的结果。生产环境使用平台注入的环境变量或密钥管理服务，不将 `.env` 打包进镜像。

`config/README.md` 可以保存以下约定：

```markdown
# 配置约定

- Settings 是应用配置的统一入口。
- 本地配置通过根目录 .env 提供，模板为 .env.example。
- 环境变量覆盖 .env；部署时通过运行平台注入密钥。
- 从项目根目录启动；部署时为报告和日志使用绝对路径。
- config 目录只保存配置说明及后续不含密钥的配置文件。
```

## 五、实现可运行的演示链路

### 1. 输入工具与提示词

创建 `src/stock_assistant/tools/symbols.py`：

```python
import re


def normalize_symbol(value: str) -> str:
    symbol = value.strip().upper()
    if not re.fullmatch(r"[A-Z0-9][A-Z0-9.-]{0,19}", symbol):
        raise ValueError("股票代码需为 1 至 20 位字母、数字、点或连字符")
    return symbol
```

它允许 `AAPL`、`BRK.B`、`600519.SH` 等形式，并排除路径分隔符、换行符等字符。这只是格式约束；市场、交易所、退市状态和代码映射应由后续行情工具负责。

创建 `src/stock_assistant/prompts/analyst.md`：

```markdown
你是股票研究助手。分析时遵守以下要求：

1. 区分可核验事实、推断与待验证假设。
2. 对价格、财务指标及新闻注明来源和时间。
3. 数据不足时明确说明缺口，不编造行情或财报。
4. 输出业务概览、证据、风险及后续核查事项。
5. 不承诺收益，不将研究结论包装成确定性买卖指令。
```

### 2. 日志初始化

创建 `src/stock_assistant/logging_config.py`：

```python
import logging
from logging.handlers import RotatingFileHandler

from stock_assistant.settings import Settings


def configure_logging(settings: Settings) -> None:
    settings.prepare_directories()
    logger = logging.getLogger("stock_assistant")
    logger.setLevel(settings.log_level)
    logger.propagate = False

    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
        handler.close()

    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s"
    )
    console = logging.StreamHandler()
    file_handler = RotatingFileHandler(
        settings.logs_dir / "app.log",
        maxBytes=5_000_000,
        backupCount=3,
        encoding="utf-8",
    )
    for handler in (console, file_handler):
        handler.setFormatter(formatter)
        logger.addHandler(handler)
```

只配置本项目的 logger，避免重置 Uvicorn 等第三方库的日志。文件轮转用于本地单进程开发；部署多个进程或容器时，应改为输出到标准输出并交给平台采集，不让多个进程竞争同一个轮转文件。

### 3. 公共服务函数

创建 `src/stock_assistant/service.py`：

```python
import logging
from datetime import datetime, timezone
from importlib.resources import files
from pathlib import Path
from uuid import uuid4

from stock_assistant.settings import Settings
from stock_assistant.tools.symbols import normalize_symbol

logger = logging.getLogger(__name__)


def create_demo_report(symbol: str, settings: Settings) -> Path:
    normalized = normalize_symbol(symbol)
    settings.prepare_directories()
    prompt = (
        files("stock_assistant")
        .joinpath("prompts", "analyst.md")
        .read_text(encoding="utf-8")
    )
    if not prompt.strip():
        raise ValueError("分析提示词不能为空")

    now = datetime.now(timezone.utc)
    report_id = uuid4().hex
    path = settings.reports_dir / f"{normalized}-{report_id}.md"
    content = (
        f"# {normalized} 工程联通报告\n\n"
        f"- 生成时间：{now.isoformat()}\n"
        "- 运行模式：演示，无模型调用\n"
        "- 提示词资源：已成功读取\n\n"
        "## 当前结论\n\n"
        "项目已打通输入校验、配置加载、包内资源读取与 UTF-8 报告写入。\n"
        "本报告未获取实时行情、财务数据或新闻，不构成投资建议。\n\n"
        "## 待接入能力\n\n"
        "- DeepAgents 分析流程\n"
        "- 行情与财报工具\n"
        "- 证据引用及分析质量检查\n"
    )
    path.write_text(content, encoding="utf-8")
    logger.info("demo_report_created symbol=%s report_id=%s", normalized, report_id)
    return path
```

用 `importlib.resources` 读取包内提示词，避免依赖 `src/...` 这样的源码相对路径。UUID 用于区分多次生成的报告，避免重复运行覆盖同一文件。函数返回路径，由 CLI 和 API 分别组织输出，两种入口不需要各写一套业务逻辑。

这里读取提示词只是验证资源能够正确交付，并没有将其发送给模型。真正调用模型前，再使用 `require_model_credentials()` 做必填校验。

### 4. 命令行入口

创建 `src/stock_assistant/cli.py`：

```python
import argparse

from stock_assistant.logging_config import configure_logging
from stock_assistant.service import create_demo_report
from stock_assistant.settings import Settings


def main() -> None:
    parser = argparse.ArgumentParser(description="股票分析项目演示入口")
    parser.add_argument("symbol", help="例如 AAPL 或 600519.SH")
    args = parser.parse_args()

    settings = Settings()
    configure_logging(settings)
    try:
        path = create_demo_report(args.symbol, settings)
    except ValueError as exc:
        parser.error(str(exc))
    print(f"报告已生成：{path.resolve()}")


if __name__ == "__main__":
    main()
```

同步项目并运行：

```powershell
uv sync --locked
uv run --locked stock-assistant AAPL
uv run --locked stock-assistant 600519.SH
```

预期在 `reports/` 下生成报告，在 `logs/app.log` 中记录执行信息。这里使用项目安装提供的 `stock-assistant` 命令，入口来自 `pyproject.toml` 的 `[project.scripts]`。

## 六、预留 API，建立前后端共同契约

创建 `src/stock_assistant/api.py`：

```python
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

from stock_assistant.logging_config import configure_logging
from stock_assistant.service import create_demo_report
from stock_assistant.settings import Settings


class AnalysisRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)


class AnalysisResponse(BaseModel):
    mode: Literal["demo"] = "demo"
    report_file: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()
    configure_logging(settings)
    app.state.settings = settings
    yield


app = FastAPI(title="Stock Assistant", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyses", response_model=AnalysisResponse)
def create_analysis(payload: AnalysisRequest, request: Request) -> AnalysisResponse:
    try:
        path = create_demo_report(payload.symbol, request.app.state.settings)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return AnalysisResponse(report_file=path.name)
```

启动本地服务：

```powershell
uv run --locked uvicorn stock_assistant.api:app --reload --host 127.0.0.1 --port 8000
```

另开终端请求接口：

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health'
Invoke-RestMethod -Method Post `
    -Uri 'http://127.0.0.1:8000/api/analyses' `
    -ContentType 'application/json; charset=utf-8' `
    -Body '{"symbol":"AAPL"}'
```

响应结构示例：

```json
{
  "mode": "demo",
  "report_file": "AAPL-<本次生成的UUID>.md"
}
```

`report_file` 是生成文件的名称，尚不是下载链接。返回文件名可以避免把服务器绝对路径直接暴露给调用方。可以通过 `http://127.0.0.1:8000/docs` 查看接口文档。

健康检查只说明服务已启动，不代表模型和行情服务可用。当前同步接口适合快速的本地演示；后续真实股票分析耗时较长，应升级为提交任务、查询状态和获取报告的流程。

浏览器前端可以通过开发服务器将 `/api` 代理到 `127.0.0.1:8000`，保持请求同源。直接跨端口访问时，再按实际前端地址配置 CORS。本文接口没有鉴权，仅绑定本机用于开发，不作为公网部署配置。

## 七、添加能发现工程问题的测试

测试重点是配置覆盖、输入边界与报告产物，不访问网络，不消耗模型额度。

创建 `tests/test_settings.py`：

```python
from stock_assistant.settings import Settings


def test_environment_overrides_dotenv(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("STOCK_APP_ENV=development\n", encoding="utf-8")
    monkeypatch.setenv("STOCK_APP_ENV", "test")

    settings = Settings(_env_file=env_file)

    assert settings.app_env == "test"
```

创建 `tests/test_service.py`：

```python
import pytest

from stock_assistant.service import create_demo_report
from stock_assistant.settings import Settings


def test_demo_report_is_utf8_and_does_not_overwrite(tmp_path):
    settings = Settings(
        _env_file=None,
        app_env="test",
        log_level="INFO",
        reports_dir=tmp_path / "reports",
        logs_dir=tmp_path / "logs",
    )

    first = create_demo_report(" aapl ", settings)
    second = create_demo_report("AAPL", settings)

    assert first != second
    assert first.parent == tmp_path / "reports"
    assert first.name.startswith("AAPL-")
    assert "不构成投资建议" in first.read_text(encoding="utf-8")
    assert second.exists()


@pytest.mark.parametrize("symbol", ["../secret", "AAPL\nMSFT", "", "A" * 21])
def test_invalid_symbol_does_not_create_report(tmp_path, symbol):
    settings = Settings(
        _env_file=None,
        app_env="test",
        log_level="INFO",
        reports_dir=tmp_path / "reports",
        logs_dir=tmp_path / "logs",
    )

    with pytest.raises(ValueError):
        create_demo_report(symbol, settings)

    assert not settings.reports_dir.exists()
```

`tmp_path` 隔离报告产物，避免测试污染开发目录。`_env_file=None` 禁用本地 `.env` 文件读取，但不会关闭进程环境变量；关键字段通过构造参数覆盖，从而减少运行环境对测试的影响。

本地开发检查命令：

```powershell
uv run --locked ruff check . --fix
uv run --locked ruff format .
uv run --locked pytest -q
```

格式化命令会修改源码，应检查其变更。持续集成中使用只检查、不自动修改的形式：

```powershell
uv sync --locked
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked pytest -q
```

以上是供读者执行的验证步骤，本文没有把这些命令列为已在目标机器运行通过的结果。

## 八、锁文件和虚拟环境的日常用法

### 1. 无须手动激活虚拟环境

`uv run` 会在项目环境中运行命令，并按需检查或同步依赖：

```powershell
uv run --locked python -c "import sys; print(sys.executable)"
uv tree
```

第一条输出应指向项目 `.venv` 内的 Python。编辑器也应选择该解释器：Windows 通常是 `.venv\Scripts\python.exe`，macOS/Linux 通常是 `.venv/bin/python`。

需要普通 `python` 命令时可以手动激活，但不要把激活步骤作为项目可运行的前提。添加项目依赖统一使用 `uv add`，避免仅安装进当前环境却遗漏项目声明和锁文件。

### 2. 区分 `--locked` 与 `--frozen`

| 参数 | 行为 | 推荐用途 |
| --- | --- | --- |
| `--locked` | 要求锁文件存在且与项目声明一致；需要修改锁文件时失败 | 团队开发检查、CI |
| `--frozen` | 使用现有锁文件，不检查它是否与项目声明保持最新 | 已在前置步骤验证过锁文件的受控流程 |

不要把 `--frozen` 理解为更严格的配置一致性校验。修改依赖声明后，应重新解析并审查锁文件；CI 使用 `--locked` 可以及时发现遗漏。

### 3. 受控升级依赖

```powershell
uv lock --upgrade-package deepagents
uv sync --locked
uv run --locked pytest -q
```

这会请求升级目标包，相关依赖可能因约束一起变化，并不保证只改一个版本号。升级后需要审查 `uv.lock` 差异，后续接入真实 Agent 后还应验证工具调用和模型连接。

`uv lock --upgrade` 会尝试升级整体依赖，适合有计划的维护，不适合作为每次启动前的操作。

### 4. 新环境的复现顺序

拿到包含锁文件的工程后，按下面的顺序准备环境：

1. 安装团队约定的 uv，并根据 `.python-version` 准备 Python。
2. 使用 UTF-8 从 `.env.example` 创建本地 `.env`，按需设置密钥。
3. 执行 `uv sync --locked`，安装锁定依赖。
4. 执行静态检查与测试。
5. 运行 CLI 演示，或启动 API 服务。

正常共享的文件包括源码、提示词、测试、配置说明、`.env.example`、`.python-version`、`pyproject.toml` 和 `uv.lock`。本机虚拟环境、密钥、日志和生成报告不应作为环境复现的输入。

## 九、排错时按边界逐层检查

| 现象 | 优先检查 |
| --- | --- |
| 无法导入 `stock_assistant` | 是否在项目根目录运行，是否执行 `uv sync --locked`，编辑器是否选择 `.venv` |
| 提示锁文件需要更新 | 项目声明是否变化；由依赖维护者更新并审查锁文件 |
| `.env` 不生效 | 启动工作目录、字段前缀、是否被进程环境变量覆盖 |
| 中文报告乱码 | 编辑器保存编码、读取时编码；本文的文本读写均显式使用 UTF-8 |
| 提示词找不到 | `prompts/analyst.md` 是否位于 Python 包内，发布时资源是否被包含 |
| API 能启动但前端请求失败 | 请求地址、代理设置、端口及跨域配置 |
| 真实模型仍报认证错误 | 配置校验只证明值存在，还需核查提供方、权限和所选模型 |

至此，项目具备统一的依赖管理、配置加载、UTF-8 文本处理、日志输出、报告落盘和 CLI/API 入口。下一步可以在 `agents/` 中实现 DeepAgents 构建逻辑，在 `tools/` 中增加行情与财报工具，并通过公共服务层让命令行和前端复用同一条分析流程。
