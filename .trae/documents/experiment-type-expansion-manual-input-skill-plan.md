# 实验类型扩展、手动输入与 Skill/API 接入计划

## Summary

- 目标：把当前仅支持固定下拉实验类型的实验判定，升级为“可扩展实验类型目录 + 手动输入实验名称 + 低匹配时由模型结合统一知识资产生成候选实验类型与试剂清单”的双通道方案。
- 本次范围包含三层：
  - 产品层：实验判定页新增“手动输入实验名称”入口，并支持先匹配已有规则，匹配度不足时请求模型生成候选实验类型与试剂配置。
  - 知识层：新增一个专门用于“扩展实验类型与试剂配置”的 Trae skill，并沉淀一份项目运行时可直接消费的结构化实验知识资产。
  - 运行时层：API 模型链路接入同一份实验知识资产，让模型在生成新实验类型或识别所需试剂时获得项目内知识增强；模型生成结果先建议、后确认，不自动落正式目录。
- 用户已确认的关键决策：
  - 先做“可扩展框架”，不是只补几个硬编码实验类型。
  - 手动输入实验名称时，优先匹配已有规则；匹配度不高时，调用大模型，配合 skill 所维护的方法与知识资产生成新的实验类型和试剂清单。
  - IDE skill 与项目运行时两层都做。
  - 模型生成的新实验类型/试剂清单先作为候选建议展示，用户确认后再保存为正式规则。

## Current State Analysis

- [page.tsx](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/app/(dashboard)/experiment-check/page.tsx) 当前只提供固定下拉：
  - `experimentType` 被硬编码为 `WB/QPCR/IF`
  - 没有“手动输入实验名称”或“实验流程描述”字段
  - 提交体也只发送 `experimentType/direction/prerequisite/lang`
- [route.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/app/api/experiment/check/route.ts) 当前通过 `z.enum(["WB", "QPCR", "IF"])` 限死实验类型，无法接收自定义实验名或“匹配失败后生成候选配置”的请求。
- [catalog.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/rules/catalog.ts) 已存在：
  - `experimentTypeCatalog`
  - `researchDirectionCatalog`
  - `ruleCatalog`
  说明项目已有“目录 + 结构化规则”的基础，但实验类型仍是少量静态项，且没有“别名/流程阶段/候选试剂模板”层。
- [engine.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/rules/engine.ts) 当前只按 `experimentCode + directionCode` 拉规则并评估，若没有规则仅给 warning；没有“实验名匹配”“匹配置信度”“模型生成候选规则”的中间层。
- [schema.prisma](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/prisma/schema.prisma) 中已有 `ExperimentType`、`ResearchDirection`、`ExperimentRule`，但：
  - `ExperimentType` 只有 `code/nameZh/nameEn`
  - 没有实验别名、流程描述、来源类型（系统内置/模型建议/用户确认）等字段
  - `ExperimentRule` 适合表达单条判定规则，但不适合直接承载“模型先生成候选实验模板，再人工确认”的草稿态
- [seed.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/prisma/seed.ts) 通过 `experimentTypeCatalog` 与 `ruleCatalog` 写库，意味着“正式实验类型目录”已经集中在代码目录中，适合继续保留为单一事实源，但需要新增“建议态草稿”的旁路。
- [SKILL.md](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/.trae/skills/reagent-classification-curator/SKILL.md) 已经建立了“试剂分类扩展助手”的模式，说明仓库已有 skill 结构和中文 skill 写法可复用；但目前没有“实验类型扩展与试剂配置生成”的对应 skill。
- [route.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/app/api/reagents/parse/route.ts)、[reagent-parse.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/llm/prompts/reagent-parse.ts)、[retrieval.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/reagent-knowledge/retrieval.ts) 已经有一套“先检索项目知识，再增强 prompt 调模型”的实现范式。
  - 这说明“模型直接调用 Trae skill”不适合在运行时硬做。
  - 当前项目中可落地的正确做法是：skill 负责指导如何维护知识与方法，项目运行时读取同一份结构化知识资产，再把候选上下文注入模型。
- [demo-store.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/demo-store.ts) 当前 `demoCheckExperiment` 仍以 `experimentType` 作为固定输入值，需要与正式模式同步支持“手动输入 -> 匹配已有规则 -> 候选建议”的流程，否则双模式会分叉。

## Proposed Changes

### 1. 新增“实验知识资产”与实验扩展 Skill

- 新增 skill：`.trae/skills/experiment-type-curator/SKILL.md`
  - 作用：指导如何扩展实验类型、如何根据实验流程拆分阶段、如何列出符合学术规范的试剂配置、如何把新增知识沉淀成项目可消费的结构化资产。
  - 内容重点：
    - 何时调用：新增实验类型、补全某实验的试剂配置、审查模型生成候选是否合理时调用
    - 先拆实验流程阶段，再定义最低必需/推荐补充
    - 明确哪些属于试剂、哪些不应纳入本系统边界（仪器、耗材、培养箱等）
    - 输出为机器可读结构，而不是散落 prompt 文案
- 新增运行时知识目录：`src/lib/experiment-knowledge/`
  - 新文件建议：
    - `src/lib/experiment-knowledge/catalog.json`
    - `src/lib/experiment-knowledge/types.ts`
    - `src/lib/experiment-knowledge/retrieval.ts`
    - `src/lib/experiment-knowledge/scoring.ts`
  - 结构建议：
    - `canonicalName`
    - `aliases`
    - `normalizedCode`
    - `description`
    - `supportedDirections`
    - `workflowStages`
    - `requiredReagentTemplates`
    - `recommendedReagentTemplates`
    - `evidenceKeywords`
    - `excludedKeywords`
    - `relatedExperimentTags`
    - `source`（如 `SYSTEM`, `CURATED`, `SUGGESTED`）
  - 目标：形成“实验类型知识资产”的单一事实源，与 `rules/catalog.ts` 的正式规则体系互补：
    - `rules/catalog.ts` 继续负责正式判定规则
    - `experiment-knowledge/catalog.json` 负责实验名匹配、别名召回、流程阶段模板和模型增强上下文

### 2. 将实验判定输入改为“双通道”

- 修改 [page.tsx](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/app/(dashboard)/experiment-check/page.tsx)
  - 新增“实验输入模式”切换：
    - `标准实验类型`
    - `手动输入实验名称`
  - 在手动模式下新增字段：
    - `customExperimentName`
    - `experimentContext` 或 `workflowDescription`（可选，用于补充如“检测分泌蛋白”“细胞上清外泌体验证”等上下文）
  - 保留已有 `direction` 与 `prerequisite`
  - 结果区增加两类展示：
    - 已匹配到的标准实验类型及匹配置信度
    - 若走模型生成，则展示“候选实验类型 / 流程阶段 / 推荐试剂配置 / 是否可保存为正式模板”
- 设计原则：
  - 标准模式保持当前快速判定体验
  - 手动模式不直接替代标准模式，而是作为扩展入口
  - 不在首版增加过多复杂编辑器，只提供可读、可确认的候选卡片

### 3. 新增实验名匹配与候选生成 API 协议

- 修改 [route.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/app/api/experiment/check/route.ts)
  - 将当前固定 schema 升级为联合输入：
    - 标准模式：`labId + experimentType + direction + prerequisite + lang`
    - 手动模式：`labId + customExperimentName + experimentContext? + direction? + prerequisite + lang`
  - 新增响应字段：
    - `resolvedExperimentType`：最终落到哪个标准实验类型
    - `resolutionSource`：`DIRECT`, `ALIAS_MATCH`, `MODEL_SUGGESTION`
    - `resolutionConfidence`
    - `suggestion`：当模型生成候选时返回候选实验配置
    - `needsConfirmation`
- 新增一个独立路由更清晰：
  - `src/app/api/experiment/resolve/route.ts`
  - 负责“手动输入实验名 -> 检索已有实验知识 -> 必要时调模型 -> 返回候选实验模板”
  - `check` 路由负责“拿到已解析的实验类型/候选规则后评估库存”
- 拆路由的原因：
  - `resolve` 是知识解析问题
  - `check` 是规则评估问题
  - 后续“确认保存新实验类型”也更自然地落在独立 API

### 4. 新增“实验解析结果草稿”数据模型

- 修改 [schema.prisma](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/prisma/schema.prisma)
  - 新增建议模型：
    - `ExperimentResolveDraft`
  - 字段建议至少包含：
    - `id`
    - `labId`
    - `userId`
    - `rawInput`
    - `resolvedOutput`
    - `resolutionSource`
    - `confidence`
    - `isConfirmed`
    - `createdAt`
  - `resolvedOutput` 建议用 `Json` 保存，承载：
    - 候选实验类型名
    - 推荐标准 code
    - 工作流阶段
    - 最低必需试剂模板
    - 推荐试剂模板
    - 解释与 warning
- 保持 `ExperimentType/ExperimentRule` 仍为正式目录，不直接让模型写入
- 新增确认写入链路时，再把 `ExperimentResolveDraft` 中用户确认的结果转换为：
  - 新的 `ExperimentType`
  - 一组 `ExperimentRule`
  - 必要时同步更新 `experiment-knowledge/catalog.json`
- 首版不要求在数据库中保存实验知识资产全文；运行时知识资产仍以代码库 JSON 为主，数据库只保存“本次模型生成建议”和“已确认写入后的正式类型”

### 5. 建立实验名匹配与知识增强层

- 新增 `src/lib/experiment-knowledge/retrieval.ts`
  - 输入：`customExperimentName + experimentContext + direction`
  - 输出：
    - `matchedExperiments`
    - `candidateCodes`
    - `workflowHints`
    - `requiredTemplateHints`
    - `recommendedTemplateHints`
    - `evidenceLines`
    - `retrievalConfidence`
- 新增 `src/lib/experiment-knowledge/scoring.ts`
  - 打分优先级建议：
    1. 别名精确命中
    2. 规范名/缩写命中
    3. 上下文关键词命中
    4. 方向关键词加权
    5. 排除词降分
- 新增 `src/lib/experiment/resolve.ts`
  - 统一封装解析流程：
    - 先查 `experimentTypeCatalog`
    - 再查 `experiment-knowledge/catalog.json`
    - 若置信度足够，直接返回匹配结果
    - 若不足，调用 LLM 生成候选实验模板
  - 阈值建议：
    - 高置信直接归一
    - 中低置信返回候选并标记需确认
  - 不做自动静默归一，避免将相近实验误判到错误模板

### 6. 复用现有 OpenAI 兼容链路，为实验扩展单独建立 prompt/schema

- 新增文件：
  - `src/lib/llm/prompts/experiment-resolve.ts`
  - `src/lib/llm/schemas-experiment.ts` 或并入现有 [schemas.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/llm/schemas.ts)
- 作用：
  - 约束模型输出严格 JSON
  - 输出字段建议包括：
    - `proposedExperimentName`
    - `proposedExperimentCode`
    - `matchedExistingCode`
    - `workflowStages`
    - `minRequiredItems`
    - `recommendedItems`
    - `warnings`
    - `rationale`
    - `confidence`
- Prompt 设计应显式注入：
  - 当前已支持实验类型目录
  - 来自 `experiment-knowledge` 的候选实验和证据
  - 来自 `rules/catalog.ts` 的可复用 `experimentTags`
  - 限制：只输出试剂相关配置，不输出仪器/耗材/场地
  - 方法来源：参考新建的 `experiment-type-curator` skill 中总结的方法论，但运行时真正读取的是同一份结构化知识资产，而不是直接调用 IDE skill
- 修改 [client.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/llm/client.ts) 的预期使用方式：
  - 继续沿用 `OPENAI_API_KEY + OPENAI_BASE_URL + OPENAI_MODEL`
  - 不新增新的模型 SDK
  - 让实验解析与试剂解析共享当前 OpenAI-compatible 接入

### 7. 正式实验目录与规则目录改为“易扩展”

- 修改 [catalog.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/rules/catalog.ts)
  - 保持现有 `experimentTypeCatalog`，但扩展字段：
    - `aliases`
    - `supportsManualResolution`
    - `descriptionZh/descriptionEn`
  - 对 `ruleCatalog` 增加可复用构造方式，减少未来每加一个实验类型都需要手写大量重复规则
  - 将“实验流程阶段 -> 规则模板”的映射抽出来，便于新实验类型复用已有基础试剂模板
- 推荐新增基础模板构造层：
  - `src/lib/rules/templates.ts`
  - 例如：
    - `buildProteinDetectionRules()`
    - `buildNucleicAcidQuantificationRules()`
    - `buildCellImagingRules()`
  - 然后由具体实验类型组合模板，避免今后新增实验类型时复制 `WB/qPCR/IF` 规则块
- 本轮示范落地建议：
  - 保留现有 `WB/QPCR/IF`
  - 新增 1-2 个示范性实验类型，验证扩展框架真实可用
  - 优先候选：
    - `ELISA`
    - `FLOW`
  - 原因：当前 `experimentTags` 已有 `ELISA_*`、`FLOW_*` 标签，结构上最接近可直接接入

### 8. 新增“确认保存新实验类型”的写入链路

- 新增 API：
  - `src/app/api/experiment/confirm/route.ts`
- 功能：
  - 接收用户确认过的 `ExperimentResolveDraft`
  - 将候选实验类型转写为正式目录条目
  - 如已有近似实验类型，则允许只补充别名或补充规则，而不是盲目新建 code
- 写入策略：
  - 优先补正式代码目录和数据库规则，而不是只存数据库 JSON
  - 若候选仅是已有类型的别名，则：
    - 更新 `experiment-knowledge/catalog.json`
    - 如有必要更新 `experimentTypeCatalog` 的 `aliases`
  - 若候选是新的正式实验类型，则：
    - 新增 `ExperimentType`
    - 新增对应 `ExperimentRule`
    - 补文档与测试
- 注意：
  - 在真正实施阶段，若要修改代码中的 JSON/TS 目录并同时写数据库，需要明确“代码库事实源”与“数据库镜像”的同步顺序；推荐以代码库目录为主，数据库通过 seed/upsert 同步。
  - 因此首版确认接口也可先只确认草稿用于本次判定，正式沉淀仍通过代码改动完成，避免在运行时产生“数据库有、代码目录无”的双写漂移。

### 9. Demo 模式与正式模式保持同构

- 修改 [demo-store.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/demo-store.ts)
  - 增加手动输入实验名称的解析入口
  - 复用 `experiment-knowledge/retrieval.ts` 与 `experiment/resolve.ts`
  - 保证 Demo 模式也能展示：
    - 已匹配标准实验类型
    - 模型生成候选模板
    - 需确认提示
- 原则：
  - 演示模式不复制第二套实验解析知识
  - 尽可能复用正式模式的解析函数与规则目录

### 10. 文档与测试同步升级

- 修改文档：
  - [api.md](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/docs/api.md)
  - [rule-design.md](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/docs/rule-design.md)
  - [README.md](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/README.md)
  - 必须补充：
    - 手动输入实验名称的交互说明
    - `resolve/check/confirm` 三段式流程
    - 模型生成只作建议、需人工确认
    - skill 与运行时知识资产的边界
- 新增/修改测试：
  - `src/lib/experiment-knowledge/retrieval.test.ts`
  - `src/lib/rules/evaluate.test.ts`
  - 视实现情况新增 `src/lib/experiment/resolve.test.ts`
  - 覆盖场景：
    - 手动输入 `western blot`、`wb` 能高置信命中 `WB`
    - 手动输入 `ELISA` 能匹配到新增正式实验模板
    - 输入模糊实验名且上下文不足时，返回 `needsConfirmation`
    - 模型建议结果不会自动写入正式目录
    - `DEMO_MODE` 与正式模式对同一输入返回一致的解析/判定结构

## Assumptions & Decisions

- “模型调用 skill”在当前项目中不按 IDE skill 的直接运行时调用实现，而是：
  - IDE 侧新增 `experiment-type-curator` skill，指导扩展方法
  - 项目运行时读取同一份结构化实验知识资产并增强 prompt
  - 这是当前 Next.js + OpenAI-compatible 架构下可稳定落地的方式
- 新实验类型的正式沉淀采取“先建议、后确认”的保守路径，不允许模型直接自动写入正式实验目录。
- 首版手动输入只要求支持：
  - 实验名文本
  - 可选上下文
  - 匹配已有规则或生成候选模板
  不要求做复杂 SOP 编辑器。
- 新实验类型扩展框架应优先复用现有 `experimentTags` 与结构化规则能力，不推翻当前规则引擎。
- 为控制复杂度，建议首版示范新增 `ELISA` 与 `FLOW` 两类实验模板，因为项目已有相关实验标签，可最小成本验证扩展架构。
- “符合学术规范”在本项目中落地为：
  - 优先依据通用 protocol/共识性最低试剂需求
  - 保守区分 `MIN_REQUIRED` 与 `RECOMMENDED`
  - 不把设备、耗材、人员操作习惯写成阻断试剂规则

## Verification Steps

- 结构与类型验证：
  - 确认新增 `.trae/skills/experiment-type-curator/SKILL.md` 结构合法
  - 确认 `src/lib/experiment-knowledge/catalog.json` 可被 `types.ts` 约束消费
- 静态检查：
  - 运行 `npm run lint`
  - 如新增 schema 类型测试，运行 `npm test`
- 规则与解析测试：
  - 手动输入 `WB` / `western blot` / `免疫印迹` 时，解析为 `WB`
  - 手动输入 `ELISA` 时，命中新实验模板并正常评估库存
  - 手动输入 `conditioned medium cytokine secretion assay` 且无法高置信归一时，走模型建议并返回 `needsConfirmation=true`
  - 输入一个不存在的实验名时，不应错误直接判定 `PASS`
- 运行时验收：
  - 在实验判定页面确认“标准模式”和“手动输入模式”均可提交
  - 在低匹配场景下，界面可显示候选实验类型、流程阶段、最低必需试剂和推荐试剂
  - 用户未确认前，不会新增正式实验类型到下拉目录
- 模式一致性验收：
  - 在 `DEMO_MODE=true` 与真实模式下，对同一手动输入实验名，得到同构的 `resolutionSource`、`needsConfirmation` 和判定结果结构
