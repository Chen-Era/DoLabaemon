## Summary

- 目标：降低试剂解析 `fallback` 率，并减少大模型对 `vendor`、`catalogNo`、`name` 及其派生分类字段的明显错识别。
- 方案：在现有试剂解析链路中加入“混合自适应联网检索 + 二次纠错/核验”层。
- 已确认决策：
  - 联网方式：混合自适应。优先尝试模型原生 `web search`；当前提供方不支持时，退回独立搜索 API + 页面抓取。
  - 纠错范围：全字段纠错，不仅校验 `vendor`/`catalogNo`，也允许纠偏 `category`、`subCategory`、`experimentTags`、`antibodyMeta`、`primerMeta`。
  - 适用范围：覆盖单条解析与批量解析，两条链路共用同一套核验逻辑。
  - 前端展示：只显示“是否已联网核验”，不展示详细证据。

## Current State Analysis

### Existing Entry Points

- `src/lib/reagent-ingest/parse-reagent.ts`
  - 单条试剂解析主入口。
  - 当前流程：本地知识库检索 `retrieveReagentKnowledge()` -> `client.responses.create()` 生成 JSON -> `reagentParsedSchema` 校验。
  - 失败时直接进入 `buildHeuristicParse()`，并把 `parseSource` 标记为 `"fallback"`。
- `src/lib/reagent-ingest/extract-batch-rows.ts`
  - 批量文本拆行主入口。
  - 当前流程：优先表格解析 -> 否则直接调用 LLM 拆行 -> 失败时回退到按行切分。
  - 这里没有任何联网核验，也没有对厂商/货号做事实校正。
- `src/app/api/reagents/parse/route.ts`
  - 单条解析 API。
  - 当前只返回 `{ draftId, parsed, parseSource }`。
- `src/app/api/reagents/batch-parse/route.ts`
  - 批量解析 API。
  - 当前先 `extractBatchRows()`，再对每行调用 `parseReagentInput()`，返回 `parseSource`。

### Current LLM Integration

- `src/lib/llm/client.ts`
  - 当前只有最基础的 `OpenAI` client 封装，未抽象工具能力、重试策略、模型能力探测或 provider 降级逻辑。
- `src/lib/llm/prompts/reagent-parse.ts`
  - Prompt 已注入本地知识库候选类别、子类、标签和证据，但没有要求模型联网校验商品事实，也没有自检/纠错阶段。
- `src/lib/llm/schemas.ts`
  - `reagentParsedSchema` 只包含解析产物，不包含联网核验状态或来源信息。

### UI / Storage Constraints

- `src/components/reagent/reagent-form.tsx`
  - 当前只展示 `解析来源：LLM/Fallback`。
- `src/components/reagent/reagent-batch-form.tsx`
  - 批量结果也只展示 `parseSource`，没有“是否已联网核验”状态。
- `prisma/schema.prisma`
  - `ReagentParseDraft.parsedOutput` 为 `Json`，因此只要前端与后端 schema 同步，新增核验字段通常不需要数据库 migration。

### Root Causes Of The High Fallback / Wrong Facts

- 当前把“模型一次性抽取”当成最终答案，没有单独的事实核验阶段。
- `parse-reagent.ts` 对模型失败的处理过于粗暴：只要 JSON 不合法、输出格式不稳定或模型拒答，就直接走 heuristic fallback。
- 当前默认模型是 `MiniMax-M1-80k`，且使用 `OPENAI_BASE_URL` 兼容接口；是否支持原生 `web search` 不能假定，因此不能把方案写死到单一 provider。
- 批量入口只负责拆行，不负责联网补全/纠错，导致后续单行解析拿到的输入本身就可能缺失或错误。

## Proposed Changes

### 1. Add A Shared Search / Verification Layer

- 新增 `src/lib/llm/model-capabilities.ts`
  - 作用：基于环境变量和模型名判断当前 provider 是否“可能支持”原生 web search。
  - 设计：
    - 读取 `OPENAI_BASE_URL`、`OPENAI_MODEL`。
    - 提供 `supportsNativeWebSearch()`。
    - 对未知 provider 采取保守策略，默认 `false`，避免对兼容接口盲发 `tools: [{ type: "web_search" }]`。
- 新增 `src/lib/reagent-ingest/web-search.ts`
  - 作用：封装独立搜索 API 适配层，作为原生 web search 的降级路径。
  - 设计：
    - 通过环境变量选择搜索提供方，例如：
      - `REAGENT_SEARCH_PROVIDER`
      - `REAGENT_SEARCH_API_KEY`
      - `REAGENT_SEARCH_BASE_URL`（可选）
    - 先实现一个通用 HTTP 适配器，要求返回统一结果结构：标题、URL、摘要、域名。
    - 不在业务代码中绑定某一个供应商 SDK，避免依赖膨胀。
- 新增 `src/lib/reagent-ingest/fetch-verification-pages.ts`
  - 作用：对搜索结果做受控抓取，只抓前 N 个候选页面正文摘要，优先官网/商品页。
  - 设计：
    - 过滤掉明显低质量域名。
    - 优先保留 manufacturer 官网、产品页、datasheet。
    - 对抓取失败和空结果做软失败，不阻断主链路。

### 2. Split Parsing Into Two Explicit Stages

- 更新 `src/lib/reagent-ingest/parse-reagent.ts`
  - 阶段一：生成初稿
    - 继续使用当前本地知识库检索增强。
    - 第一轮 LLM 只负责“结构化初稿”，不直接视为最终结果。
  - 阶段二：联网核验与纠错
    - 若当前模型支持原生 web search，则对同一输入 + 初稿执行“核验纠错”请求。
    - 若不支持，则先调用 `web-search.ts` 获取外部结果，再抓取页面摘要，把这些证据喂给第二轮 prompt 做纠错。
    - 第二轮输出仍必须满足 `reagentParsedSchema`，并额外产出核验元数据。
  - 降级策略：
    - 若阶段一失败，不再立刻进入 heuristic fallback。
    - 先执行一次“宽容纠错恢复”路径：允许模型根据本地检索 + 外部检索重新生成严格 JSON。
    - 只有在“初稿失败 + 恢复失败 + 核验失败”都发生时才进入 heuristic fallback。
  - 返回值扩展：
    - 保留 `parseSource: "llm" | "fallback"`。
    - 新增类似 `verificationStatus: "verified" | "unverified"`。
    - 新增 `verificationMethod: "native_web_search" | "external_search" | "none"`。
    - 新增 `verificationWarnings: string[]`，用于内部和前端轻量展示。

### 3. Add Verification Prompt / Schema Support

- 新增 `src/lib/llm/prompts/reagent-verify.ts`
  - 作用：专门处理“根据外部证据对结构化初稿做纠错”。
  - Prompt 约束：
    - 以本地知识库和已有初稿为基线。
    - 外部证据只在高置信度时修改事实字段。
    - 对 `vendor`、`catalogNo`、`name`、`category`、`subCategory`、`experimentTags`、`antibodyMeta`、`primerMeta` 做逐项审视。
    - 如果证据冲突，保守输出并写入 warning，而不是硬改。
- 更新 `src/lib/llm/schemas.ts`
  - 在不破坏现有确认入库链路的前提下，为解析结果补充轻量核验元数据 schema。
  - 建议做法：
    - 保持 `reagentParsedSchema` 负责“业务字段”。
    - 新增组合 schema，如 `verifiedReagentParsedSchema = reagentParsedSchema.extend({ verification: ... })`。
  - 原因：
    - 避免确认入库时把核验元数据误当作 `Reagent` 业务字段。

### 4. Normalize API Responses And UI Status

- 更新 `src/app/api/reagents/parse/route.ts`
  - 返回单条解析的 `verificationStatus` 与 `verificationMethod`。
- 更新 `src/app/api/reagents/batch-parse/route.ts`
  - 透传每行的核验状态。
  - 当批量拆行阶段已经通过外部证据补齐 `vendor`/`catalogNo` 时，要把补齐后的结构传给后续单行解析。
- 更新 `src/components/reagent/reagent-form.tsx`
  - 在现有 `解析来源` 旁新增轻量状态，如“已联网核验 / 未联网核验”。
  - 不展示 URL 和详细证据，符合已确认偏好。
- 更新 `src/components/reagent/reagent-batch-form.tsx`
  - 为每行结果增加同样的核验状态标识。

### 5. Improve Batch Flow Instead Of Only Single Parse

- 更新 `src/lib/reagent-ingest/extract-batch-rows.ts`
  - 保留现有表格优先逻辑。
  - 对非表格自由文本拆行加入可选联网辅助：
    - 当行内同时包含品名/厂家/货号时，仍优先结构抽取。
    - 当缺少 `catalogNo` 或 `vendor` 时，可利用外部搜索做补全候选。
  - 但需严格限制：
    - 只补充高置信度字段。
    - 不因单行补全失败而让整个 batch 失败。

### 6. Add Config / Docs

- 更新 `.env.example`
  - 新增搜索层相关环境变量说明：
    - `REAGENT_SEARCH_PROVIDER`
    - `REAGENT_SEARCH_API_KEY`
    - `REAGENT_SEARCH_BASE_URL`
    - `REAGENT_SEARCH_ENABLED`
- 更新 `README.md`
  - 说明两种联网模式：
    - 原生 web search
    - 外部搜索 API fallback
  - 说明当前兼容接口 provider 可能不支持原生工具，因此推荐配置外部搜索 API 作为降级保障。

## Assumptions & Decisions

- 不修改 `Reagent` 正式表结构，也不新增 Prisma migration。
  - 理由：联网核验元数据只存在于解析结果 JSON 和前端状态层即可。
- 不改变 demo 模式核心行为。
  - `DEMO_MODE=true` 下可以继续保留纯本地 fallback，不强依赖联网。
  - 若实现成本可控，可在代码层保留统一接口，但 demo 默认返回 `verificationStatus="unverified"`。
- 本地知识库仍然是分类语义的第一事实源。
  - 外部检索用于补充商品事实与纠偏，不应在低证据情况下推翻本地语义约束。
- 对未知 provider 默认关闭原生工具模式。
  - 这样能避免当前 `OPENAI_BASE_URL` 指向兼容接口时出现不可控错误。
- 前端只显示核验状态，不展示详细证据。
  - 但后端仍应在日志/内部结构中保留简要 warning，便于后续排障。

## Verification Steps

- 单元测试
  - 更新或新增：
    - `src/lib/reagent-ingest/confirm-reagent.test.ts`（确保新增核验元数据不影响确认入库）
    - `src/lib/reagent-ingest/extract-batch-rows.test.ts`（覆盖自由文本拆行 + 搜索补全降级）
    - 新增 `src/lib/reagent-ingest/parse-reagent.test.ts`（覆盖初稿成功、原生 web search 成功、外部搜索成功、全部失败后 fallback）
    - 新增 `src/lib/llm/model-capabilities.test.ts`（覆盖 provider/模型能力判断）
- 手工验收
  - 单条录入：
    - 输入常见标准品名，确认 `parseSource=llm` 且 `verificationStatus=verified`。
    - 输入易错品牌/货号组合，确认 `vendor`、`catalogNo`、类别/标签能被纠偏。
    - 输入无效或歧义商品名，确认不会错误强改，且最终才进入 fallback。
  - 批量录入：
    - 表格文本保持原行为。
    - 自由文本中混杂品牌、货号、备注时，检查拆行和每行核验状态。
    - 个别行联网失败时，其他行仍可正常返回。
- 回归检查
  - 运行 `npm test`
  - 运行 `npm run lint`
  - 对最近编辑文件执行诊断，确保没有新增 TypeScript / ESLint 错误。
