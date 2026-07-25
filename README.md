# Dorlabaemon

面向实验室科研人员的智能试剂管理与实验可行性判断系统，中文品牌记忆点为“哆LabA梦”。

## 功能

- 试剂入库：输入名称、货号，调用大模型进行结构化分类，人工确认后入库。
- 试剂知识增强：入库时补充细粒度实验用途标签、抗体靶点/宿主信息、引物靶点与内参标记。
- 标签覆盖常见场景：细胞培养、筛选抗生素、转染/转导、WB、qPCR、IF、ELISA、流式、外泌体分离等。
- 试剂整理：按实验室共享库存，支持多选并导出到剪贴板。
- 试剂整理：支持按名称、货号、标签、靶点筛选库存，并可多选导出。
- 实验判定：按 `WB/qPCR/IF/ELISA/FLOW + 研究方向` 判断是否满足实验条件。
- 手动输入实验名：可直接输入实验名称或流程上下文，系统先匹配已有规则，低匹配时返回候选实验模板与试剂配置，供人工确认。
- 规则能力：
- 通用规则按“最低必需项 + 推荐补充项”输出。
- 新增细粒度标签已接入推荐规则，例如 WB 转印膜/蛋白定量/还原剂，qPCR 细胞培养基/血清，IF 细胞骨架染料/细胞器染料，外泌体分离试剂等。
- WB：裂解/上样/一抗/二抗/检测底物 + 内参抗体，一二抗种属匹配冲突检测。
- qPCR：RNA 提取、逆转录、qPCR 扩增体系、目标引物、内参引物、无核酸酶水。
- IF：固定、透化、封闭、一抗、荧光二抗、核染、封片/抗淬灭介质。
- ELISA：包被、封闭、洗板、检测抗体、显色底物。
- FLOW：荧光抗体、染色缓冲液，推荐补充活死染和 marker 一抗。
- 方向规则示例：自噬/分泌性自噬（LC3/p62），外泌体（至少 1 个 tetraspanin + 1 个 TSG101/ALIX，Calnexin 为推荐污染排查项）。
- 解析链路：IDE skill 与项目运行时共享实验知识资产；运行时模型不会直接调用 IDE skill，而是读取同一份结构化知识进行增强。
- 运行时增强：网页端现已可配置服务器发布的 skill、MCP 搜索/抓取/自检能力，并在试剂解析与实验解析链路中返回 AI 自检和学习日志摘要。
- 权限隔离：实验室内共享，实验室间数据隔离；PI/Admin 可邀请成员。

## 最快启动（推荐先用 DEMO 模式）

如果你只是想先把项目跑起来，不想先装 PostgreSQL 或 Docker，优先用 DEMO 模式：

```bash
cd "/Users/era/Desktop/文件夹/开发/lab-reagent-system"
npm install
cp .env.example .env
```

把 `.env` 里的 `DEMO_MODE` 改成：

```env
DEMO_MODE="true"
```

然后启动：

```bash
npm run dev
```

访问 `http://localhost:3000`。

说明：
- DEMO 模式不需要 PostgreSQL，但仍建议保留 `.env.example` 里的默认 `DATABASE_URL`，这样 Prisma Client 可以正常初始化。
- 受保护页面在 DEMO 模式下可直接访问，也可以照常使用注册/登录页面；数据会保存到 `.data/demo-store.json`。
- DEMO 模式下部分 AI 能力会降级为本地启发式结果，自检与自动学习不会真正执行。
- 如果要切回真实数据库模式，把 `DEMO_MODE` 改回 `false`。

## 一键启动（本地 PostgreSQL + Docker）

如果你要体验完整数据库模式，请先安装并启动 Docker Desktop，然后执行：

```bash
cd "/Users/era/Desktop/文件夹/开发/lab-reagent-system"
bash scripts/setup-macos.sh
npm run dev
```

`scripts/setup-macos.sh` 会自动完成这些事情：
- 检查 Docker CLI 和 Docker Desktop 是否可用
- 启动名为 `lab-postgres` 的本地 PostgreSQL 容器
- 在缺少 `.env` 时从 `.env.example` 生成一份
- 安装依赖、执行 `prisma generate`、`prisma migrate dev` 和 `db:seed`

首次启动后访问 `http://localhost:3000`，先注册再登录。

## 手动启动（进阶）

如果你不想使用一键脚本，可以手动执行：

```bash
cd "/Users/era/Desktop/文件夹/开发/lab-reagent-system"
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

说明：
- `.env.example` 默认已经指向本机 `5432` 端口上的 `postgres/postgres` 数据库。
- 如果你使用的是脚本创建的 Docker 容器，通常不需要改 `DATABASE_URL`。
- `npx prisma migrate dev --name init` 适合你在新增迁移时使用；普通启动项目时直接执行 `npx prisma migrate dev` 更合适。

## Docker 常见问题

- 报错 `Cannot connect to the Docker daemon ... docker.sock`：
- 说明 Docker Desktop 没启动，不是项目代码问题。
- 先执行 `open -a Docker`，等 Docker 完全启动后重试。
- 若首次使用脚本，它会自动帮你检测并提示下一步。

## 本地数据库替代方案（不用 Docker）

- 如果你不想用 Docker，可以安装本机 PostgreSQL（例如 Homebrew）。
- 安装后保证 `DATABASE_URL` 指向可用数据库，再执行：

```bash
npx prisma migrate dev
npm run db:seed
```

## 环境变量

本地开发至少要有下面这些键，直接从 `.env.example` 复制即可：

- `DEMO_MODE`：`true` 走本地演示模式，`false` 走真实数据库模式
- `DATABASE_URL`：PostgreSQL 连接串
- `NEXTAUTH_URL`：本地通常为 `http://localhost:3000`
- `NEXTAUTH_SECRET`：NextAuth 用到的随机密钥

下面这些是可选项，只有在你想启用联网 AI 解析时才需要配置：

- `OPENAI_BASE_URL`：OpenAI 兼容接口地址（可用 Minimax）
- `OPENAI_API_KEY`：模型密钥（不要提交到 GitHub）
- `OPENAI_MODEL`：文本模型名称
- `OPENAI_VISION_MODEL`：图片转文字专用视觉模型；若留空则回退到 `OPENAI_MODEL`
- `REAGENT_SEARCH_ENABLED`：是否启用试剂联网检索纠错；设为 `false` 时只保留本地知识库 + LLM
- `REAGENT_SEARCH_PROVIDER`：外部搜索提供方，当前支持 `tavily` 和 `serper`
- `REAGENT_SEARCH_API_KEY`：外部搜索 API 密钥
- `REAGENT_SEARCH_BASE_URL`：可选，自定义搜索 API 地址
- `LLM_ENABLED_SKILLS`：可选，默认启用的运行时 skill，逗号分隔
- `LLM_ENABLED_MCP_SERVERS`：可选，默认启用的 MCP server，逗号分隔
- `LLM_SELF_CHECK_ENABLED`：可选，是否默认开启自检
- `LLM_AUTO_LEARN_ENABLED`：可选，是否默认申请自动学习

### 试剂联网纠错

- 单条与批量试剂解析现在都采用两阶段流程：先产出结构化初稿，再进行联网核验和纠错。
- 若当前模型提供方支持原生 web search，会优先走模型原生工具。
- 若当前 `OPENAI_BASE_URL` 对应的兼容接口不支持原生工具，则自动退回到外部搜索 API + 页面抓取。
- 前端仅展示“已联网核验 / 未联网核验”状态，不直接展示来源 URL。

### 运行时 Skill / MCP / 自检

- 设置页新增用户级配置：skill 开关、MCP server 开关、自检开关、自动学习开关。
- 新增实验室级 AI policy：控制哪些角色可对 `REAGENT` / `EXPERIMENT` 域触发自动学习写回。
- 当前内置 server-published skill：
  - `reagent-classification-curator`
  - `experiment-type-curator`
- 当前内置 MCP server：
  - `search`
  - `fetch`
  - `self-check`
- 试剂解析与实验解析接口会返回 `ai` 元数据，包含启用的 skill/MCP、自检结果以及知识变更日志 ID。
- 正式运行时知识现优先读取数据库中的 `ReagentKnowledgeEntry` 与 `ExperimentKnowledgeEntry`；仓库内 `catalog.json` 继续作为 seed 和兜底基线。

### 正式知识入库

- 执行迁移后运行：

```bash
npx prisma migrate dev
npm run db:seed
```

- `db:seed` 会把当前试剂知识与实验知识基线导入数据库表。
- 自动学习写回在通过实验室策略、自检和风险校验后，会把新条目写入数据库知识表，并生成可回滚日志。
- 仪表盘新增“知识审计”页面，可按实验室查看学习写回日志、比较变更前后内容并执行回滚。

## 生产部署

- 已提供 `Dockerfile`、`docker-compose.prod.yml`、`.env.example`
- 服务器部署步骤见 `docs/deployment-server.md`
- 若需要绑定 `dorlabaemon.era.ac.cn`，可直接参考 `deploy/Caddyfile.example` 或 `deploy/nginx.dorlabaemon.conf`
