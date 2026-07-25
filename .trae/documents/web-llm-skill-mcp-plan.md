# 网页端 LLM Skill 与 MCP 接入规划

## Summary

- 目标：在**不新增通用聊天页**的前提下，增强现有业务流程中的大模型能力，使网页端触发的试剂解析、批量解析、实验解析与实验判定可以通过服务端统一发布的 skill 与标准 MCP 工具完成“知识检索 + 联网搜索 + 自检 + 自动学习入库”。
- 结论：**当前项目部分支持，但还不支持你要的完整形态。**
- 已具备能力：
  - 网页端已有用户级 LLM 设置页，可配置模型接口与联网搜索，见 `src/app/(dashboard)/settings/page.tsx` 与 `src/app/api/settings/llm/route.ts`。
  - 运行时已有用户级 LLM 配置解析层，见 `src/lib/llm/runtime-config.ts`。
  - 试剂解析已支持“模型原生 web search 优先，外部搜索 fallback”，见 `src/lib/reagent-ingest/parse-reagent.ts`、`src/lib/reagent-ingest/web-search.ts`、`src/lib/reagent-ingest/fetch-verification-pages.ts`。
  - 项目已有本地 skill 资产，但它们只在 IDE/Agent 体系中存在，运行时并不会被网页端直接调用；当前做法是共享结构化知识资产，而不是共享 skill 执行能力，见 `.trae/skills/` 与 `README.md`。
- 当前缺口：
  - 没有标准 MCP client/server 接入层。
  - 没有网页端可启用的运行时 skill registry。
  - 没有统一的“自检-学习-写回正式知识”执行链路。
  - 没有“按实验室配置”的自动写回权限、审计、回滚与审批机制。

## Current State Analysis

### 1. 网页端 LLM 设置已存在，但只覆盖模型与搜索配置

- `src/app/(dashboard)/settings/page.tsx`
  - 当前允许用户配置 `OpenAI API Key`、`Base URL`、文本模型、视觉模型、外部搜索 provider、搜索 API Key、搜索 Base URL。
  - 页面中没有 skill 配置、MCP server 配置、工具权限配置、学习模式配置。
- `src/app/api/settings/llm/route.ts`
  - 当前只保存上述模型与搜索字段。
- `src/lib/llm/runtime-config.ts`
  - 当前运行时配置类型只有：
    - 模型认证与模型名
    - `searchEnabled`
    - `searchProvider`
    - `searchApiKey`
    - `searchBaseURL`
  - 没有 skill 开关、MCP server 列表、学习策略、自动写回策略。
- `prisma/schema.prisma`
  - `UserLlmConfig` 模型只覆盖模型与搜索字段，没有 skill/MCP/学习配置。

### 2. 联网搜索已部分具备“工具能力”，但不是 MCP

- `src/lib/llm/client.ts`
  - OpenAI 原生 provider 走 `responses.create()`，并通过 `include: ["web_search_call.action.sources"]` 读取来源。
  - 非 OpenAI provider 退回普通 chat completion，不带标准工具编排。
- `src/lib/llm/model-capabilities.ts`
  - 只保守判断是否支持原生 `web_search_preview`。
  - 不存在通用 tools capability 或 MCP capability。
- `src/lib/reagent-ingest/web-search.ts`
  - 当前外部搜索只是对 `tavily` / `serper` 的直接 HTTP 封装。
  - 这相当于项目内的“点对点 provider adapter”，不是标准 MCP client。
- `src/lib/reagent-ingest/fetch-verification-pages.ts`
  - 已有网页抓取与摘要提取能力，可作为 MCP 工具化的重要基础。

### 3. 本地 skill 已有知识价值，但当前不是运行时可调用单元

- `.trae/skills/experiment-type-curator/SKILL.md`
- `.trae/skills/reagent-classification-curator/SKILL.md`
- 当前 skill 主要承载：
  - 任务边界
  - 操作原则
  - 输出结构
  - 审查清单
- 这些 skill 没有被运行时 API 直接加载，也没有统一 registry、权限、版本、审计。
- `README.md` 已明确：
  - “IDE skill 与项目运行时共享实验知识资产；运行时模型不会直接调用 IDE skill，而是读取同一份结构化知识进行增强。”
- 这说明现状是**共享知识，不共享 skill 执行链路**。

### 4. 现有业务流程中，最适合挂载 skill/MCP 的切入点已经存在

- `src/lib/reagent-ingest/parse-reagent.ts`
  - 已分成“初稿生成 -> 原生联网核验 -> 外部搜索核验 -> 兜底”。
  - 这是最适合插入：
    - 试剂分类 skill
    - 联网搜索 MCP
    - 页面抓取 MCP
    - 自检 MCP
    - 学习写回流程
- `src/lib/experiment/resolve.ts`
  - 已分成“目录直匹配 -> 本地知识检索 -> LLM 生成建议”。
  - 这是最适合插入：
    - 实验类型 skill
    - 检索/搜索 MCP
    - 自检与知识增量学习流程
- 未来若扩展到实验判定，`src/lib/rules/` 与 `src/app/api/experiment/check/route.ts` 也可复用同一套编排层。

## Assumptions & Decisions

- 产品边界：
  - 不新增通用对话式助手页。
  - 先只增强现有试剂解析、批量解析、实验解析、实验判定等既有业务流程。
- skill 来源：
  - skill 由服务器统一发布，网页端只负责启用、禁用、选择策略，不支持在线编写 skill。
- MCP 方案：
  - 采用**标准 MCP 协议**，而不是仅做内部 tool gateway。
- 学习自检：
  - 需要支持“自检 + 自动学习入库”。
- 自动写回范围：
  - 覆盖正式试剂知识与实验知识，不只限于个人记忆或共享草稿。
- 权限模式：
  - 自动写回权限按实验室配置，而不是全局硬编码单一角色。
- 风险判断：
  - 由于要“直接改正式知识”，必须引入**权限、审计、版本、回滚、来源证据、幂等保护**，否则会破坏现有规则稳定性。

## Proposed Changes

### 1. 扩展数据模型，承载网页端 skill/MCP/学习配置

#### 目标

- 让网页端不仅能配置模型和搜索，还能配置：
  - 启用哪些 skill
  - 启用哪些 MCP server
  - 哪些实验室允许自动学习写回
  - 哪些角色具备自动写回权限

#### 需要改动的文件

- `prisma/schema.prisma`
  - 扩展 `UserLlmConfig`，新增运行时能力相关字段，例如：
    - `enabledSkills`
    - `enabledMcpServers`
    - `selfCheckEnabled`
    - `autoLearnEnabled`
  - 新增实验室级配置模型，例如：
    - `LabAiPolicy`
      - 是否允许自动写回正式知识
      - 允许哪些角色执行
      - 允许写回哪些知识域
  - 新增审计模型，例如：
    - `KnowledgeMutationLog`
      - 来源流程
      - 目标知识域
      - 变更前后快照
      - 证据摘要
      - 执行用户
      - 执行模型
      - 回滚信息
- `src/lib/demo-store.ts`
  - DEMO_MODE 下补齐上述新增配置与审计的本地文件存储分支。
- `src/lib/llm/runtime-config.ts`
  - 扩展 `RuntimeLlmConfig` 与读取/保存逻辑，支持 skill/MCP/自检/学习配置解析。

#### 设计要点

- 用户级配置决定“本次模型调用可用哪些能力”。
- 实验室级策略决定“是否允许写回正式知识，以及谁能写”。
- 只有两层都允许时，自动学习写回才可执行。

### 2. 建立运行时 Skill Registry，把 `.trae/skills` 转成服务端可消费能力

#### 目标

- 让现有本地 skill 不再只是 IDE 文档，而能变成运行时可调用的服务端 skill 定义。

#### 需要改动的文件

- 新增 `src/lib/skills/registry.ts`
  - 定义运行时 skill 元数据：
    - `id`
    - `name`
    - `description`
    - `domains`
    - `inputSchema`
    - `outputSchema`
    - `promptTemplate`
    - `allowedFlows`
    - `supportsLearning`
- 新增 `src/lib/skills/loaders.ts`
  - 负责从服务器固定目录加载 skill 定义。
  - 一期可先从 `.trae/skills/*/SKILL.md` 加载“说明性配置”，再映射到运行时 registry。
- 新增 `src/lib/skills/builtin/experiment-type-curator.ts`
- 新增 `src/lib/skills/builtin/reagent-classification-curator.ts`
  - 将现有两个 skill 固化为运行时可执行 skill。
- `README.md`
  - 更新文档，明确“运行时 skill”与“IDE skill”之间的关系：
    - 同名 skill 可共享知识原则与输出结构
    - 运行时不直接执行 Markdown，而执行服务器内置实现

#### 设计要点

- 不建议直接把 `.trae/skills/*.md` 原样喂给运行时执行。
- 更稳妥的方式是：
  - Markdown 作为人类可读规范
  - `registry.ts + builtin/*.ts` 作为实际执行单元
- 这样可以保留你想要的“服务器统一部署 skill”，同时避免运行时动态加载任意 prompt 的风险。

### 3. 引入标准 MCP Client，并把“搜索/抓取/自检”工具化

#### 目标

- 用标准 MCP 协议替代当前分散的 provider 调用方式，使网页端触发的业务流程可以统一调用：
  - 联网搜索
  - 网页抓取
  - 来源提炼
  - 自检
  - 知识变更预演

#### 需要改动的文件

- 新增 `src/lib/mcp/client.ts`
  - 标准 MCP client 封装，负责与一个或多个 MCP server 通信。
- 新增 `src/lib/mcp/registry.ts`
  - 记录服务器端允许接入的 MCP server 及其工具白名单。
- 新增 `src/lib/mcp/tool-router.ts`
  - 统一路由工具调用结果到业务流程。
- 新增 `src/lib/mcp/servers/search-server.ts`
  - 封装外部搜索 provider，为标准 MCP 工具。
- 新增 `src/lib/mcp/servers/fetch-server.ts`
  - 封装页面抓取与正文抽取逻辑，复用 `src/lib/reagent-ingest/fetch-verification-pages.ts` 中已有能力。
- 可选新增 `src/lib/mcp/servers/self-check-server.ts`
  - 提供“对现有输出进行一致性检查、来源充足性检查、变更风险打分”的工具。
- `src/lib/reagent-ingest/web-search.ts`
  - 从“业务私有搜索模块”重构为 MCP server 背后的 provider adapter。
- `src/lib/reagent-ingest/fetch-verification-pages.ts`
  - 下沉为 fetch MCP server 的内部实现。

#### 设计要点

- 标准 MCP 一期建议优先提供 3 类工具：
  - `search_web`
  - `fetch_page`
  - `self_check_result`
- 现有 `tavily` / `serper` 继续保留，但变成 search MCP server 的底层 provider。
- 若未来要部署到服务器，可把这些 MCP server 以独立 Node 进程或独立容器运行，再由主应用以 client 方式接入。

### 4. 在现有业务流程中插入“Skill + MCP + 自检 + 学习”编排层

#### 目标

- 保留现有 API 形状不大改，但把内部链路升级为统一编排。

#### 需要改动的文件

- 新增 `src/lib/ai-orchestrator/run-flow.ts`
  - 统一执行：
    - 读取用户运行时配置
    - 选择可用 skill
    - 选择可用 MCP 工具
    - 执行自检
    - 判断是否允许学习写回
- 新增 `src/lib/ai-orchestrator/types.ts`
  - 定义 flow context、tool call、skill result、self-check result、learning mutation。
- `src/lib/reagent-ingest/parse-reagent.ts`
  - 从现有串行逻辑升级为：
    - 本地知识检索
    - `reagent-classification-curator` skill 增强
    - MCP 搜索与抓取
    - 模型输出
    - 自检工具复核
    - 若满足策略则触发学习写回
- `src/lib/reagent-ingest/extract-batch-rows.ts`
  - 批量流程接入同一 orchestrator，避免单条与批量分叉。
- `src/lib/experiment/resolve.ts`
  - 插入 `experiment-type-curator` skill、MCP 搜索、自检、学习写回。
- `src/app/api/reagents/parse/route.ts`
- `src/app/api/reagents/batch-parse/route.ts`
- `src/app/api/experiment/resolve/route.ts`
- `src/app/api/experiment/check/route.ts`
  - 这些路由层主要改为读取新的 flow result，并透传审计/学习状态。

#### 设计要点

- 业务 API 继续保持面向页面的稳定返回。
- “是不是用 skill”“是不是走 MCP”“是不是允许写回”都在 orchestrator 内决策。
- 这样不会把复杂策略散落到各个 route 和 lib 中。

### 5. 为网页端新增 Skill/MCP/学习配置 UI

#### 目标

- 让当前设置页能显式控制：
  - 启用哪些服务器固定 skill
  - 启用哪些 MCP server
  - 是否开启自检
  - 是否申请自动学习写回
  - 当前用户/当前实验室是否具备自动写回权限

#### 需要改动的文件

- `src/app/(dashboard)/settings/page.tsx`
  - 增加新的配置区域：
    - Skill 开关区
    - MCP Server 开关区
    - 自检策略区
    - 学习写回区
    - 权限状态与风险提示区
- `src/app/api/settings/llm/route.ts`
  - 扩展 GET/POST schema。
- `src/app/api/settings/llm/test/route.ts`
  - 测试项扩展为：
    - 模型连接
    - 搜索 MCP
    - 抓取 MCP
    - 自检 MCP
    - skill registry 可用性
- 新增 `src/app/api/settings/ai-policy/route.ts`
  - 处理实验室级 AI policy 配置。
- 可选新增 `src/app/(dashboard)/settings/ai-policy/page.tsx`
  - 若不想把用户配置和实验室策略混在一个页中，可拆出独立页面。

#### 设计要点

- 用户级与实验室级配置不要混淆：
  - 用户级：本账号本次调用习惯
  - 实验室级：知识写回权限与共享规则
- 页面上必须明确显示：
  - “可调用”不等于“可写回”
  - “自动学习写回正式知识”会影响共享规则

### 6. 建立正式知识写回通路，而不是直接改静态 JSON/TS 文件

#### 目标

- 让“自动学习入库”真正可在服务器上工作，并且可以追踪与回滚。

#### 当前约束

- 现有正式知识主要在代码仓中的静态文件：
  - `src/lib/reagent-knowledge/catalog.json`
  - `src/lib/experiment-knowledge/catalog.json`
  - `src/lib/rules/catalog.ts`
- 这些文件适合代码版本管理，不适合运行时直接自动修改。

#### 决策

- 一期不建议让服务器直接改 Git 工作树中的 JSON/TS 文件。
- 应改为：
  - 把“正式知识运行时事实源”迁移到数据库表
  - 静态 JSON/TS 退化为 seed 或导出产物

#### 需要改动的文件

- `prisma/schema.prisma`
  - 新增：
    - 试剂知识条目表
    - 实验知识条目表
    - 规则模板表或规则补丁表
    - 知识版本表
    - 变更日志表
- `prisma/seed.ts`
  - 把现有 JSON/TS 知识导入数据库。
- `src/lib/reagent-knowledge/retrieval.ts`
  - 改为优先从数据库读取。
- `src/lib/experiment-knowledge/retrieval.ts`
  - 改为优先从数据库读取。
- `src/lib/rules/catalog.ts`
  - 一期可保留为兜底静态基线；长期应改成数据库驱动。
- 新增 `src/lib/knowledge/mutations/apply.ts`
  - 对模型提出的学习结果做规范化写入。
- 新增 `src/lib/knowledge/mutations/validate.ts`
  - 执行冲突检测、重复检测、破坏性影响评估。
- 新增 `src/lib/knowledge/mutations/rollback.ts`
  - 支持按日志回滚。

#### 设计要点

- 这是整件事里最关键的架构变更。
- 如果不把正式知识从代码文件迁到数据库，所谓“自动学习入库”在服务器环境里会非常脆弱：
  - 多实例不一致
  - Docker 容器内写盘不可持续
  - 无法审计
  - 无法回滚
  - 无法做权限控制

### 7. 增加自检与写回前验证，避免错误学习污染正式知识

#### 目标

- 让模型在写回前至少经过两层检查：
  - 输出正确性自检
  - 对正式知识的破坏性影响检查

#### 需要改动的文件

- 新增 `src/lib/self-check/run.ts`
  - 对候选输出执行：
    - schema 完整性检查
    - 与本地检索证据一致性检查
    - 与联网来源一致性检查
    - 置信度阈值判断
- 新增 `src/lib/knowledge/mutations/risk-score.ts`
  - 对知识写回进行风险评分：
    - 新增别名
    - 修正分类
    - 新增 experimentTags
    - 新增实验模板
    - 修改已有规则
- `src/lib/reagent-ingest/parse-reagent.ts`
- `src/lib/experiment/resolve.ts`
  - 只有当自检通过、风险评分通过、权限通过时，才允许自动写回。

#### 设计要点

- 写回阈值应按类型分层：
  - 新增低风险 alias/notes：阈值可低
  - 修改已有分类或规则：阈值应高
  - 覆盖已有正式规则：应要求更高阈值或强制人工确认

### 8. 增加审计、可观测性与回滚入口

#### 目标

- 由于要让模型“直接改正式知识”，必须能事后追溯。

#### 需要改动的文件

- 新增 `src/app/api/knowledge/logs/route.ts`
  - 查询学习写回日志。
- 新增 `src/app/api/knowledge/rollback/route.ts`
  - 对指定 mutation 做回滚。
- 可选新增 `src/app/(dashboard)/knowledge/page.tsx`
  - 展示知识变更记录、影响范围、回滚按钮。
- `docs/architecture.md`
  - 补充运行时 skill/MCP/学习写回架构。
- `docs/api.md`
  - 补充新增 API。
- `README.md`
  - 补充部署方式、权限和风险说明。

#### 设计要点

- 日志最少记录：
  - 谁触发
  - 哪个实验室策略放行
  - 哪个模型
  - 哪些 skill 与 MCP 工具被调用
  - 来源证据摘要
  - 写回前后 diff
  - 回滚状态

## Implementation Order

1. 扩展 Prisma 数据模型与 DEMO_MODE 数据结构，为 skill/MCP/学习策略、实验室 AI policy、知识 mutation log 提供持久化基础。
2. 建立运行时 `skill registry`，先把 `experiment-type-curator` 与 `reagent-classification-curator` 做成服务器内置 skill。
3. 建立标准 MCP client 与 3 个首批工具：
   - `search_web`
   - `fetch_page`
   - `self_check_result`
4. 新建统一 `ai-orchestrator`，并接入：
   - `src/lib/reagent-ingest/parse-reagent.ts`
   - `src/lib/reagent-ingest/extract-batch-rows.ts`
   - `src/lib/experiment/resolve.ts`
5. 扩展设置页与设置 API，新增网页端 skill/MCP/学习配置。
6. 将正式知识事实源从静态文件迁移到数据库优先读取，保留现有 JSON/TS 作为基线 seed。
7. 实现自动学习写回、风险评估、日志审计、回滚接口。
8. 更新文档与验收测试。

## Verification Steps

### 配置层验证

- 用户可在设置页看到并保存：
  - skill 开关
  - MCP server 开关
  - 自检开关
  - 自动学习开关
- 实验室管理员可配置 AI policy。
- `DEMO_MODE=true` 与正式模式均能读写这些配置。

### 运行时验证

- 试剂解析触发时：
  - 能按配置调用 `reagent-classification-curator`。
  - 能通过 MCP 搜索和抓取补充证据。
  - 能执行自检。
  - 满足策略时可写回知识。
- 实验解析触发时：
  - 能按配置调用 `experiment-type-curator`。
  - 能通过 MCP 搜索外部证据。
  - 能在低匹配场景下生成并自检新的实验知识项。

### 权限与安全验证

- 未被实验室策略授权的角色，即使开启自动学习，也不能写回正式知识。
- 不同实验室策略相互隔离。
- 高风险知识修改有清晰日志。
- 单次 mutation 支持回滚。

### 回归验证

- 现有 `OpenAI 原生 web search + 外部搜索 fallback` 行为不回退。
- 现有试剂解析、批量解析、实验解析 API 返回结构保持兼容，除新增字段外不破坏页面调用。
- 在未启用 skill/MCP/学习功能时，系统应尽量保持与当前行为一致。

### 建议新增测试

- `src/lib/skills/registry.test.ts`
- `src/lib/mcp/client.test.ts`
- `src/lib/ai-orchestrator/run-flow.test.ts`
- `src/lib/self-check/run.test.ts`
- `src/lib/knowledge/mutations/validate.test.ts`
- `src/lib/knowledge/mutations/apply.test.ts`
- `src/app/api/settings/llm/test/route` 对应集成测试
- `src/lib/reagent-ingest/parse-reagent.test.ts` 补充 skill/MCP/学习分支
- `src/lib/experiment/resolve.test.ts` 补充 skill/MCP/学习分支

## Key Recommendation

- 如果你的目标只是“网页端也能像 IDE 一样带 skill 和联网能力”，这件事**可以做**，而且当前项目已有不错基础。
- 但如果目标包含“自动学习并直接改正式知识”，建议把它视为**第二阶段核心改造**，前提是先完成：
  - 数据库存储正式知识
  - 实验室级权限策略
  - 审计与回滚
- 否则虽然功能能跑起来，但会很容易把共享知识库污染掉。
