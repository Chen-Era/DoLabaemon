# 实验知识结构化升级计划

## Summary

- 目标：把当前“按试剂名称关键词判断能否开展实验”的实现，升级为“按标准化试剂类型标签 + 抗体/引物元数据 + 方向规则”进行判定，优先覆盖现有 `WB`、`qPCR`、`IF` 三类实验，以及当前项目中的 `AUTOPHAGY`、`SECRETORY_AUTOPHAGY`、`EXOSOME` 方向。
- 本次不新增新的实验类型，不纳入仪器、耗材架构或 SOP 全流程管理，只聚焦“开展该实验至少应具备哪些试剂/试剂类型”。
- 知识基线采用通用实验 protocol 与社区共识，避免依赖单篇课题论文的个性化方案：
  - `WB`：至少需要样本处理/上样相关试剂、目标一抗、二抗、检测底物，并保留内参抗体与一二抗种属匹配校验。
  - `qPCR`：至少需要 RNA 提取、逆转录、qPCR 扩增体系、目标引物/探针、内参引物、无核酸酶水；DNase/RNase 保护剂作为推荐项。
  - `IF`：至少需要固定、透化、封闭、目标一抗、荧光二抗、封片/抗淬灭与核染。
  - `EXOSOME + WB`：按 MISEV 思路，不再硬性要求 `CD63/TSG101/ALIX/CALNEXIN` 全有，而是改为“至少 1 个跨膜/GPI 锚定标志物（如 `CD9/CD63/CD81`）+ 至少 1 个胞质/内体相关标志物（如 `TSG101/ALIX`）”，`Calnexin` 作为污染排查推荐项。
- 设计原则：把可复用的知识固化为结构化规则，并让正式模式和 `DEMO_MODE` 共享同一套规则定义，避免后续再次分叉。

## Current State Analysis

- [schema.prisma](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/prisma/schema.prisma) 中 `ExperimentRule` 只有 `requiredKeywords`，无法表达“某类试剂存在即可”“必须是引物且目标为 housekeeping gene”“必须是一抗且靶点属于某集合”等规则。
- [engine.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/rules/engine.ts) 当前只做 `reagent.name` 的关键词包含匹配；结构化元数据只在 `WB` 的一二抗种属兼容检查里被单独使用。
- [seed.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/prisma/seed.ts) 目前只真正写入了少量 `WB` 规则，`qPCR` 与 `IF` 没有基础试剂要求，`EXOSOME` 也还是旧的“全 marker 都要有”写法。
- [demo-store.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/demo-store.ts) 复制了一套单独的硬编码判定逻辑，和数据库 seed 没有共享来源，后续很容易漂移。
- [schemas.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/llm/schemas.ts)、[reagent-parse.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/llm/prompts/reagent-parse.ts)、[parse route](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/app/api/reagents/parse/route.ts) 只能返回 `category/subCategory/vendor/antibodyMeta`，不足以支撑 `qPCR` 与 `IF` 的试剂类型判断。
- [confirm route](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/app/api/reagents/confirm/route.ts) 和 [reagent-form.tsx](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/components/reagent/reagent-form.tsx) 也没有把更细的实验标签或引物元数据持久化。
- 项目当前没有测试文件；如果直接重构规则引擎而不补 focused test，回归风险较高。

## Proposed Changes

### 1. 数据模型升级

- 修改 [schema.prisma](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/prisma/schema.prisma)
  - 在 `Reagent` 上新增 `experimentTags String[]`，用于存放标准化试剂功能标签，例如 `WB_LYSIS_BUFFER`、`QPCR_MASTER_MIX`、`FIXATIVE`、`NUCLEAR_STAIN`。
  - 新增 `PrimerMeta` 模型，字段至少包含：
    - `reagentId`
    - `targetName`
    - `isReferenceGene`
  - 扩展 `ExperimentRule`，替换单一 `requiredKeywords` 思路，新增结构化匹配字段：
    - `matcherType`：枚举，至少支持 `TAG_ANY`、`NAME_ANY`、`ANTIBODY_TARGET_ANY`、`PRIMER_TARGET_ANY`、`PRIMER_REFERENCE`
    - `matcherValues String[]`
    - `matcherAntibodyRole AntibodyRole?`
  - 保留 `requiredKeywords` 仅用于迁移过渡不再新增写入，最终由新引擎优先读取新字段。
- 新增 Prisma migration，名称建议为 `experiment_knowledge_structure_upgrade`。

### 2. 统一知识目录与别名归一化

- 新增 `src/lib/rules/catalog.ts`
  - 作为正式模式与演示模式共享的规则源，导出：
    - 标准化试剂标签常量
    - 常见 marker/靶点别名归一化表，例如：
      - `LC3` -> `LC3|LC3B|MAP1LC3B`
      - `p62` -> `P62|SQSTM1`
      - `ALIX` -> `ALIX|PDCD6IP`
      - `Tubulin` -> `TUBULIN|TUBA|TUBB|BETA-ACTIN` 不混用，内参集合单独维护
    - 三类实验与方向规则的结构化定义
- 规则清单按下面标准落地：
  - `WB` 最低必需：
    - 样本裂解/提取相关试剂
    - 上样缓冲液
    - 目标一抗
    - 二抗
    - 检测底物
    - 至少一个内参抗体：`GAPDH/ACTB/Tubulin`
  - `WB` 推荐：
    - 封闭液
    - 洗膜缓冲液
    - 转印膜或转印相关试剂
    - 蛋白酶抑制剂
  - `qPCR` 最低必需：
    - RNA 提取试剂/试剂盒
    - 逆转录试剂/试剂盒
    - qPCR master mix
    - 目标基因引物或探针
    - 至少一个内参引物
    - 无核酸酶水
  - `qPCR` 推荐：
    - DNase 去基因组污染试剂
    - RNase inhibitor
  - `IF` 最低必需：
    - 固定液
    - 透化试剂
    - 封闭液
    - 目标一抗
    - 荧光二抗
    - 核染
    - 封片/抗淬灭介质
  - `IF` 推荐：
    - PBS/PBST 等洗液类条目仅在库存中有登记时参与提示，不做阻断
  - `AUTOPHAGY` / `SECRETORY_AUTOPHAGY`
    - `WB` 最低必需：`LC3`、`p62`
    - `qPCR` 推荐：`MAP1LC3B`、`SQSTM1` 引物
    - `IF` 推荐：`LC3` 或 `p62` 抗体
  - `EXOSOME`
    - 仅在 `WB` 上启用方向规则
    - 最低必需：至少 1 个 tetraspanin 抗体（`CD9/CD63/CD81`）+ 至少 1 个内体/胞质相关标志物抗体（`TSG101/ALIX`）
    - 推荐：`Calnexin` 作为污染排查条目
- 约束决策：
  - 不把常见自配 buffer 全部设为阻断项，避免因“实验室自配但未登记”造成误杀；这类条目优先做推荐提示。
  - 不尝试自动判断仪器、耗材和培养条件是否齐全，保持系统边界清晰。

### 3. 试剂解析与入库链路升级

- 修改 [schemas.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/llm/schemas.ts)
  - 在现有字段上新增：
    - `experimentTags: string[]`
    - `primerMeta: { targetName?: string | null; isReferenceGene?: boolean | null } | null`
  - 继续保留 `antibodyMeta`，但要求 `targetName` 在解析时尽量标准化。
- 修改 [reagent-parse.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/llm/prompts/reagent-parse.ts)
  - 明确输出固定标签词表，只允许返回系统可识别的 `experimentTags`。
  - 增加判断指引：
    - 抗体识别 `PRIMARY/SECONDARY`
    - 引物识别 `targetName` 与 `isReferenceGene`
    - `RIPA`、`Laemmli`、`ECL`、`PFA`、`Triton X-100`、`DAPI`、`mounting medium` 等常见试剂映射到标准标签
- 修改 [parse route](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/app/api/reagents/parse/route.ts)
  - 解析成功时返回新字段。
  - fallback 规则扩展为多类常见实验试剂，而不是只识别转染试剂。
  - 为未能高置信归类的条目返回 warning，避免静默错误标签。
- 修改 [reagent-form.tsx](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/components/reagent/reagent-form.tsx)
  - 前端类型补齐 `experimentTags`、`antibodyMeta`、`primerMeta`。
  - 确认入库时把这些结构化字段一起提交。
  - 在确认前展示“系统识别到的实验用途标签/靶点”，便于人工发现误判。
- 修改 [confirm route](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/app/api/reagents/confirm/route.ts)
  - 将 `experimentTags` 写入 `Reagent`
  - 条件性创建/更新 `AntibodyMeta` 与 `PrimerMeta`

### 4. 规则引擎重构并消除 Demo/正式模式分叉

- 新增 `src/lib/rules/evaluate.ts`
  - 写成纯函数：输入 `rules + reagents + lang`，输出 `minMissing/recommendedMissing/warnings/compatibilityIssues/items`
  - 支持按 `matcherType` 做结构化匹配，并统一 target alias 归一化逻辑
- 修改 [engine.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/rules/engine.ts)
  - 数据库模式下负责读取规则与库存，再调用 `evaluate.ts`
  - 保留 `WB` 的一二抗 host/target species 兼容性检查
  - 新增“无适用规则时的显式 warning”，避免用户误以为“通过”代表规则完整
- 修改 [demo-store.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/lib/demo-store.ts)
  - demo 试剂结构补齐 `experimentTags`、`antibodyMeta`、`primerMeta`
  - demo 判定改为复用 `catalog.ts + evaluate.ts`
  - 只保留 demo 专属的内存存储，不再保留第二套硬编码实验知识

### 5. Seed、列表展示与文档同步

- 修改 [seed.ts](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/prisma/seed.ts)
  - 从 `catalog.ts` 导入规则定义统一写库
  - 将旧的 `EXOSOME` 全量 marker 逻辑替换为新的“分组满足”逻辑
  - 补齐 `qPCR` 与 `IF` 的基础规则及方向规则
- 修改 [list route](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/app/api/reagents/list/route.ts) 和 [reagents page](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/src/app/(dashboard)/reagents/page.tsx)
  - 列表接口带回 `experimentTags`、抗体/引物摘要
  - 页面展示至少一列“实验标签/靶点摘要”，便于核查库存是否真能支持某实验
- 修改 [README.md](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/README.md)、[rule-design.md](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/docs/rule-design.md)、[api.md](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/docs/api.md)
  - 更新实验知识覆盖范围、规则设计与入库返回字段说明

### 6. 聚焦测试

- 修改 [package.json](file:///Users/era/Desktop/文件夹/开发/lab-reagent-system/package.json)
  - 新增 `test` script，采用 `node --test --import tsx`
- 新增 `src/lib/rules/evaluate.test.ts`
  - 覆盖关键场景：
    - `WB` 基础最低项缺失会 `BLOCKED`
    - 一抗/二抗种属不匹配能给出风险
    - `qPCR` 只有 target primer 没有 reference primer 时会阻断
    - `EXOSOME + WB` 满足“1 个 tetraspanin + 1 个 TSG101/ALIX”即可通过，不再要求四个 marker 全部齐全
    - demo 与正式规则使用同一 catalog，至少验证一组输入结果一致

## Assumptions & Decisions

- 用户已确认：本次范围为“现有三类实验 + 当前方向规则”，并接受结构化升级与 Prisma 迁移。
- 系统边界定义为“判断试剂是否基本满足开展实验”，不把设备、细胞状态、样本来源、培养条件、前处理工艺纳入阻断逻辑。
- 对 `qPCR` 的“目标引物/探针”要求按入库元数据判断，不尝试自动验证 primer sequence 是否正确。
- 对 `IF` 与 `WB` 的“目标一抗”要求按 `AntibodyMeta.role=PRIMARY` 判定；若没有靶点名，只满足基础实验，不满足方向 marker 规则。
- 对实验室常见自配缓冲液采用保守策略：优先作为推荐项，不轻易作为阻断项。
- 历史库存若没有新标签/元数据，升级后不会自动变“已完善”；需要依赖后续重新解析、人工修订或批量补录。

## Verification Steps

- 数据库层：
  - 运行 `npx prisma migrate dev --name experiment_knowledge_structure_upgrade`
  - 运行 `npx prisma generate`
  - 运行 `npm run db:seed`
- 静态检查：
  - 运行 `npm run lint`
  - 运行 `npm test`
- 手工验收：
  - 录入并确认以下代表性试剂，检查标签与元数据是否正确：
    - `RIPA lysis buffer`
    - `Laemmli sample buffer`
    - `Anti-LC3B rabbit primary antibody`
    - `Goat anti-rabbit HRP secondary antibody`
    - `SuperSignal ECL substrate`
    - `TRIzol reagent`
    - `Reverse transcription kit`
    - `Power SYBR Green Master Mix`
    - `GAPDH primer`
    - `4% paraformaldehyde`
    - `Triton X-100`
    - `DAPI`
    - `Antifade mounting medium`
  - 在 `DEMO_MODE=true` 与真实模式各验证一轮：
    - `WB + AUTOPHAGY` 缺 `LC3/p62` 时阻断
    - `qPCR` 缺 reference primer 时阻断
    - `IF` 缺荧光二抗或封片介质时阻断
    - `WB + EXOSOME` 只有 `CD63 + TSG101` 时允许通过，缺 `Calnexin` 只给推荐提示
