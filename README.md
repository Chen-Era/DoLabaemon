<p align="center">
  <img src="https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=A%20friendly%20blue%20robot%20cat%20with%20a%20bell%2C%20holding%20a%20test%20tube%20and%20a%20beaker%2C%20laboratory%20theme%2C%20clean%20minimal%20style%2C%20flat%20illustration&image_size=square_hd" alt="Dorlabaemon Logo" width="120" />
</p>

<h1 align="center">Dorlabaemon 🧪 哆LabA梦</h1>

<p align="center">
  <strong>AI 驱动的智能实验室试剂管理与实验可行性判断系统</strong>
</p>

<p align="center">
  <a href="https://github.com/Chen-Era/DoLabaemon/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Chen-Era/DoLabaemon?color=blue" alt="License" /></a>
  <a href="https://github.com/Chen-Era/DoLabaemon/releases"><img src="https://img.shields.io/github/v/release/Chen-Era/DoLabaemon?include_prereleases&color=green" alt="Release" /></a>
  <a href="https://github.com/Chen-Era/DoLabaemon/tree/main/docs"><img src="https://img.shields.io/badge/docs-complete-brightgreen?logo=readthedocs" alt="Docs" /></a>
  <br/>
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Electron-40-47848F?logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/PostgreSQL-∞-4169E1?logo=postgresql" alt="PostgreSQL" />
  <br/>
  <a href="https://dorlabaemon.era.ac.cn"><img src="https://img.shields.io/badge/demo-live-ff69b4?style=flat" alt="Live Demo" /></a>
  <a href="#一键启动本地-postgresql--docker"><img src="https://img.shields.io/badge/docker-quick_start-2496ED?logo=docker" alt="Docker" /></a>
</p>

<p align="center">
  <a href="https://star-history.com/#Chen-Era/DoLabaemon&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Chen-Era/DoLabaemon&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Chen-Era/DoLabaemon&type=Date" />
      <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Chen-Era/DoLabaemon&type=Date" width="600" />
    </picture>
  </a>
</p>

---

## ✨ 亮点

| 亮点 | 说明 |
|------|------|
| 🤖 **AI 智能解析** | 输入试剂名称/货号即可自动结构化分类，联网核验纠错，告别手工填表 |
| 🧬 **实验可行性判断** | 支持 WB / qPCR / IF / ELISA / FLOW 五大核心实验，自动判定试剂是否满足实验条件 |
| 🏷️ **细粒度知识标签** | 覆盖抗体靶点/宿主、引物序列、内参标记、细胞培养/转染/筛选等多维度标签 |
| 🔬 **专业方向规则** | 内置自噬、外泌体等研究方向的专属判定链（如外泌体需 tetraspanin + TSG101/ALIX） |
| 🔄 **AI 自检与持续学习** | 可配置的 Skill / MCP 链路，解析结果附带自检日志，支持自动学习写回知识库 |
| 🖥️ **桌面端 + Web 端** | 基于 Electron 的原生桌面客户端 + Next.js Web 应用，一套代码双端运行 |
| 👥 **多实验室权限隔离** | 实验室内共享库存，实验室间数据严格隔离，PI/Admin 可邀请成员 |
| ⚡ **DEMO 模式 30 秒启动** | 无需 PostgreSQL/Docker，一个环境变量即可体验核心功能 |
| 📦 **Docker 一键部署** | 提供完整 Docker Compose 生产部署方案，含 Caddy/Nginx 反代配置 |
| 🎯 **批量操作** | 多选试剂一键导出剪贴板，按名称/货号/标签/靶点灵活筛选 |

## 📋 详细实验规则

### 五大核心实验判定链

| 实验 | 必需试剂 | 推荐补充 | 特色能力 |
|------|---------|---------|---------|
| **WB** | 裂解液、上样缓冲液、一抗、二抗、检测底物、内参抗体 | 转印膜、蛋白定量试剂、还原剂 | 一二抗种属匹配冲突检测 |
| **qPCR** | RNA 提取试剂、逆转录酶、qPCR Mix、目标引物、内参引物、无核酸酶水 | 细胞培养基、血清 | 引物靶点与内参标记校验 |
| **IF** | 固定液、透化剂、封闭液、一抗、荧光二抗、核染液、封片/抗淬灭介质 | 细胞骨架染料、细胞器染料 | 多通道荧光兼容性检测 |
| **ELISA** | 包被缓冲液、封闭液、洗板液、检测抗体、显色底物 | — | 包被-抗体配对逻辑 |
| **FLOW** | 荧光抗体、染色缓冲液 | 活死染色、Marker 一抗 | 多色补偿冲突预警 |

### 研究方向专属规则

- **自噬/分泌性自噬**：必须包含 LC3 / p62 抗体
- **外泌体**：至少 1 个 Tetraspanin（CD9/CD63/CD81）+ 1 个 TSG101/ALIX；Calnexin 为推荐污染排查项
- **骨转移方向**：支持骨相关标志物与通路抗体补充推荐

> 通用规则按"最低必需项 + 推荐补充项"结构输出，低匹配时返回候选实验模板与试剂配置供人工确认。

## 📁 文档

| 文档 | 说明 |
|------|------|
| [系统架构](docs/architecture.md) | 整体系统架构与模块设计 |
| [API 文档](docs/api.md) | 后端 API 接口说明 |
| [桌面客户端](docs/desktop-client.md) | Electron 桌面端构建与配置 |
| [服务器部署](docs/deployment-server.md) | Docker / Caddy / Nginx 生产部署 |
| [规则设计](docs/rule-design.md) | 实验判定规则引擎设计 |

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
