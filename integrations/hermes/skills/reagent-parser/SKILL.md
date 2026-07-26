---
name: reagent-parser
description: "把单行或批量试剂文本（名称/货号/备注）解析为严格 JSONL 结构化结果，输出契约对齐 Dorlabaemon 的 reagentParsedSchema，用于 Hermes 侧离线批量解析与 reagent-curator 的结构化中间产物。"
version: 1.0.0
license: MIT
---

# Reagent Parser · 试剂结构化解析输出

## 定位（先读这段，避免误用）

你是 Hermes 侧的**离线试剂解析器**：输入单行或批量试剂文本（名称/货号/备注），输出严格 JSONL，每行一个解析结果。

**项目主流程不直接消费本 skill 的输出。** Dorlabaemon 在线识别链路有自己的 LLM 解析与校验（`reagentParsedSchema` 只是这里对齐的契约）。本 skill 的用途是：

1. **离线批量解析**：例如在 Hermes 服务器上把一整份库存清单、采购记录批量整理成结构化结果，供人工审阅或后续加工；
2. **为 `reagent-curator` 提供结构化中间产物**：先用本 skill 把原始文本解析成候选字段，再由 `reagent-curator` 研究核实、补齐别名与证据后产出知识条目。

不要把它当作"项目识别接口的替代品"去对接在线请求。

## 输入约定

- 单行：一段试剂描述文本，如 `Anti-GAPDH Rabbit Monoclonal Antibody, CST 2118, WB 内参一抗`。
- 批量：每行一段文本；输出与输入**逐行对应**，每行输入产出恰好一行 JSON。
- 文本中可能包含名称、货号、厂商、备注，也可能缺任意一项。

## 输出契约（逐字段，对齐项目 `src/lib/llm/schemas.ts` 的 `reagentParsedSchema`）

每行输出一个 JSON 对象，字段如下：

| 字段 | 类型 | 说明 |
|------|------|------|
| `category` | string | 必填。8 个枚举值之一：`ANTIBODY` `BUFFER` `KIT` `PRIMER` `BIOLOGICAL` `CHEMICAL` `CONSUMABLE` `OTHER`（与 `reagentCategoryValues` 一致，**禁止枚举外的值**）。 |
| `subCategory` | string \| null | 子分类短语（如 `Recombinant Protein`、`Pathway Inhibitor`），不确定填 `null`。 |
| `vendor` | string \| null | 厂商名（从文本或货号线索判断），判断不出填 `null`，**不要编造**。 |
| `confidence` | number | 0~1，你对本次解析整体正确性的把握。 |
| `warnings` | string[] | 中文警示语数组；所有"不确定""缺信息""存疑"都写在这里。没有问题则为 `[]`。 |
| `experimentTags` | string[] | 用途标签，只允许使用 `reagent-curator` skill 中列出的 62 个合法值（与项目 `src/lib/rules/catalog.ts` 的 `experimentTags` 一致）；没把握就留 `[]`。 |
| `antibodyMeta` | object \| null | **非抗体必须为 `null`**。抗体时填对象：`role`（`PRIMARY` / `SECONDARY` / `null`）、`hostSpecies`（宿主种属，如 `Rabbit`）、`targetSpecies`（反应种属，如 `Human`）、`targetName`（靶点，如 `GAPDH`）；未知字段填 `null`。 |
| `primerMeta` | object \| null | **非引物必须为 `null`**。引物时填对象：`targetName`（目标基因，如 `GAPDH`）、`isReferenceGene`（是否内参引物，布尔或 `null`）。 |

补充规则：

- `antibodyMeta` 与 `primerMeta` **至多一个非 null**；通常都是 null。
- 靶点/基因名用大写官方符号（`GAPDH`、`LC3`），与项目内参别名表习惯一致。
- `confidence ≤ 0.7` 时必须在 `warnings` 里说明原因。

## Few-shot 示例

输入：

```text
Anti-GAPDH Rabbit Monoclonal Antibody, Cell Signaling Technology 2118, WB loading control
```

输出：

```json
{"category":"ANTIBODY","subCategory":"Primary Antibody","vendor":"Cell Signaling Technology","confidence":0.92,"warnings":[],"experimentTags":["WB_PRIMARY_ANTIBODY"],"antibodyMeta":{"role":"PRIMARY","hostSpecies":"Rabbit","targetSpecies":null,"targetName":"GAPDH"},"primerMeta":null}
```

输入：

```text
人 GAPDH qPCR 引物对（内参），序列见说明书
```

输出：

```json
{"category":"PRIMER","subCategory":"qPCR Primer","vendor":null,"confidence":0.8,"warnings":["未提供厂商与货号信息","引物序列未给出，无法核对特异性"],"experimentTags":[],"antibodyMeta":null,"primerMeta":{"targetName":"GAPDH","isReferenceGene":true}}
```

## 质量红线（违反即整行作废）

1. **枚举外的值禁止出现**：`category` / `experimentTags` / `antibodyMeta.role` 只能用上面列出的合法值。
2. **不确定的字段置 `null`（或空数组）并写进 `warnings`**，禁止猜测填充——尤其是 `vendor`、货号、宿主/反应种属。
3. **禁止 markdown 包裹**：输出就是裸 JSONL，不要加 ```json 代码块、不要加解释文字、不要加行号。
4. 每行一个 JSON 对象，与输入逐行对应；无法解析的输入行也要输出一行（`category` 给最有把握的值或 `OTHER`，低 `confidence`，`warnings` 说明原因），不允许跳过或合并。
5. `antibodyMeta` / `primerMeta` 结构必须与契约完全一致，不要增删字段名。
