---
layout: doc
title: Skills 体系化设计：封装工作流、脚本、模板与可复用能力
category: DeepAgents
date: '2026-07-15'
tags:
  - Skills
  - 工作流自动化
  - DeepAgents
---

# Skills 体系化设计：封装工作流、脚本、模板与可复用能力

在 DeepAgents 里，Skill 不应该只是“把一段提示词复制到上下文”。更合理的定义是：Skill 是一个可加载、可审计、可版本化的能力包，用来把稳定工作流、确定性脚本、领域参考资料、输出模板和可复用资产组织在一起。

一个设计良好的 Skill 能解决三个问题：

1. 降低上下文成本：只有命中的 Skill 才进入上下文，长参考资料和脚本按需加载。
2. 稳定执行质量：把步骤、输入校验、输出格式、失败处理固定下来，减少每次临场发挥。
3. 形成组织资产：个人经验可以沉淀为团队技能，团队技能可以进入企业级注册表和远程分发流程。

本文专讲 Skills 的体系化设计，包括 `SKILL.md` frontmatter、`scripts`、`references`、`assets` 目录、激活机制、共享技能与个人技能、远程加载、执行代码型 Skill 的设计方法，最后给出一组可复用企业工作流 Skills 示例。

## Skill 的基本边界

Skill 的核心原则是“让模型负责判断与编排，让代码负责确定性计算，让资料负责长期知识”。不要把所有东西都写进 `SKILL.md`，否则 Skill 会变成一个很长的提示词文件，既浪费上下文，也难以维护。

推荐结构如下：

```text
skills/
  enterprise-data-quality-audit/
    SKILL.md
    scripts/
      audit_csv.py
    references/
      quality-dimensions.md
    assets/
      report-template.md
      severity-rubric.yaml
```

各目录的职责要清晰：

| 路径 | 职责 | 适合放什么 |
| --- | --- | --- |
| `SKILL.md` | 激活入口和执行协议 | frontmatter、适用场景、输入要求、步骤、输出格式 |
| `scripts/` | 确定性处理 | 解析、校验、转换、打分、生成结构化结果 |
| `references/` | 长期知识 | 评审规则、行业规范、SOP、术语表、检查清单 |
| `assets/` | 可复用材料 | 模板、rubric、schema、示例数据、报告骨架 |

一个 Skill 的上下文加载顺序通常是：

1. 运行时索引所有 Skill 的 frontmatter。
2. 用户请求命中某个 Skill 的描述后，加载该 Skill 的 `SKILL.md`。
3. `SKILL.md` 指示需要哪些 `references`、`assets` 或 `scripts`。
4. 只有真正需要时，才读取长参考资料或执行脚本。
5. 输出结果时，把执行步骤、关键依据和可复查的中间产物写清楚。

这种分层能让 Skill 既轻量，又可扩展。

## SKILL.md frontmatter 设计

`SKILL.md` 是 Skill 的入口文件。frontmatter 是运行时最先索引的部分，因此它必须短、准、稳定。

最小可用版本通常只需要 `name` 和 `description`：

```markdown
---
name: enterprise-data-quality-audit
description: Use this skill when the user needs to inspect CSV or exported tabular data for completeness, uniqueness, validity, outliers, schema drift, and produce an audit report with remediation actions.
---

# Enterprise Data Quality Audit

Use this skill to audit tabular exports before migration, reporting, model training, or customer-facing import.
```

企业环境里，frontmatter 还可以增加版本、负责人、标签、数据级别等元信息。是否被运行时直接识别取决于具体实现；即使运行时忽略这些字段，它们也能服务于 lint、注册表、权限审计和发布流程。

```markdown
---
name: enterprise-data-quality-audit
description: Use this skill when the user needs to inspect CSV or exported tabular data for completeness, uniqueness, validity, outliers, schema drift, and produce an audit report with remediation actions.
version: 1.0.0
owner: data-platform
tags:
  - data-quality
  - csv
  - audit
data_classification: internal
---

# Enterprise Data Quality Audit

## When To Use

Use this skill when the user asks to:

- audit a CSV, TSV, spreadsheet export, warehouse extract, or migration sample;
- detect missing values, duplicate identifiers, invalid formats, schema drift, or suspicious outliers;
- produce a remediation-oriented report for data owners.

## Inputs

Required:

- Path to the tabular file.
- Business purpose of the dataset.

Optional:

- JSON schema file describing required columns, unique columns, types, allowed values, and regex rules.
- Expected row count or source system name.
- Report audience such as data engineering, RevOps, finance, or compliance.

## Workflow

1. Confirm the file path and whether a schema file exists.
2. If a schema exists, use it as the source of truth. If not, infer only basic properties and state that the audit is exploratory.
3. Run `scripts/audit_csv.py` with the input file and optional schema.
4. Read `assets/severity-rubric.yaml` before assigning severity.
5. Draft the final report with `assets/report-template.md`.
6. Separate measured findings from recommendations and assumptions.

## Output

Return a report with these sections:

- Executive Summary
- Dataset Profile
- Critical Findings
- Medium And Low Findings
- Remediation Plan
- Open Questions
- Appendix: Script Output

## Guardrails

- Do not silently modify the source data.
- Do not invent business rules when no schema is provided.
- If the file contains sensitive fields, summarize patterns instead of repeating raw values.
- If script execution fails, report the command, error message, and fallback analysis path.
```

frontmatter 的 `description` 是激活质量的关键。它不应该写成“用于数据质量检查”这种泛泛描述，而要写清楚用户意图、输入类型、输出形态和关键任务。

较弱的描述：

```yaml
description: Helps with data quality.
```

更好的描述：

```yaml
description: Use this skill when the user needs to inspect CSV or exported tabular data for completeness, uniqueness, validity, outliers, schema drift, and produce an audit report with remediation actions.
```

好的 `description` 具备三个特征：

1. 可匹配用户请求：包含用户可能说出的任务词，例如 audit、CSV、schema drift、duplicate、report。
2. 可区分相邻 Skill：明确它处理数据质量，而不是数据可视化、ETL 开发或指标口径设计。
3. 可约束输出：写出最终产物是 audit report，而不是随意聊天。

## scripts、references、assets 的分工

Skill 包里的内容不要混放。可以用一个简单判断标准：

- 会变化但需要人工维护的知识，放 `references`。
- 会被重复使用的模板或配置，放 `assets`。
- 必须稳定、可复现、可测试的计算，放 `scripts`。
- 需要模型理解和编排的步骤，放 `SKILL.md`。

下面是一个完整的数据质量审计 Skill 代码示例。

### assets/severity-rubric.yaml

```yaml
critical:
  description: The issue can block migration, compliance reporting, billing, or customer-facing workflows.
  examples:
    - Required identifier column is missing.
    - Unique customer IDs contain duplicates.
    - More than 20 percent of required values are missing.
high:
  description: The issue can cause incorrect analysis or operational rework.
  examples:
    - Email format is invalid for many customer records.
    - Date parsing fails for a required lifecycle field.
medium:
  description: The issue should be fixed before broad reuse but does not immediately block the workflow.
  examples:
    - Optional segmentation fields have inconsistent values.
    - A small number of rows violate expected formats.
low:
  description: The issue is mostly cosmetic or documentation-related.
  examples:
    - Column names use inconsistent capitalization.
    - Optional notes fields contain extra whitespace.
```

### assets/report-template.md

```markdown
# Data Quality Audit Report

## Executive Summary

Write three to five bullets covering overall readiness, highest risks, and recommended next action.

## Dataset Profile

- File:
- Row count:
- Column count:
- Schema provided:
- Audit mode:

## Critical Findings

List only findings that block the intended workflow.

## Medium And Low Findings

Group findings by affected column or rule.

## Remediation Plan

| Priority | Owner | Action | Validation |
| --- | --- | --- | --- |
| P0 |  |  |  |

## Open Questions

List business rules that could not be verified from the file or schema.

## Appendix: Script Output

Paste the structured script output or summarize it if the output is large.
```

### references/quality-dimensions.md

```markdown
# Data Quality Dimensions

Use these dimensions when interpreting script output.

## Completeness

Required fields must be present and populated. A missing optional field is not automatically a defect.

## Uniqueness

Identifiers that represent business entities must not collide. Duplicate entity IDs are usually higher severity than duplicate descriptive fields.

## Validity

Values must match declared type, enum, regex, date format, or business rule.

## Consistency

Values that describe the same concept should use the same representation across rows and systems.

## Timeliness

The dataset should be fresh enough for its stated purpose. This dimension often requires metadata that is not present in the file.
```

### assets/customer-export.schema.json

```json
{
  "required_columns": [
    "customer_id",
    "email",
    "plan",
    "created_at"
  ],
  "unique_columns": [
    "customer_id",
    "email"
  ],
  "columns": {
    "customer_id": {
      "type": "string",
      "required": true
    },
    "email": {
      "type": "string",
      "required": true,
      "regex": "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"
    },
    "plan": {
      "type": "string",
      "required": true,
      "allowed": [
        "free",
        "team",
        "enterprise"
      ]
    },
    "created_at": {
      "type": "date",
      "required": true
    }
  }
}
```

### scripts/audit_csv.py

下面的脚本只使用 Python 标准库，输入 CSV 和可选 schema，输出 JSON 审计结果。它适合放进代码型 Skill，因为它做的是确定性检查，而不是语言生成。

```python
#!/usr/bin/env python3
import argparse
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime


def load_schema(path):
    if not path:
        return {
            "required_columns": [],
            "unique_columns": [],
            "columns": {}
        }

    with open(path, "r", encoding="utf-8") as file:
        schema = json.load(file)

    schema.setdefault("required_columns", [])
    schema.setdefault("unique_columns", [])
    schema.setdefault("columns", {})
    return schema


def is_missing(value):
    return value is None or value.strip() == ""


def validate_type(value, expected_type):
    if is_missing(value):
        return True

    text = value.strip()

    if expected_type == "string":
        return True

    if expected_type == "int":
        try:
            int(text)
            return True
        except ValueError:
            return False

    if expected_type == "float":
        try:
            float(text)
            return True
        except ValueError:
            return False

    if expected_type == "date":
        candidates = [
            text,
            text.replace("Z", "+00:00")
        ]
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y-%m-%d %H:%M:%S"
        ]

        for candidate in candidates:
            try:
                datetime.fromisoformat(candidate)
                return True
            except ValueError:
                pass

        for date_format in formats:
            try:
                datetime.strptime(text, date_format)
                return True
            except ValueError:
                pass

        return False

    return True


def limited_counter(counter, limit=20):
    return [
        {
            "value": value,
            "count": count
        }
        for value, count in counter.most_common(limit)
    ]


def audit_csv(input_path, schema):
    required_columns = set(schema["required_columns"])
    unique_columns = set(schema["unique_columns"])
    column_rules = schema["columns"]

    missing_counts = Counter()
    invalid_type_counts = Counter()
    invalid_regex_counts = Counter()
    invalid_allowed_counts = Counter()
    unique_trackers = defaultdict(Counter)
    unexpected_columns = []
    missing_required_columns = []
    row_count = 0

    with open(input_path, "r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        fieldnames = reader.fieldnames or []
        fieldname_set = set(fieldnames)

        for column in required_columns:
            if column not in fieldname_set:
                missing_required_columns.append(column)

        if column_rules:
            expected_columns = set(column_rules.keys())
            unexpected_columns = sorted(fieldname_set - expected_columns)

        for row in reader:
            row_count += 1

            for column in fieldnames:
                value = row.get(column)
                if is_missing(value):
                    missing_counts[column] += 1

            for column, rules in column_rules.items():
                if column not in fieldname_set:
                    continue

                value = row.get(column, "")
                if rules.get("required") and is_missing(value):
                    missing_counts[column] += 1
                    continue

                expected_type = rules.get("type")
                if expected_type and not validate_type(value, expected_type):
                    invalid_type_counts[column] += 1

                pattern = rules.get("regex")
                if pattern and not is_missing(value):
                    if not re.match(pattern, value.strip()):
                        invalid_regex_counts[column] += 1

                allowed = rules.get("allowed")
                if allowed and not is_missing(value):
                    if value.strip() not in allowed:
                        invalid_allowed_counts[column] += 1

            for column in unique_columns:
                if column not in fieldname_set:
                    continue
                value = row.get(column, "").strip()
                if value:
                    unique_trackers[column][value] += 1

    duplicate_values = {}
    for column, counter in unique_trackers.items():
        duplicates = Counter({
            value: count
            for value, count in counter.items()
            if count > 1
        })
        if duplicates:
            duplicate_values[column] = limited_counter(duplicates)

    findings = []

    for column in missing_required_columns:
        findings.append({
            "severity": "critical",
            "type": "missing_required_column",
            "column": column,
            "message": f"Required column '{column}' is not present in the file."
        })

    for column, count in missing_counts.items():
        if count == 0:
            continue
        ratio = count / row_count if row_count else 0
        severity = "critical" if column in required_columns and ratio >= 0.2 else "medium"
        findings.append({
            "severity": severity,
            "type": "missing_values",
            "column": column,
            "count": count,
            "ratio": round(ratio, 4),
            "message": f"Column '{column}' has {count} missing values."
        })

    for column, values in duplicate_values.items():
        findings.append({
            "severity": "critical",
            "type": "duplicate_unique_values",
            "column": column,
            "examples": values,
            "message": f"Column '{column}' is configured as unique but contains duplicate values."
        })

    for column, count in invalid_type_counts.items():
        findings.append({
            "severity": "high",
            "type": "invalid_type",
            "column": column,
            "count": count,
            "message": f"Column '{column}' contains values that do not match the expected type."
        })

    for column, count in invalid_regex_counts.items():
        findings.append({
            "severity": "high",
            "type": "invalid_regex",
            "column": column,
            "count": count,
            "message": f"Column '{column}' contains values that do not match the expected pattern."
        })

    for column, count in invalid_allowed_counts.items():
        findings.append({
            "severity": "medium",
            "type": "invalid_allowed_value",
            "column": column,
            "count": count,
            "message": f"Column '{column}' contains values outside the allowed set."
        })

    return {
        "input_path": input_path,
        "row_count": row_count,
        "column_count": len(fieldnames),
        "columns": fieldnames,
        "missing_required_columns": sorted(missing_required_columns),
        "unexpected_columns": unexpected_columns,
        "findings": findings
    }


def main():
    parser = argparse.ArgumentParser(description="Audit a CSV file and emit a JSON data quality report.")
    parser.add_argument("--input", required=True, help="Path to the CSV file.")
    parser.add_argument("--schema", help="Optional path to a JSON schema file.")
    parser.add_argument("--output", help="Optional path to write the JSON report.")
    args = parser.parse_args()

    try:
        schema = load_schema(args.schema)
        report = audit_csv(args.input, schema)
    except Exception as exc:
        error = {
            "error": str(exc),
            "input_path": args.input
        }
        print(json.dumps(error, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2

    payload = json.dumps(report, ensure_ascii=False, indent=2)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as file:
            file.write(payload)
            file.write("\n")
    else:
        print(payload)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

运行方式示例：

```bash
python scripts/audit_csv.py \
  --input customer-export.csv \
  --schema assets/customer-export.schema.json \
  --output audit-report.json
```

脚本输出的是结构化 JSON，模型再根据 `report-template.md` 生成适合人阅读的报告。这样可以把“计算事实”和“解释事实”分开，降低幻觉和遗漏。

## 激活机制：从语义命中到按需加载

Skill 激活不应该依赖用户准确说出 Skill 名称。更常见的触发方式是语义匹配：

1. 用户提出任务：“帮我看一下这个客户导出文件能不能用于迁移。”
2. 运行时用请求与所有 Skill 的 `description` 做匹配。
3. 命中 `enterprise-data-quality-audit`。
4. 加载 `SKILL.md`。
5. 模型根据 `SKILL.md` 决定是否读取 schema、rubric、报告模板或运行脚本。

为了让激活更可靠，可以在 `SKILL.md` 里增加显式触发样例：

```markdown
## Trigger Examples

Activate this skill for requests like:

- "Audit this CSV before migration."
- "Check whether this customer export has duplicate IDs."
- "Find data quality issues in this spreadsheet export."
- "Generate a remediation report for invalid CRM records."

Do not activate this skill for:

- General dashboard design.
- SQL query optimization.
- Metric definition discussions without a concrete dataset.
```

对于相邻技能，必须写清楚边界。例如 `data-quality-audit` 和 `metric-definition-review` 都会接触数据，但前者检查数据文件质量，后者检查指标口径。边界不清会导致错误激活。

一个实用的激活评分模型可以这样设计：

```text
activation_score =
  semantic_similarity(user_request, skill.description)
  + trigger_keyword_bonus
  + explicit_skill_name_bonus
  - negative_trigger_penalty
  - missing_required_input_penalty
```

这不是要求所有 DeepAgents 都实现同一个公式，而是提醒设计者：Skill 激活既要看语义，也要看输入是否足够、是否命中负面边界。

## 共享技能、个人技能与优先级

企业里通常会同时存在三类 Skill：

| 类型 | 位置 | 适用场景 | 管理方式 |
| --- | --- | --- | --- |
| 个人 Skill | 用户本地目录 | 个人写作、个人分析偏好、临时自动化 | 用户自维护 |
| 团队 Skill | 团队仓库 | 团队 SOP、项目模板、常用脚本 | Code review 和版本管理 |
| 企业 Skill | 中央注册表 | 合规流程、跨团队标准、核心工作流 | 审批、签名、审计和发布 |

推荐优先级不是简单的“个人覆盖团队”。对于普通生产力任务，可以允许个人 Skill 优先；对于合规、安全、法务、财务等高风险任务，企业 Skill 应该优先，并且禁止被个人 Skill 静默覆盖。

可以用如下策略：

```yaml
resolution_policy:
  default_order:
    - personal
    - team
    - enterprise
  protected_domains:
    legal:
      order:
        - enterprise
        - team
      allow_personal_override: false
    security:
      order:
        - enterprise
      allow_personal_override: false
    finance:
      order:
        - enterprise
        - team
      allow_personal_override: false
```

这类策略的价值在于可解释。用户问“为什么没有用我的个人合同审查 Skill”，系统可以回答：“合同审查属于 legal 保护域，优先使用企业批准版本。”

## 远程加载与版本锁定

当 Skill 从本地扩展到组织级复用后，就需要远程加载。远程加载的设计重点不是“能下载”，而是“能追踪、能校验、能回滚”。

一个远程注册表可以只暴露索引信息：

```yaml
apiVersion: deepagents.skills/v1
registry: enterprise-ai-skills
generated_at: '2026-07-15T00:00:00Z'
skills:
  - name: enterprise-contract-review
    version: 1.4.2
    description: Use this skill to review vendor contracts, identify risky clauses, map findings to the legal playbook, and produce a redline-ready issue list.
    source: git+https://git.example.com/ai/enterprise-skills.git
    ref: refs/tags/enterprise-contract-review-v1.4.2
    path: skills/enterprise-contract-review
    sha256: 1c8b6f6f6f3b1a12b8e7c3b9d6f3c7f1a77c3b9f1d8e6a2c5b8e1d4f7a9c2e11
  - name: enterprise-incident-postmortem
    version: 2.1.0
    description: Use this skill after a production incident to reconstruct a timeline, identify contributing factors, draft a blameless postmortem, and produce follow-up actions.
    source: git+https://git.example.com/ai/enterprise-skills.git
    ref: refs/tags/enterprise-incident-postmortem-v2.1.0
    path: skills/enterprise-incident-postmortem
    sha256: 7b2d9c1e8f3a4b5c6d7e8f90112233445566778899aabbccddeeff0011223344
```

本地环境再生成锁文件：

```yaml
lockfile_version: 1
generated_at: '2026-07-15T10:30:00+08:00'
skills:
  enterprise-contract-review:
    version: 1.4.2
    source: git+https://git.example.com/ai/enterprise-skills.git
    ref: refs/tags/enterprise-contract-review-v1.4.2
    path: skills/enterprise-contract-review
    sha256: 1c8b6f6f6f3b1a12b8e7c3b9d6f3c7f1a77c3b9f1d8e6a2c5b8e1d4f7a9c2e11
  enterprise-incident-postmortem:
    version: 2.1.0
    source: git+https://git.example.com/ai/enterprise-skills.git
    ref: refs/tags/enterprise-incident-postmortem-v2.1.0
    path: skills/enterprise-incident-postmortem
    sha256: 7b2d9c1e8f3a4b5c6d7e8f90112233445566778899aabbccddeeff0011223344
```

远程加载建议遵循这些规则：

1. 默认只拉取 frontmatter 索引，不拉取全部 references 和 assets。
2. 激活后再拉取对应 Skill 包。
3. 使用版本号和内容 hash 锁定结果。
4. 高风险 Skill 需要签名、审计记录和发布审批。
5. 缓存目录按 hash 存储，避免同名 Skill 被篡改后静默替换。
6. 运行脚本前显示脚本来源、版本和权限边界。

这样可以兼顾上下文效率、供应链安全和企业治理。

## 执行代码型 Skill 的设计方法

代码型 Skill 的基本模式是：

```text
用户意图
  -> Skill 激活
  -> 模型读取 SKILL.md
  -> 模型确认输入和边界
  -> 运行 scripts 中的确定性程序
  -> 脚本输出结构化结果
  -> 模型引用结果生成最终交付物
```

设计代码型 Skill 时，要坚持四个约束。

第一，脚本接口要稳定。推荐使用命令行参数输入，JSON 输出：

```json
{
  "input_path": "customer-export.csv",
  "row_count": 12500,
  "column_count": 18,
  "findings": [
    {
      "severity": "critical",
      "type": "duplicate_unique_values",
      "column": "customer_id",
      "message": "Column 'customer_id' is configured as unique but contains duplicate values."
    }
  ]
}
```

第二，脚本不要直接替用户做不可逆修改。即使是修复类 Skill，也应该默认生成 patch、diff、计划或新文件，只有用户确认后才写回源文件。

第三，失败要可解释。脚本应该使用明确退出码：

| 退出码 | 含义 |
| --- | --- |
| `0` | 成功 |
| `1` | 输入校验失败 |
| `2` | 执行异常 |
| `3` | 外部依赖不可用 |

第四，模型不能篡改脚本事实。最终报告可以解释、分组、排序，但不能把脚本没有发现的问题说成已验证事实。

一个代码型 Skill 的 `SKILL.md` 可以明确写出脚本契约：

````markdown
## Script Contract

Run:

```bash
python scripts/audit_csv.py --input <csv-path> --schema <schema-path> --output <json-output-path>
```

Expected output:

- JSON object encoded as UTF-8.
- Top-level keys: `input_path`, `row_count`, `column_count`, `columns`, `findings`.
- Each finding must contain `severity`, `type`, `column`, and `message`.

Failure handling:

- If the script returns exit code `1`, ask the user to fix the input path or schema.
- If the script returns exit code `2`, report the error and continue with manual inspection only if the user asks.
- Never claim that the dataset passed validation if the script did not complete.
````

注意上面是写在 Skill 文档里的协议，不是运行时魔法。协议越清楚，模型越容易稳定地调用脚本并正确解释结果。

## 企业工作流 Skills 示例

下面是一组可复用的企业工作流 Skills。它们覆盖法务、事故复盘、客户支持、数据质量和发布管理。每个示例都可以独立成包，也可以进入同一个企业 Skill 注册表。

### 1. 合同风险审查 Skill

目录：

```text
skills/
  enterprise-contract-review/
    SKILL.md
    references/
      clause-playbook.md
      fallback-positions.md
    assets/
      risk-rubric.yaml
      issue-list-template.md
    scripts/
      extract_clause_headings.py
```

`SKILL.md`：

```markdown
---
name: enterprise-contract-review
description: Use this skill to review vendor contracts, identify risky clauses, map findings to the legal playbook, and produce a redline-ready issue list.
version: 1.4.2
owner: legal-ops
tags:
  - legal
  - contract
  - risk-review
data_classification: confidential
---

# Enterprise Contract Review

## When To Use

Use this skill when the user provides a vendor agreement, order form, DPA, security addendum, or renewal contract and asks for legal or commercial risk review.

## Required Inputs

- Contract text or file path.
- Contract type.
- Counterparty name.
- Business context such as deal size, renewal deadline, or procurement owner.

## Workflow

1. Identify the document type and major clause headings.
2. Read `references/clause-playbook.md` before evaluating clauses.
3. Read `assets/risk-rubric.yaml` before assigning severity.
4. Compare each risky clause against preferred language and fallback positions.
5. Produce an issue list using `assets/issue-list-template.md`.
6. Separate legal risk, commercial risk, and missing information.

## Output

Return:

- Executive summary.
- Top negotiation priorities.
- Clause-by-clause issue list.
- Suggested fallback language.
- Questions for counsel or business owner.

## Guardrails

- Do not present the review as legal advice.
- Do not invent governing law requirements.
- If a clause is absent, say it is not found in the provided text.
- If the contract text is incomplete, mark the review as partial.
```

`assets/risk-rubric.yaml`：

```yaml
critical:
  meaning: Blocks signature without legal approval.
  examples:
    - Unlimited liability.
    - Missing data processing terms for personal data.
    - Vendor unilateral termination for convenience after payment.
high:
  meaning: Requires negotiation or explicit business acceptance.
  examples:
    - Broad indemnity without cap.
    - Auto-renewal without practical notice period.
    - Weak confidentiality survival period.
medium:
  meaning: Should be improved if negotiation leverage allows.
  examples:
    - Short audit response window.
    - Ambiguous service level credits.
low:
  meaning: Track for cleanup but unlikely to block execution.
  examples:
    - Formatting inconsistency.
    - Undefined non-material term.
```

### 2. 事故复盘 Skill

目录：

```text
skills/
  enterprise-incident-postmortem/
    SKILL.md
    references/
      severity-model.md
      blameless-review-guide.md
    assets/
      postmortem-template.md
      action-item-schema.json
    scripts/
      build_timeline.py
```

`SKILL.md`：

```markdown
---
name: enterprise-incident-postmortem
description: Use this skill after a production incident to reconstruct a timeline, identify contributing factors, draft a blameless postmortem, and produce follow-up actions.
version: 2.1.0
owner: sre
tags:
  - incident
  - postmortem
  - reliability
data_classification: internal
---

# Enterprise Incident Postmortem

## When To Use

Use this skill when the user provides incident notes, chat logs, alert timestamps, deploy records, status page updates, or asks to draft a postmortem.

## Inputs

Required:

- Incident start and end time if known.
- User impact summary.
- Raw notes, timeline events, or links copied into the conversation.

Optional:

- Severity level.
- Services involved.
- Detection source.
- Mitigation and rollback details.

## Workflow

1. Normalize all timestamps to the incident timezone.
2. Build a timeline from raw events.
3. Classify impact using `references/severity-model.md`.
4. Use `references/blameless-review-guide.md` to avoid individual blame.
5. Draft the postmortem with `assets/postmortem-template.md`.
6. Convert follow-up work into owner, due date, validation, and prevention category.

## Output

Return:

- Incident summary.
- Customer impact.
- Timeline.
- Detection and response analysis.
- Contributing factors.
- What went well.
- What went poorly.
- Corrective and preventive actions.

## Guardrails

- Do not assign personal blame.
- Mark uncertain timestamps as approximate.
- Distinguish root cause, trigger, and contributing factors.
- Do not close an action item without a validation method.
```

### 3. 客户支持工单分流 Skill

目录：

```text
skills/
  enterprise-support-triage/
    SKILL.md
    references/
      escalation-policy.md
      product-area-map.md
    assets/
      response-snippets.md
      triage-schema.json
    scripts/
      score_ticket.py
```

`SKILL.md`：

```markdown
---
name: enterprise-support-triage
description: Use this skill to classify customer support tickets by urgency, product area, escalation path, sentiment, missing information, and draft an initial support response.
version: 1.3.0
owner: support-operations
tags:
  - support
  - triage
  - escalation
data_classification: confidential
---

# Enterprise Support Triage

## When To Use

Use this skill when the user provides a customer ticket, support email, chat transcript, or asks how to route or respond to a customer issue.

## Workflow

1. Extract customer, account tier, product area, symptom, business impact, and requested action.
2. Read `references/escalation-policy.md` before assigning urgency.
3. Read `references/product-area-map.md` before selecting the owning team.
4. Use `assets/triage-schema.json` for structured output.
5. Draft an initial response using `assets/response-snippets.md`.
6. Identify missing information needed for next action.

## Output

Return JSON first, then a customer-facing response draft.

JSON fields:

- `urgency`
- `product_area`
- `owning_team`
- `escalation_required`
- `customer_sentiment`
- `missing_information`
- `next_internal_action`

## Guardrails

- Do not promise a resolution time unless the escalation policy provides one.
- Do not blame the customer.
- If the ticket mentions security, billing, data loss, or outage, explicitly evaluate escalation.
```

### 4. 数据质量审计 Skill

这个 Skill 前文已经给出完整实现。它适合用于迁移前检查、CRM 导出检查、机器学习训练数据抽检、财务报表源数据审计。

目录：

```text
skills/
  enterprise-data-quality-audit/
    SKILL.md
    scripts/
      audit_csv.py
    references/
      quality-dimensions.md
    assets/
      customer-export.schema.json
      report-template.md
      severity-rubric.yaml
```

可复用点：

- schema 可以按业务对象扩展。
- rubric 可以由数据治理团队统一维护。
- 脚本可以纳入 CI 测试。
- 报告模板可以因受众不同拆成工程版、管理版、合规版。

### 5. 发布准备检查 Skill

目录：

```text
skills/
  enterprise-release-readiness/
    SKILL.md
    references/
      release-gates.md
      rollback-policy.md
    assets/
      readiness-checklist.md
      release-note-template.md
    scripts/
      summarize_changes.py
```

`SKILL.md`：

```markdown
---
name: enterprise-release-readiness
description: Use this skill before a software release to verify release gates, summarize user-facing changes, identify rollback risks, and produce a release readiness checklist.
version: 1.0.0
owner: engineering-productivity
tags:
  - release
  - readiness
  - changelog
data_classification: internal
---

# Enterprise Release Readiness

## When To Use

Use this skill when the user is preparing a release, asks for a release checklist, needs release notes, or wants to evaluate rollback readiness.

## Inputs

Required:

- Release name or version.
- Change summary, commit list, pull request list, or manually provided release scope.
- Target deployment environment.

Optional:

- Known risks.
- Feature flags.
- Rollback owner.
- Customer communication plan.

## Workflow

1. Identify user-facing changes, internal-only changes, migrations, and operational changes.
2. Read `references/release-gates.md` to evaluate readiness.
3. Read `references/rollback-policy.md` before assigning rollback risk.
4. Draft release notes with `assets/release-note-template.md`.
5. Produce a readiness checklist with pass, fail, unknown, and owner fields.

## Output

Return:

- Release summary.
- Readiness checklist.
- Rollback plan.
- Customer communication draft.
- Open blockers.

## Guardrails

- Do not mark a gate as passed without evidence.
- If migration or irreversible data change exists, require explicit rollback or mitigation notes.
- If release scope is incomplete, mark unknowns instead of assuming readiness.
```

## Skill 包的质量检查清单

发布一个 Skill 前，至少检查这些问题：

| 检查项 | 通过标准 |
| --- | --- |
| 激活描述 | `description` 能准确匹配用户意图，并能区别相邻 Skill |
| 输入要求 | Required 和 Optional 输入明确 |
| 工作流 | 步骤可执行，没有只写抽象原则 |
| 引用资料 | references 不堆进 `SKILL.md`，且路径可追踪 |
| 脚本接口 | 有明确参数、输出结构、失败处理 |
| 模板 | assets 中的模板能直接用于交付 |
| 权限边界 | 是否读写文件、是否联网、是否处理敏感数据都写清楚 |
| 版本治理 | 有 owner、version、变更说明和回滚方式 |
| 测试样例 | 至少有一个命中样例和一个不应命中的样例 |

一个简单的目录级约定也很有帮助：

```text
skills/
  <skill-name>/
    SKILL.md
    CHANGELOG.md
    scripts/
    references/
    assets/
    tests/
      positive-prompts.md
      negative-prompts.md
      sample-inputs/
      expected-outputs/
```

其中 `positive-prompts.md` 用于记录应该激活该 Skill 的请求，`negative-prompts.md` 用于记录不应该激活该 Skill 的请求。它们可以帮助团队发现描述过宽、边界不清和误触发问题。

## 设计反模式

设计 Skills 时常见的反模式有五类。

第一，把 `SKILL.md` 写成巨型知识库。这样会导致每次激活都加载大量无关内容。应把长规则拆到 `references`，只在需要时读取。

第二，把脚本能做的事交给模型猜。比如 CSV 校验、重复值统计、schema 比对都应该用脚本做，模型负责解释结果。

第三，激活描述过宽。`description: Helps with documents` 会抢占大量不相关任务，应改成具体任务和产物。

第四，模板和规则混在一起。模板是输出形态，规则是判断依据，混放会让维护困难。

第五，没有失败路径。一个生产可用的 Skill 必须写明输入缺失、脚本失败、资料不完整、权限不足时如何处理。

## 结语

Skills 的价值不在于多写几个提示词，而在于把组织里的稳定工作方法产品化。`SKILL.md` 负责激活和编排，`scripts` 负责确定性执行，`references` 负责长期知识，`assets` 负责模板和配置。个人 Skill 让专家经验快速沉淀，团队和企业 Skill 让经验进入版本化、审计化、可分发的工作流。

当 DeepAgents 开始处理更复杂的企业任务时，Skill 会成为能力复用的基本单位。谁能把流程、脚本、模板、规则和权限边界设计清楚，谁就能把 Agent 从“能回答问题”推进到“能稳定完成工作”。
