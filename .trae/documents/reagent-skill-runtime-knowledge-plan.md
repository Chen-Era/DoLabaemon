# 试剂分类 Skill 与运行时知识接入计划

## Summary

- 目标：为项目建立一套“可持续扩展的试剂分类知识体系”，同时服务于 Trae/Agent 侧的分类扩展工作流，以及项目运行时对商品名的检索增强分类。
- 方案：采用“双层方案”。
  - Trae 层：新增一个自定义 skill，用于指导如何扩展试剂分类、如何识别未知商品名、如何将分类知识落成结构化词库。
  - 项目运行时层：新增一个外部工具/检索增强层，先从统一词库中检索候选类别、子类、标签和证据，再将这些上下文注入到现有 LLM 解析链路。
- 单一事实源：知识库以机器可读词库为唯一事实源，skill 负责告诉自己如何维护这份词库；项目运行时直接消费同一份词库，不做双份维护。

## Current State Analysis

- 当前仓库不存在 `.trae/skills/` 目录；只有 `.trae/documents/`，说明还没有已有自定义 skill 结构可复用。
- 试剂解析运行时入口是 `src/app/api/reagents/parse/route.ts`。
  - 当前链路：接收商品名 -> 构造 prompt -> 调用 OpenAI 兼容接口 -> 解析严格 JSON -> Zod 校验 -> 失败时 fallback 到本地启发式。
- 当前 LLM 提示词在 `src/lib/llm/prompts/reagent-parse.ts`，主要依赖：
  - 固定 `category` 枚举
  - 固定 `experimentTags` 词表
  - `standardSubCategories`
- 当前本地启发式分类在 `src/lib/reagent-tagging.ts`。
  - 已有一定的类别、子类与标签规则，但仍以正则和硬编码触发词为主。
  - 新增词、别名、排除词、证据来源时，维护成本高。
- 当前标签词表集中在 `src/lib/rules/catalog.ts`。
- 架构文档 `docs/architecture.md` 已明确：
  - 前端：Next.js App Router
  - API：Next.js Route Handlers
  - LLM：OpenAI-compatible API for reagent parsing
  - Rule Engine：deterministic rule matching
- 当前运行时没有“直接调用 Trae skill”的机制。
  - Trae skill 属于 IDE/Agent 层能力。
  - 项目服务端运行时只能调用项目代码、文件、数据库、外部 API。
  - 因此“模型收到商品名直接调用 skill”在本项目里不可直接实现，必须转译为“运行时读取 skill 所维护的统一知识资产”。

## Proposed Changes

### 1. 新增 Trae Skill：试剂分类扩展助手

- 新建目录：`.trae/skills/reagent-classification-curator/`
- 新建文件：`.trae/skills/reagent-classification-curator/SKILL.md`

#### What

- 创建一个专用 skill，定义：
  - 何时调用：遇到新商品名、需要扩展类别/子类/标签、需要补别名或排除词时调用
  - 如何判断：先拆商品名结构，再识别试剂家族、作用性质、实验用途、物种/宿主/靶标、是否需负面排除
  - 如何产出：将新知识写入统一词库，而不是只改 prompt 文案

#### Why

- 让后续扩展分类时有稳定方法，不再依赖临时 prompt 补丁。
- 保证“人类维护方式”和“运行时消费方式”共享同一个知识结构。

#### How

- skill 内容使用中文撰写，包含：
  - 识别流程
  - 分类优先级
  - 标签扩展原则
  - 如何处理歧义商品名
  - 如何落地到词库
  - 示例输入输出
- skill 明确要求优先维护统一词库，而不是直接追加散乱正则。

### 2. 新增统一事实源词库

- 新建目录：`src/lib/reagent-knowledge/`
- 新建文件建议：
  - `src/lib/reagent-knowledge/catalog.json`
  - `src/lib/reagent-knowledge/types.ts`

#### What

- 用 JSON 维护机器可读知识库，作为单一事实源。
- 每条知识项建议包含：
  - `id`
  - `canonicalName`
  - `aliases`
  - `category`
  - `subCategory`
  - `experimentTags`
  - `namePatterns`
  - `requiredKeywords`
  - `excludedKeywords`
  - `vendorHints`
  - `evidenceType`
  - `confidenceHint`
  - `notes`

#### Why

- 结构化词库比硬编码更适合扩展、测试、检索和后续维护。
- JSON 可直接被 Next.js 服务端读取，无需额外 YAML 解析依赖。

#### How

- `types.ts` 约束词库结构，确保与现有 `ReagentCategory`、`ExperimentTag`、`standardSubCategories` 对齐。
- `catalog.json` 初始纳入已验证的高频家族：
  - recombinant protein
  - cytokine
  - growth factor
  - ligand protein
  - siRNA / shRNA / CRISPR
  - plasmid / viral vector
  - transfection reagent
  - selection antibiotic
  - medium / serum / extraction / WB / IF / qPCR 核心家族

### 3. 新增运行时外部工具层：词库检索增强

- 新建文件建议：
  - `src/lib/reagent-knowledge/retrieval.ts`
  - `src/lib/reagent-knowledge/scoring.ts`

#### What

- 在进入 LLM 前，先基于词库对 `name + catalogNo + note` 做检索和候选召回。
- 输出结构建议包含：
  - `matchedEntries`
  - `candidateCategories`
  - `candidateSubCategories`
  - `candidateExperimentTags`
  - `evidenceLines`
  - `retrievalConfidence`

#### Why

- 把运行时增强做成项目内的“外部工具层”，满足“先检索再喂模型”的决策。
- 降低纯模型自由发挥带来的漂移。

#### How

- 检索优先级：
  1. alias 精确命中
  2. pattern 命中
  3. requiredKeywords 满足
  4. excludedKeywords 排除
  5. 多条候选按规则打分
- 输出应保留“命中证据”，便于 prompt 注入和调试日志。

### 4. 接入现有解析路由

- 修改文件：`src/app/api/reagents/parse/route.ts`

#### What

- 在当前 `client.responses.create()` 之前，先调用词库检索层。
- 将检索结果注入 prompt 或追加为模型上下文。

#### Why

- 使运行时不再只依赖“通用提示词 + 模型理解”，而是结合项目自己的知识库。

#### How

- 修改链路为：
  - 接收请求
  - 调用 `retrieveReagentKnowledge(...)`
  - 构造增强后的 prompt
  - 调用模型
  - 解析 JSON
  - 标准化空字符串
  - Zod 校验
  - fallback
- 调试日志中增加：
  - 命中词库条数
  - 候选标签
  - 证据摘要

### 5. 升级提示词为“检索增强版”

- 修改文件：`src/lib/llm/prompts/reagent-parse.ts`

#### What

- 让 prompt 接收额外的“词库检索结果”参数，而不是只拼固定文案。

#### Why

- 让模型明确知道：
  - 哪些类别/子类/标签是来自项目知识库的候选
  - 哪些证据词触发了这些候选

#### How

- 将现有 `buildReagentParsePrompt(lang)` 扩展为接受第二参数，例如：
  - `buildReagentParsePrompt(lang, retrievalContext)`
- 在 prompt 中增加：
  - 候选类别
  - 候选子类
  - 候选标签
  - 证据摘要
  - “优先参考项目知识库，除非证据明显冲突”的指令

### 6. 逐步从硬编码迁移到词库驱动

- 修改文件：
  - `src/lib/reagent-tagging.ts`
  - `src/lib/rules/catalog.ts`

#### What

- 保留现有规则兜底能力，但逐步改为“词库优先，硬编码补充”。

#### Why

- 避免未来新增类别时需要同时改多个散点文件。

#### How

- 第一阶段不完全移除现有正则。
- 先将高频类别映射迁移到词库检索逻辑。
- `reagent-tagging.ts` 保留为 fallback heuristic，但内部优先读取词库候选。

### 7. 补充测试与验收样例

- 修改/新增文件建议：
  - `src/lib/rules/evaluate.test.ts`
  - `src/lib/llm/normalize.test.ts`
  - 新增 `src/lib/reagent-knowledge/retrieval.test.ts`

#### What

- 补充以下类型样例：
  - `Soluble RANK Ligand (sRANKL) Protein, Recombinant human`
  - `Recombinant human IL-6`
  - `BMP2 recombinant protein`
  - `pcDNA3.1-LC3B`
  - `LC3B siRNA smartpool`
  - `MK-2206 AKT inhibitor`
  - `DAPT gamma-secretase inhibitor`

#### Why

- 确保新架构不只提升 UI 展示，而是真正稳定提升检索与分类质量。

#### How

- 测试覆盖：
  - alias 命中
  - excludedKeywords 生效
  - 多标签输出
  - prompt 增强上下文存在
  - fallback 不破坏现有通过项

## Assumptions & Decisions

- 使用中文编写 skill 内容。
- 使用 JSON 而不是 YAML 作为运行时单一事实源，原因是当前项目依赖中没有 YAML 解析库，JSON 可直接被服务端读取。
- “API 模型调用 skill”的落地方式不采用真正的 Trae skill 运行时调用，而采用：
  - Trae skill 负责维护方法与知识组织方式
  - 项目运行时通过外部工具层读取同一份词库并增强 prompt
- 本轮规划范围包含：
  - 新 skill
  - 统一词库
  - 运行时检索增强接入
  - 测试与日志
- 不在本轮规划中做：
  - 数据库存储词库
  - 后台知识库可视化编辑器
  - 多模型编排

## Verification Steps

- 结构验证
  - 确认 `.trae/skills/reagent-classification-curator/SKILL.md` 可被识别
  - 确认 `catalog.json` 结构通过类型校验
- 单元测试
  - `npm test`
  - 新增 `reagent-knowledge/retrieval.test.ts` 全部通过
- 静态检查
  - `npm run lint`
- 运行时验收
  - 对 `sRANKL`、`IL-6`、`BMP2`、`LC3B siRNA` 等真实商品名发起解析
  - 观察返回是否包含合理的 `category`、`subCategory`、多个 `experimentTags`
  - 观察日志中是否包含词库命中证据
- 回归检查
  - 现有 WB / qPCR / IF / exosome 规则评估结果不退化

