---
layout: doc
title: 执行环境设计：Backends、虚拟文件系统、Permissions 与 Sandboxes
category: DeepAgents
date: '2026-07-13'
tags:
  - DeepAgents
  - Execution Environment
  - Sandboxes
---

# 执行环境为什么是 DeepAgents 的核心

一个可落地的 DeepAgents 系统，不能只关心模型、Prompt 和工具清单，还必须回答三个更基础的问题：

1. 状态放在哪里。
2. 文件从哪里读、写到哪里。
3. 代码允许执行到什么程度。

这三个问题如果没有统一设计，代理很快就会出现常见失控问题：把临时状态写进项目源码目录、把长期资产和一次性中间结果混在一起、命令执行权限过大、路径穿越、同一个能力在不同运行模式下表现不一致。

更稳妥的办法，是把执行环境抽象成一层虚拟文件系统（Virtual Filesystem，后文简称 VFS）：代理看到的是一组稳定的虚拟路径，例如 `/state`、`/workspace`、`/store`、`/hub`、`/shell`；真正的物理目录、内存状态、结构化存储、外部上下文和本地命令执行，都隐藏在对应 Backend 后面。

这样做有三个直接收益：

1. 路由稳定。权限规则写在虚拟路径上，不依赖真实磁盘布局。
2. 安全可控。先做权限判定，再做真实资源访问或命令执行。
3. 易于替换。开发环境可以用本地目录，生产环境可以换成对象存储、数据库或容器沙箱。

# 六类 Backend 的职责与选型

## StateBackend

`StateBackend` 负责“当前这次运行”的易失状态，典型内容包括：

- 当前任务计划
- 中间推理产物
- 最近一步工具输出摘要
- 本轮执行上下文的临时检查点

它通常是内存态或极轻量级存储，特点是读写快、生命周期短，不应该承担长期资产沉淀职责。

适合场景：

- 需要频繁更新的小状态
- 单轮任务中的 scratchpad
- 失败可重建的数据

不适合场景：

- 需要审计留痕的数据
- 需要跨会话复用的数据

## FilesystemBackend

`FilesystemBackend` 面向真实文件树，负责把虚拟路径映射到受控目录，例如把 `/workspace` 映射到 `./runtime/workspace`。

它适合处理：

- 源码目录
- 文档目录
- 生成的 Markdown、JSON、配置文件
- 需要与现有工具链直接兼容的文件

它的关键设计点不是“能读写文件”，而是“只能在指定根目录下读写文件”。路径解析必须防止 `..` 穿越，也不能让代理越过挂载根访问宿主机其他位置。

## StoreBackend

`StoreBackend` 负责结构化、持久化、可审计的数据存储。和 `FilesystemBackend` 的区别不在于底层能不能落到磁盘，而在于语义不同：

- `FilesystemBackend` 保留原始文件形态，适合源码和文档。
- `StoreBackend` 更强调记录、对象、版本和元数据。

典型内容包括：

- 运行记录
- 任务快照
- 检索索引元数据
- 评估分数
- 产物清单

如果一个数据对象未来需要“按 key 查找”“附加更新时间”“做 schema 演进”，优先考虑 `StoreBackend`，不要直接混在项目工作目录里。

## CompositeBackend

`CompositeBackend` 的作用不是增加一种新存储，而是把多个 Backend 叠成一个统一视图。最常见的两种策略是：

1. 读取时按优先级回退，例如先读 `StateBackend`，找不到再读 `StoreBackend`，最后读 `ContextHubBackend`。
2. 写入时只写入主 Backend，避免一份内容被写散到多个地方。

它非常适合做统一知识视图，例如 `/knowledge`：

- 当前运行里新产生的事实先放 `StateBackend`
- 长期沉淀的记录放 `StoreBackend`
- 外部知识快照来自 `ContextHubBackend`

代理只需要读取 `/knowledge/...`，不需要知道底层到底来自哪里。

## ContextHubBackend

`ContextHubBackend` 负责“外部上下文接入”，例如：

- 知识库快照
- 检索结果缓存
- 历史对话摘要
- 文档切片
- 外部系统同步过来的只读事实

一个成熟系统里，`ContextHubBackend` 通常应默认只读。因为它的职责是给代理提供参考上下文，而不是让代理直接修改来源系统。

如果你希望代理可以把整理后的结论写回长期存储，应该写到 `StoreBackend`，再由其他流程异步同步回外部系统。

## LocalShellBackend

`LocalShellBackend` 负责受控的本地命令执行，例如：

- 调 `python` 跑格式化或静态检查脚本
- 调 `rg` 搜索工作目录
- 调受限测试命令做最小验证

它最容易被误用。真正要控制的不是“能不能执行”，而是：

- 能执行哪些命令
- 在哪个目录执行
- 能看到哪些环境变量
- 最长能跑多久
- 是否允许网络
- 可以写哪些真实路径

所以 `LocalShellBackend` 不应被设计成“裸 `subprocess.run` 包装器”，而应始终和 `SandboxProfile` 一起出现。

# 虚拟文件系统：先路由，再访问

下面这套最小实现不是框架源码，而是一份可运行的设计蓝图，用来说明 Backend、VFS、Permissions 和 Sandbox 是如何协同工作的。

## 一份完整的 Python 蓝图

```python
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path, PurePosixPath
from typing import Any, Protocol
import json
import os
import subprocess


class Capability(str, Enum):
    READ = "read"
    WRITE = "write"
    EXEC = "exec"


class PermissionDenied(Exception):
    pass


class RouteNotFound(Exception):
    pass


class UnsupportedOperation(Exception):
    pass


def normalize_virtual_path(path: str) -> str:
    pure = PurePosixPath("/" + path.lstrip("/"))
    if ".." in pure.parts:
        raise ValueError(f"illegal virtual path: {path}")
    normalized = pure.as_posix()
    return "/" if normalized == "/." else normalized


def normalize_backend_path(path: str) -> str:
    pure = PurePosixPath(path.strip() or ".")
    if pure.is_absolute():
        pure = PurePosixPath(*pure.parts[1:])
    if ".." in pure.parts:
        raise ValueError(f"illegal backend path: {path}")
    normalized = pure.as_posix()
    return "" if normalized in (".", "/") else normalized


def is_virtual_child(path: str, prefix: str) -> bool:
    path = normalize_virtual_path(path)
    prefix = normalize_virtual_path(prefix)
    return path == prefix or path.startswith(prefix.rstrip("/") + "/")


def resolve_under(root: Path, relative: str) -> Path:
    candidate = (root / normalize_backend_path(relative)).resolve()
    if os.path.commonpath([str(candidate), str(root)]) != str(root):
        raise PermissionDenied(f"path escapes root: {relative}")
    return candidate


@dataclass(frozen=True)
class PermissionRule:
    prefix: str
    capabilities: frozenset[Capability]

    def matches(self, path: str, capability: Capability) -> bool:
        return capability in self.capabilities and is_virtual_child(path, self.prefix)


@dataclass
class PermissionSet:
    rules: list[PermissionRule] = field(default_factory=list)

    def require(self, path: str, capability: Capability) -> None:
        if not any(rule.matches(path, capability) for rule in self.rules):
            raise PermissionDenied(f"{capability.value} denied for {path}")


@dataclass(frozen=True)
class RequestContext:
    actor: str
    permissions: PermissionSet


class Backend:
    def read_text(self, path: str) -> str:
        raise UnsupportedOperation(f"{type(self).__name__} cannot read")

    def write_text(self, path: str, data: str) -> None:
        raise UnsupportedOperation(f"{type(self).__name__} cannot write")

    def list(self, path: str = ".") -> list[str]:
        raise UnsupportedOperation(f"{type(self).__name__} cannot list")

    def execute(
        self,
        path: str,
        *,
        command: list[str],
        env: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        raise UnsupportedOperation(f"{type(self).__name__} cannot execute")


class StateBackend(Backend):
    def __init__(self) -> None:
        self._data: dict[str, str] = {}

    def read_text(self, path: str) -> str:
        return self._data[normalize_backend_path(path)]

    def write_text(self, path: str, data: str) -> None:
        self._data[normalize_backend_path(path)] = data

    def list(self, path: str = ".") -> list[str]:
        prefix = normalize_backend_path(path)
        return sorted(
            key
            for key in self._data
            if not prefix or key == prefix or key.startswith(prefix + "/")
        )


class FilesystemBackend(Backend):
    def __init__(self, root: Path, *, read_only: bool = False) -> None:
        self.root = root.resolve()
        self.read_only = read_only
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, path: str) -> Path:
        return resolve_under(self.root, path)

    def read_text(self, path: str) -> str:
        return self._resolve(path).read_text(encoding="utf-8")

    def write_text(self, path: str, data: str) -> None:
        if self.read_only:
            raise PermissionDenied("filesystem backend is read-only")
        target = self._resolve(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(data, encoding="utf-8")

    def list(self, path: str = ".") -> list[str]:
        target = self._resolve(path)
        if not target.exists():
            return []
        if target.is_file():
            return [target.relative_to(self.root).as_posix()]
        return sorted(
            item.relative_to(self.root).as_posix()
            for item in target.rglob("*")
            if item.is_file()
        )


class StoreBackend(Backend):
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _record_path(self, key: str) -> Path:
        normalized = normalize_backend_path(key)
        filename = f"{normalized}.json" if normalized else "root.json"
        return resolve_under(self.root, filename)

    def put_json(self, key: str, payload: dict[str, Any], *, kind: str = "record") -> None:
        target = self._record_path(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        document = {
            "version": 1,
            "kind": kind,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
        }
        target.write_text(
            json.dumps(document, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def get_json(self, key: str) -> dict[str, Any]:
        document = json.loads(self._record_path(key).read_text(encoding="utf-8"))
        return document["payload"]

    def read_text(self, path: str) -> str:
        return json.dumps(self.get_json(path), ensure_ascii=False, indent=2)

    def write_text(self, path: str, data: str) -> None:
        self.put_json(path, {"text": data}, kind="text")

    def list(self, path: str = ".") -> list[str]:
        subtree = resolve_under(self.root, path)
        if not subtree.exists():
            return []
        if subtree.is_file():
            relative = subtree.relative_to(self.root).as_posix()
            return [relative[:-5] if relative.endswith(".json") else relative]
        items: list[str] = []
        for item in subtree.rglob("*.json"):
            relative = item.relative_to(self.root).as_posix()
            items.append(relative[:-5])
        return sorted(items)


class ContextHubBackend(Backend):
    def __init__(self, sources: dict[str, str]) -> None:
        self.sources = {
            normalize_backend_path(key): value
            for key, value in sources.items()
        }

    def read_text(self, path: str) -> str:
        return self.sources[normalize_backend_path(path)]

    def list(self, path: str = ".") -> list[str]:
        prefix = normalize_backend_path(path)
        return sorted(
            key
            for key in self.sources
            if not prefix or key == prefix or key.startswith(prefix + "/")
        )


class CompositeBackend(Backend):
    def __init__(self, primary: Backend, *fallbacks: Backend) -> None:
        self.primary = primary
        self.backends = (primary, *fallbacks)

    def read_text(self, path: str) -> str:
        last_error: Exception | None = None
        for backend in self.backends:
            try:
                return backend.read_text(path)
            except (FileNotFoundError, KeyError) as exc:
                last_error = exc
        raise FileNotFoundError(path) from last_error

    def write_text(self, path: str, data: str) -> None:
        self.primary.write_text(path, data)

    def list(self, path: str = ".") -> list[str]:
        merged: set[str] = set()
        for backend in self.backends:
            try:
                merged.update(backend.list(path))
            except FileNotFoundError:
                continue
        return sorted(merged)


@dataclass(frozen=True)
class SandboxProfile:
    name: str
    root: Path
    writable_roots: tuple[Path, ...]
    allowed_commands: frozenset[str]
    env_allowlist: frozenset[str]
    timeout_seconds: int = 15
    network_access: bool = False


class SandboxRunner(Protocol):
    def run(
        self,
        profile: SandboxProfile,
        command: list[str],
        cwd: Path,
        env: dict[str, str],
    ) -> subprocess.CompletedProcess[str]:
        ...


class SubprocessRunner:
    """
    开发态 runner：负责演示接口与基本限制。
    真正的文件系统写隔离、网络隔离和进程级资源限制，
    应在容器、microVM 或 OS sandbox 层完成。
    """

    def run(
        self,
        profile: SandboxProfile,
        command: list[str],
        cwd: Path,
        env: dict[str, str],
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            command,
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=profile.timeout_seconds,
            check=False,
            shell=False,
        )


class LocalShellBackend(Backend):
    def __init__(self, profile: SandboxProfile, runner: SandboxRunner | None = None) -> None:
        self.profile = profile
        self.runner = runner or SubprocessRunner()
        self.profile.root.mkdir(parents=True, exist_ok=True)

    def _resolve_cwd(self, path: str) -> Path:
        return resolve_under(self.profile.root, path)

    def _build_env(self, extra_env: dict[str, str] | None) -> dict[str, str]:
        env = {
            name: os.environ[name]
            for name in self.profile.env_allowlist
            if name in os.environ
        }
        if extra_env:
            for key, value in extra_env.items():
                if key not in self.profile.env_allowlist:
                    raise PermissionDenied(f"environment variable not allowed: {key}")
                env[key] = value
        return env

    def execute(
        self,
        path: str,
        *,
        command: list[str],
        env: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        if not command:
            raise ValueError("empty command")

        program = Path(command[0]).name
        if program not in self.profile.allowed_commands:
            raise PermissionDenied(f"command not allowed: {program}")

        cwd = self._resolve_cwd(path)
        result = self.runner.run(self.profile, command, cwd, self._build_env(env))
        return {
            "profile": self.profile.name,
            "cwd": str(cwd),
            "network_access": self.profile.network_access,
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }


@dataclass(frozen=True)
class Route:
    prefix: str
    backend: Backend


class VFSRouter:
    def __init__(self) -> None:
        self._routes: list[Route] = []

    def mount(self, prefix: str, backend: Backend) -> None:
        self._routes.append(Route(normalize_virtual_path(prefix), backend))
        self._routes.sort(key=lambda item: len(item.prefix), reverse=True)

    def _match(self, path: str) -> tuple[Backend, str]:
        normalized = normalize_virtual_path(path)
        for route in self._routes:
            if is_virtual_child(normalized, route.prefix):
                relative = normalized[len(route.prefix):].lstrip("/")
                return route.backend, relative
        raise RouteNotFound(f"no backend for {path}")

    def read_text(self, path: str, ctx: RequestContext) -> str:
        ctx.permissions.require(path, Capability.READ)
        backend, relative = self._match(path)
        return backend.read_text(relative)

    def write_text(self, path: str, data: str, ctx: RequestContext) -> None:
        ctx.permissions.require(path, Capability.WRITE)
        backend, relative = self._match(path)
        backend.write_text(relative, data)

    def list(self, path: str, ctx: RequestContext) -> list[str]:
        ctx.permissions.require(path, Capability.READ)
        backend, relative = self._match(path)
        return backend.list(relative)

    def execute(
        self,
        path: str,
        command: list[str],
        ctx: RequestContext,
        *,
        cwd: str = ".",
        env: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        ctx.permissions.require(path, Capability.EXEC)
        backend, _ = self._match(path)
        return backend.execute(cwd, command=command, env=env)


@dataclass
class AgentEnvironment:
    router: VFSRouter
    analyst: RequestContext
    state: StateBackend
    workspace: FilesystemBackend
    store: StoreBackend
    hub: ContextHubBackend
    knowledge: CompositeBackend
    shell: LocalShellBackend


def build_environment(base_dir: Path) -> AgentEnvironment:
    runtime_root = base_dir.resolve()
    workspace_root = (runtime_root / "workspace").resolve()
    store_root = (runtime_root / "agent-store").resolve()

    state = StateBackend()
    workspace = FilesystemBackend(workspace_root)
    store = StoreBackend(store_root)
    hub = ContextHubBackend(
        {
            "playbooks/code-review.md": (
                "先检查行为变化、权限边界、回归风险和测试缺口。"
            ),
            "snippets/retry-policy.txt": (
                "I/O 失败时最多重试三次，并使用指数退避。"
            ),
        }
    )
    knowledge = CompositeBackend(state, store, hub)
    shell = LocalShellBackend(
        SandboxProfile(
            name="safe-python",
            root=workspace_root,
            writable_roots=(workspace_root, store_root),
            allowed_commands=frozenset({"python", "rg"}),
            env_allowlist=frozenset({"PATH", "SYSTEMROOT"}),
            timeout_seconds=10,
            network_access=False,
        ),
        runner=SubprocessRunner(),
    )

    router = VFSRouter()
    router.mount("/state", state)
    router.mount("/workspace", workspace)
    router.mount("/store", store)
    router.mount("/hub", hub)
    router.mount("/knowledge", knowledge)
    router.mount("/shell", shell)

    analyst = RequestContext(
        actor="analyst",
        permissions=PermissionSet(
            rules=[
                PermissionRule("/state", frozenset({Capability.READ, Capability.WRITE})),
                PermissionRule(
                    "/workspace/reports",
                    frozenset({Capability.READ, Capability.WRITE}),
                ),
                PermissionRule("/workspace/src", frozenset({Capability.READ})),
                PermissionRule("/store", frozenset({Capability.READ, Capability.WRITE})),
                PermissionRule("/hub", frozenset({Capability.READ})),
                PermissionRule("/knowledge", frozenset({Capability.READ})),
                PermissionRule("/shell", frozenset({Capability.EXEC})),
            ]
        ),
    )

    return AgentEnvironment(
        router=router,
        analyst=analyst,
        state=state,
        workspace=workspace,
        store=store,
        hub=hub,
        knowledge=knowledge,
        shell=shell,
    )


if __name__ == "__main__":
    env = build_environment(Path("./runtime"))

    env.router.write_text(
        "/state/run/plan.md",
        "1. inspect routes\n2. check permissions\n3. execute sandboxed command\n",
        env.analyst,
    )
    env.router.write_text(
        "/workspace/reports/summary.md",
        "# Summary\nThis file is inside the writable reports subtree.\n",
        env.analyst,
    )
    env.store.put_json(
        "runs/2026-07-13",
        {
            "topic": "execution environment",
            "artifacts": ["reports/summary.md"],
            "status": "draft",
        },
        kind="run-record",
    )

    print(env.router.list("/knowledge", env.analyst))
    print(env.router.read_text("/hub/playbooks/code-review.md", env.analyst))

    result = env.router.execute(
        "/shell",
        ["python", "-c", "print('sandbox ok')"],
        env.analyst,
        cwd="reports",
    )
    print(result["stdout"].strip())

    try:
        env.router.write_text(
            "/workspace/src/main.py",
            "print('should be denied')\n",
            env.analyst,
        )
    except PermissionDenied as exc:
        print(f"blocked: {exc}")
```

## 这段代码做对了什么

先看主线流程：

1. 所有请求先进入 `VFSRouter`。
2. `VFSRouter` 先基于虚拟路径做权限检查。
3. 通过后，再根据挂载前缀把请求路由到具体 Backend。
4. Backend 只处理自己负责的资源语义。
5. 涉及命令执行时，再进入 `LocalShellBackend` 绑定的 `SandboxProfile`。

这条链路最关键的一点是：**权限判定发生在虚拟路径层，而不是发生在物理路径层。**

这样做的好处是，真实存储可以替换，但权限规则不必跟着重写。今天 `/store` 背后是本地目录，明天换成对象存储或数据库，只要 Backend 契约不变，策略仍然成立。

# 路由示例：把资源能力挂到统一命名空间

上面代码里的挂载关系可以理解成下面这张路由表：

| 虚拟路径 | Backend | 典型内容 | 默认建议 |
| --- | --- | --- | --- |
| `/state` | `StateBackend` | 当前运行临时状态 | 可读可写，不持久化 |
| `/workspace` | `FilesystemBackend` | 项目文件、生成文档 | 只开放必须的子目录 |
| `/store` | `StoreBackend` | 运行记录、结构化资产 | 可持久化、可审计 |
| `/hub` | `ContextHubBackend` | 外部上下文、知识快照 | 默认只读 |
| `/knowledge` | `CompositeBackend` | 聚合后的统一知识视图 | 常见做法是只读 |
| `/shell` | `LocalShellBackend` | 受控命令执行入口 | 必须绑定沙箱 |

这里有两个实践点值得单独强调。

第一，`CompositeBackend` 很适合“读多写少”的聚合视图。代理可以统一读取 `/knowledge/...`，不用关心当前信息是来自本轮状态、历史记录还是外部知识库。

第二，`LocalShellBackend` 最好单独挂在一个显式路径下，例如 `/shell`。不要把“执行命令”的能力藏在文件 Backend 里，否则权限边界会变得非常模糊。

# Permissions：控制“能不能做”

权限系统回答的问题很简单：某个 actor 是否允许对某个虚拟路径执行某种能力。

在上面的例子里，`analyst` 的规则是：

- 可以读写 `/state`
- 可以读写 `/workspace/reports`
- 只能读取 `/workspace/src`
- 可以读写 `/store`
- 只能读取 `/hub` 和 `/knowledge`
- 只能在 `/shell` 上执行命令

这意味着同一个代理即使能生成代码，也不能直接写 `/workspace/src`；如果要改源码，必须换一个权限更高的 profile，或者通过显式审批流程提升权限。

这一层应该尽量保持简单，推荐只围绕两件事建模：

1. 路径前缀
2. 能力类型：`read`、`write`、`exec`

不要在权限层塞太多临时业务逻辑，否则规则会很快难以审计。

## 一个更接近配置文件的权限示例

```yaml
routes:
  - prefix: /state
    backend: state

  - prefix: /workspace
    backend: filesystem
    root: ./runtime/workspace

  - prefix: /store
    backend: store
    root: ./runtime/agent-store

  - prefix: /hub
    backend: context_hub

  - prefix: /knowledge
    backend: composite
    sources:
      - state
      - store
      - hub

  - prefix: /shell
    backend: local_shell
    sandbox: safe-python

permissions:
  analyst:
    - prefix: /state
      capabilities: [read, write]
    - prefix: /workspace/reports
      capabilities: [read, write]
    - prefix: /workspace/src
      capabilities: [read]
    - prefix: /store
      capabilities: [read, write]
    - prefix: /hub
      capabilities: [read]
    - prefix: /knowledge
      capabilities: [read]
    - prefix: /shell
      capabilities: [exec]
```

这个配置的核心思想是：**权限写虚拟路径，后端自己负责把虚拟路径映射到真实资源。**

# Sandboxes：控制“即使允许，也只能做到什么程度”

很多系统把权限和沙箱混为一谈，实际上它们解决的是两个不同层次的问题。

- `Permissions` 决定“可不可以做”。
- `Sandboxes` 决定“允许做时，最多做到哪里”。

以 `LocalShellBackend` 为例，即使权限允许代理调用 `/shell`，沙箱仍然应该继续限制：

1. 工作目录根在哪里
2. 哪些真实目录允许写
3. 哪些命令可执行
4. 哪些环境变量可以传入
5. 最长执行时间
6. 是否允许网络

上面示例里的 `SandboxProfile` 已经显式声明了这些约束：

```python
SandboxProfile(
    name="safe-python",
    root=workspace_root,
    writable_roots=(workspace_root, store_root),
    allowed_commands=frozenset({"python", "rg"}),
    env_allowlist=frozenset({"PATH", "SYSTEMROOT"}),
    timeout_seconds=10,
    network_access=False,
)
```

这里有一个非常重要的工程判断：**`LocalShellBackend` 是执行入口，真正的强隔离通常要靠 runner 落到 OS 或容器层。**

也就是说：

- 开发环境可以先用 `SubprocessRunner` 演示接口。
- 生产环境应该替换为容器、microVM、Job Object、seccomp、gVisor 或其他 OS 级隔离方案。

否则你只能控制“命令白名单”和“工作目录”，很难真正约束进程对宿主机的写入和网络访问。

## 为什么要把 Sandbox 设计成独立对象

把沙箱做成 `SandboxProfile` 而不是散落在命令调用参数里，有三个实际好处：

1. 审计方便。你可以直接回答“safe-python 到底允许什么”。
2. 环境切换容易。开发、CI、生产只需替换 profile。
3. 后端解耦。`LocalShellBackend` 不关心你最终用 subprocess、Docker 还是 microVM。

下面是一份更完整的沙箱配置示例：

```yaml
sandboxes:
  safe-python:
    root: ./runtime/workspace
    writable_roots:
      - ./runtime/workspace
      - ./runtime/agent-store
    allowed_commands:
      - python
      - rg
    env_allowlist:
      - PATH
      - SYSTEMROOT
    timeout_seconds: 10
    network_access: false

  review-only:
    root: ./runtime/workspace
    writable_roots:
      - ./runtime/workspace/reports
    allowed_commands:
      - python
      - rg
    env_allowlist:
      - PATH
      - SYSTEMROOT
    timeout_seconds: 5
    network_access: false
```

`review-only` 这类 profile 非常适合“允许分析、允许生成报告、但不允许改源码”的代理角色。

# Backend 该怎么选

可以用下面这套判断顺序：

## 1. 数据是不是只在当前运行里有意义

如果是，优先 `StateBackend`。

例子：

- 本轮计划
- 中间摘要
- 临时检查点

## 2. 数据是不是要保留原始文件形态

如果是，优先 `FilesystemBackend`。

例子：

- 源码
- Markdown 文档
- 配置文件
- 生成的 HTML、JSON、YAML

## 3. 数据是不是更像记录、对象、日志或资产索引

如果是，优先 `StoreBackend`。

例子：

- 运行记录
- 评估结果
- Artifact manifest
- 结构化元数据

## 4. 代理是不是需要跨多个来源读取同类信息

如果是，用 `CompositeBackend` 聚合。

例子：

- `/knowledge` 统一读取“当前事实 + 历史记录 + 外部知识”

## 5. 数据是不是来自外部上下文系统

如果是，用 `ContextHubBackend`，并默认只读。

例子：

- 向量检索结果
- 文档快照
- 外部系统同步过来的背景资料

## 6. 任务是不是必须启动真实工具链

如果是，才用 `LocalShellBackend`，并且必须绑定沙箱。

例子：

- 运行 linter
- 调脚本生成中间产物
- 在受控目录中执行最小验证

# 一个完整请求是如何流动的

假设代理要把日报写到 `/workspace/reports/summary.md`，流程应当是：

1. 调用 `router.write_text("/workspace/reports/summary.md", ...)`
2. `PermissionSet` 发现 `/workspace/reports` 允许 `write`
3. `VFSRouter` 把请求路由到 `FilesystemBackend`
4. `FilesystemBackend` 把相对路径解析到 `workspace_root/reports/summary.md`
5. `resolve_under` 确认最终路径没有逃逸根目录
6. 用 UTF-8 写入真实文件

如果代理尝试写 `/workspace/src/main.py`：

1. 请求仍先到 `PermissionSet`
2. 规则只给了 `/workspace/src` 的 `read`
3. 在到达真实文件系统之前就被拒绝

如果代理要执行命令：

1. 调用 `router.execute("/shell", ["python", "-c", "..."], cwd="reports")`
2. `PermissionSet` 检查 `/shell` 是否允许 `exec`
3. `LocalShellBackend` 检查命令是否在白名单内
4. `SandboxProfile` 限制 `cwd`、环境变量、超时时间和网络策略
5. runner 负责真正执行，生产环境下应切到强隔离实现

这就是一个可审计的执行环境该有的顺序：**先授权，再路由，再落到具体资源，再进入执行隔离。**

# 常见设计错误

## 把状态、资产和源码混在同一个目录

结果是临时文件污染工作区，长期资产也无法审计。`StateBackend`、`FilesystemBackend` 和 `StoreBackend` 应明确分层。

## 直接把宿主机目录暴露给代理

只要缺少根目录解析检查，`..` 路径穿越和误写宿主机文件就会出现。`FilesystemBackend` 必须有 `resolve_under` 这类守卫。

## 只做命令白名单，不做沙箱

命令白名单只能解决“执行哪个程序”，解决不了“程序能访问什么”。真正的写隔离和网络隔离必须下沉到 OS 或容器层。

## 权限规则直接绑定真实磁盘路径

这样一旦目录结构调整，权限策略就会整体失效。权限应写在虚拟路径层，Backend 负责适配真实存储。

## 让 CompositeBackend 同时承担复杂写入策略

`CompositeBackend` 适合聚合读取视图，不适合隐式多写。多目标写入一旦失败，回滚和审计都会复杂很多。

# 推荐的默认落地方式

如果你要给一个 DeepAgents 项目设计第一版执行环境，可以直接从下面这套默认方案起步：

1. `/state` 用 `StateBackend` 保存本轮临时状态。
2. `/workspace` 用 `FilesystemBackend` 暴露工作目录，但只对必要子树赋予写权限。
3. `/store` 用 `StoreBackend` 保存运行记录、结构化资产和评估结果。
4. `/hub` 用 `ContextHubBackend` 接入只读背景知识。
5. `/knowledge` 用 `CompositeBackend` 聚合多源读取。
6. `/shell` 用 `LocalShellBackend`，并强制绑定沙箱 profile。

这套设计的关键不是“类名齐全”，而是把责任边界划清楚：

- Backend 负责资源语义。
- VFS 负责统一命名空间和路由。
- Permissions 负责授权。
- Sandboxes 负责执行隔离。

四层职责不混，系统才会既能扩展，也能审计，更不会在代理开始自动化改文件和跑命令之后迅速失控。
