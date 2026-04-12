# 新增试剂批量导入功能计划

## Summary
- 在 `src/app/(dashboard)/reagents/new/page.tsx` 保留现有单条新增流程，并新增一个“批量新增”工作区。
- 批量工作区支持两类输入源：
  - 直接粘贴多行文本/表格文本。
  - 在输入框内粘贴图片，前端自动调用图片转文字接口，将识别文本追加回批量输入框，再进入原有识别链路。
- 批量识别后的结果同时支持：
  - 逐条勾选确认入库。
  - 一键“全部确认入库”。
- 若同一实验室中已存在相同 `catalogNo`，不报重复错误，而是把该试剂视为补货：
  - 已有记录数量按 `quantity = (quantity ?? 1) + 1` 递增。
  - 新建记录默认 `quantity = 1`。
  - 返回“库存 1 -> 2”之类的合并结果摘要。

## Current State Analysis

### 页面与前端
- `src/app/(dashboard)/reagents/new/page.tsx`
  - 当前只负责加载实验室列表并渲染 `ReagentForm`。
- `src/components/reagent/reagent-form.tsx`
  - 仅支持单条输入字段：`name`、`catalogNo`、`note`。
  - 提交到 `/api/reagents/parse`，成功后得到单个 `draftId + parsed`。
  - 再调用 `/api/reagents/confirm` 完成单条入库。
  - 当前没有批量输入区、图片粘贴、逐条选择或批量确认 UI。

### 后端接口
- `src/app/api/reagents/parse/route.ts`
  - 只接受单条 payload：`labId`、`name`、`catalogNo`、`note`、`lang`。
  - 通过项目知识检索 + LLM 解析，失败时回退到 heuristic fallback。
  - 每次只创建一个 `reagentParseDraft`。
- `src/app/api/reagents/confirm/route.ts`
  - 只支持单个 `draftId` 确认。
  - 当前直接 `prisma.reagent.create()`，会受 `@@unique([labId, catalogNo])` 约束影响。
  - 目前没有“重复货号转库存增加”的业务逻辑。

### 数据模型与 Demo 模式
- `prisma/schema.prisma`
  - `Reagent` 已有 `quantity Float?`，不需要新增数据库字段即可支持补货计数。
  - `Reagent` 仍保留 `@@unique([labId, catalogNo])`，可作为“同货号合并库存”的锚点。
  - `ReagentParseDraft` 已可存放单条解析结果，首版可继续沿用“一条批量项对应一个 draft”，避免新增 batch draft 表。
- `src/lib/demo-store.ts`
  - `demoParseReagent()` / `demoConfirmReagent()` 目前也只支持单条。
  - Demo 模式同样需要跟真实模式保持一致的批量与补货语义。

### LLM 能力
- `src/lib/llm/client.ts`
  - 已使用 OpenAI-compatible `responses.create()`。
- `src/lib/llm/prompts/reagent-parse.ts`
  - 已有单条试剂结构化提示词，可继续作为“每行标准化分类”的第二阶段能力。
- 当前仓库里还没有图片输入、多模态 OCR、批量文本切分/抽取的专用提示词或 helper。

## Proposed Changes

### 1. 页面改造：在新增页并排支持单条与批量
- 修改 `src/app/(dashboard)/reagents/new/page.tsx`
  - 保持实验室选择逻辑不变。
  - 在现有单条 `ReagentForm` 之外新增批量入口，推荐布局为：
    - 单条新增卡片。
    - 批量新增卡片。
  - 不引入新路由，避免新增导航复杂度；用户仍从现有“新增试剂”页进入。

- 保留并轻量调整 `src/components/reagent/reagent-form.tsx`
  - 继续承担单条录入。
  - 将确认成功提示扩展为区分：
    - 新建成功。
    - 货号已存在，库存递增成功。
  - 单条流程与批量流程共享同一套“确认入库/库存合并”服务逻辑，避免规则分叉。

- 新增 `src/components/reagent/reagent-batch-form.tsx`
  - 负责完整批量工作流，状态至少包括：
    - 原始批量文本。
    - 图片提取中的 loading/error。
    - 批量解析结果列表。
    - 每条是否选中入库。
    - 批量确认中的 loading 与结果摘要。
  - 输入区设计：
    - 一个大 `textarea`，允许粘贴多行文本。
    - 同一个输入框监听 `onPaste`，若 `clipboardData.items` 中出现图片，则自动上传图片内容到图片转文字接口。
    - 图片转文字成功后，把提取文本追加到当前输入框末尾，并插入明显分隔（如空行），避免覆盖用户已输入内容。
  - 识别结果区设计：
    - 每条显示原始抽取字段：名称、厂家、货号、抗体兼容性/备注。
    - 每条显示解析结果：类别、子类、标签、抗体信息、warnings、解析来源。
    - 提供逐条勾选、全选、取消全选。
    - 提供“全部确认入库”和“确认已选项”两个按钮。
    - 对失败条目只展示错误，不生成 draft，不允许入库。

### 2. 两阶段批量识别链路
- 新增共享目录 `src/lib/reagent-ingest/`
  - 目的：把“单条解析”“批量文本切分”“确认入库/补货合并”从 route handler 中抽离，避免单条与批量重复实现。

- 新增 `src/lib/reagent-ingest/parse-reagent.ts`
  - 抽出当前 `/api/reagents/parse` 的核心单条解析流程：
    - 检索 `retrieveReagentKnowledge()`
    - 调用 `buildReagentParsePrompt()`
    - LLM 解析
    - fallback heuristic
    - 返回 `parsed + parseSource + warnings/confidence`
  - `/api/reagents/parse` 与新批量解析接口都调用它。

- 新增 `src/lib/reagent-ingest/extract-batch-rows.ts`
  - 实现“批量原始文本 -> 逐条候选字段”的第一阶段。
  - 先做轻量规则切分：
    - 按行拆分。
    - 若检测到 TSV/Excel 风格（制表符明确列结构），优先按表格行解析。
  - 对非规整文本或 OCR 返回文本，再调用 LLM 做结构化抽取，输出统一数组：
    - `sourceText`
    - `name`
    - `vendor`
    - `catalogNo`
    - `note`
    - `antibodyCompatibilityText`（原始兼容性文本，先进入 note/辅助字段）
  - 这样文本粘贴与图片 OCR 文本最终走同一第二阶段分类链路。

- 新增 `src/lib/llm/prompts/reagent-batch-extract.ts`
  - 用于批量抽取，不负责分类，只负责把原始文本拆成多条试剂候选记录。
  - 输出必须为严格 JSON 数组。
  - 明确忽略空行、表头、无效噪声。
  - 对图片 OCR 常见错位文本做容错说明。

### 3. 新 API：批量解析与图片转文字
- 新增 `src/app/api/reagents/batch-parse/route.ts`
  - 入参：
    - `labId`
    - `rawText`
    - `lang`
  - 流程：
    1. 校验登录与实验室权限。
    2. 调用 `extract-batch-rows.ts` 得到候选条目。
    3. 对每个候选条目调用共享的 `parse-reagent.ts`。
    4. 对成功条目分别创建 `reagentParseDraft`。
    5. 返回批量结果数组，每项包含：
       - `rowId`
       - `draftId?`
       - `rawInput`
       - `parsed?`
       - `parseSource?`
       - `error?`
  - 关键决策：
    - 首版不新增 batch draft 表。
    - 一条批量项对应一个普通 `ReagentParseDraft`。
    - 某条失败不影响其他条成功返回。

- 新增 `src/app/api/reagents/extract-image/route.ts`
  - 入参：
    - `labId`
    - `imageBase64`
    - `mimeType`
    - `lang`
  - 流程：
    1. 校验登录与实验室权限。
    2. 调用 `responses.create()` 的多模态输入，把图片转成尽量忠实的可编辑文本。
    3. 返回 `text`，不直接入库，不创建 draft。
  - 关键决策：
    - 首版只处理“单次粘贴的一张图片”。
    - 不做文件持久化；前端转 base64 后直接请求，服务端只做瞬时处理。
    - 若模型/网关不支持图片，接口返回明确错误，前端允许用户继续手工粘贴文本，不阻塞其他流程。

### 4. 新 API：批量确认入库 + 补货合并
- 新增 `src/lib/reagent-ingest/confirm-reagent.ts`
  - 统一封装真实模式的确认逻辑，供单条确认与批量确认共用。
  - 输入为单条 `draftId + editedPayload`。
  - 行为：
    - 若不存在同 `labId + catalogNo` 记录：
      - 新建 `Reagent`，并设置 `quantity = 1`。
    - 若已存在：
      - 不新建重复记录。
      - 读取旧数量 `before = existing.quantity ?? 1`。
      - 更新为 `after = before + 1`。
      - 返回 `{ action: "incremented", beforeQuantity, afterQuantity, reagentId }`。
    - 将对应 draft 标记为 `isConfirmed = true`。
  - 首版冲突策略：
    - 只增库存，不覆盖已有分类/元数据，避免批量导入意外篡改既有记录。

- 更新 `src/app/api/reagents/confirm/route.ts`
  - 改为调用 `confirm-reagent.ts`。
  - 返回结构改为兼容：
    - `action: "created" | "incremented"`
    - `reagentId`
    - `beforeQuantity?`
    - `afterQuantity?`
  - 这样单条新增与批量新增的业务规则保持一致。

- 新增 `src/app/api/reagents/batch-confirm/route.ts`
  - 入参：
    - `items: Array<{ draftId, editedPayload }>`
  - 流程：
    - 逐条复用 `confirm-reagent.ts`。
    - 返回成功/失败明细与汇总：
      - `createdCount`
      - `incrementedCount`
      - `failedCount`
      - `results[]`
  - 前端据此展示“新增 N 条、补货 M 条、失败 K 条”。

### 5. Demo 模式对齐
- 更新 `src/lib/demo-store.ts`
  - 让 demo 侧也支持：
    - 批量逐条生成 draft。
    - 同货号补货时 `quantity + 1`。
  - 必要时补充 demo 中 `DemoReagent.quantity` 字段，使真实模式与 demo 模式语义一致。

### 6. 类型、提示词与前端数据结构
- 视实现需要补充以下文件中的类型：
  - `src/lib/llm/schemas.ts`
    - 增加“批量抽取结果” schema。
  - `src/components/reagent/reagent-batch-form.tsx`
    - 本地类型要覆盖：
      - 原始抽取字段
      - 解析结果
      - 失败状态
      - 是否勾选
      - 确认回执（created/incremented）
- `src/lib/http.ts`
  - 无需改动 fetch 封装；图片接口仍可走 JSON body。

## Assumptions & Decisions
- 批量文本首版的“标准高质量输入”定义为：
  - 多行文本；
  - 或 Excel/表格复制出来的制表符文本；
  - 或图片 OCR 提取出的原始文本。
- 由于用户明确要求“系统批量识别”，首版不要求用户严格按固定分隔符手工整理；系统会先做批量抽取，再走现有单条分类链路。
- 图片粘贴体验采用“自动提取”：
  - 粘贴图片即发起 OCR；
  - 成功后自动把文本追加回输入框；
  - 用户仍可手工修改文本后再点“批量识别”。
- 首版图片输入只支持剪贴板图片，不额外加入本地文件上传按钮。
- 同货号重复的首版业务解释为“补货”，不是“更新元数据”。
- 数量语义采用：
  - 旧记录 `quantity` 为空时，按库存 1 处理；
  - 新建记录默认写入 `quantity = 1`。
- 不新增 Prisma migration，除非实现中发现 demo/真实模式无法仅靠现有 `quantity` 字段对齐。

## Verification Steps
- 前端交互验证
  - 在 `新增试剂` 页面可同时看到单条与批量入口。
  - 向批量输入框粘贴多行文本，能够得到多条识别结果。
  - 向批量输入框粘贴图片，能够自动触发图片转文字，并把文本回填到输入框。
  - 批量结果支持逐条选择、全选、确认已选、全部确认。

- API 与业务验证
  - `/api/reagents/batch-parse` 对部分脏数据输入时，成功项与失败项能同时返回。
  - `/api/reagents/batch-confirm` 对新货号返回 `created`，对已存在货号返回 `incremented`。
  - 单条 `/api/reagents/confirm` 在重复货号时也执行库存 +1，而不是报唯一键冲突。

- 测试与诊断
  - 新增针对共享逻辑的 Node tests，至少覆盖：
    - 批量文本抽取的表格输入与非规整输入。
    - 重复货号时数量从 `null -> 2`、`1 -> 2`、`2 -> 3` 的补货逻辑。
    - 批量确认中“部分成功部分失败”的结果汇总。
  - 运行 `npm test`。
  - 运行 `npm run lint`。
  - 对修改过的文件执行诊断检查，确保无明显类型/ESLint 报错。
