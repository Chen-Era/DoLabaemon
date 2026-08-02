<p align="center">
  <img src="./logo.png" alt="Dorlabaemon" width="420" />
</p>

<h1 align="center">Dorlabaemon</h1>

<p align="center">Reagent inventory management and experiment-readiness checks for research laboratories</p>

<p align="center">
  <a href="https://github.com/Chen-Era/DoLabaemon/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Chen-Era/DoLabaemon?color=blue" alt="MIT License" /></a>
  <a href="https://github.com/Chen-Era/DoLabaemon/releases"><img src="https://img.shields.io/github/v/release/Chen-Era/DoLabaemon?include_prereleases&color=green" alt="Release" /></a>
  <a href="https://dorlabaemon.era.ac.cn"><img src="https://img.shields.io/badge/demo-live-ff69b4" alt="Live demo" /></a>
</p>

<p align="center">
  <a href="#chinese">中文</a> | <a href="#english">English</a>
</p>

<a id="chinese"></a>

## 中文

Dorlabaemon 把试剂库存、实验规则和实验室成员权限放在同一个工作区中。研究人员可以录入或导入试剂，确认字段和分类，再检查某项实验所需的材料是否齐备。团队成员查看的是同一份库存，实验室之间的数据保持隔离。

在线体验：[dorlabaemon.era.ac.cn](https://dorlabaemon.era.ac.cn)

[English](#english)

### 项目要解决什么问题

实验准备不只是确认货架上有没有一瓶试剂。还要核对名称和货号是否准确，它是否符合当前实验的用途，以及团队成员是否在查看同一份记录。把这些信息分别放在库存表、实验清单和个人记录里，会让实验前的确认变得费时，也容易遗漏条件。

Dorlabaemon 分为录入、确认、检查和协作四步。它不替代实验方案或人工判断，只把实验前要核对的库存、规则和协作信息放到一起。

```mermaid
flowchart LR
  A["录入试剂"] --> B["确认字段与分类"]
  B --> C["检查实验条件"]
  C --> D["在实验室内协作"]
```

| 实验准备中的问题 | Dorlabaemon 的做法 |
| --- | --- |
| 试剂记录只有名称或货号，难以按实验用途核对。 | 将试剂整理为结构化字段，并用抗体、引物、内参、细胞培养、转染和筛选等标签描述用途。 |
| 知道库存里有什么，却不清楚能否开始一项实验。 | 将库存映射到实验的必需项和推荐项，列出已满足、待补充和需要注意的条件。 |
| 团队成员各自维护记录，实验室之间又需要边界。 | 以实验室为单位共享库存；PI 和管理员可邀请成员，实验室数据相互隔离。 |

### 它能做什么

#### 从库存记录到实验就绪

先选择一项已发布的具体末级技术，可按中英文名称、编号或别名检索；需要时也可以使用 AI 模糊匹配。系统把技术规则、可选实验方案和研究主题/通路规则合并检查。只有与该技术相容、且已有具体规则的主题才会显示，避免把没有依据的组合误判为可执行。

检查范围包括试剂、耗材、仪器、样本、对照和软件。试剂会根据库存与能力标签自动核验；其余资源需要研究人员确认。结果会明确标为“可开始”“缺少必需项”或“仍待确认”；没有发布规则、资源维度不完整的技术不会给出可开始的结果。

#### AI 整理，人工确认

填写试剂名称或货号后，系统会生成结构化解析草稿。也可以粘贴表格或上传、粘贴试剂清单图片，先转成可编辑文本再批量解析。配置模型和搜索服务后，还可以联网核对并自检。入库前仍需逐条确认，自动生成的内容不会直接成为实验记录。

#### 维护规则和知识

实验技术可以作为草稿提交、审核并发布为修订版本。AI 自检和知识写回都会留下记录，实验室管理员可以查看并回滚变更。可选的 Hermes 集成会在服务器上定时整理试剂知识，导出 JSONL 后由项目校验并导入。高置信度的知识库命中可以减少联网核验次数。

#### 实验记录 skill

仓库随 Hermes skills 提供 `experimental-record-writer`。研究者只需说明实际做了什么、用了什么，再补充图片或文本结果，skill 就会创建带修订快照、SHA-256 附件清单和审计事件的本地记录包。默认输出表格化 Markdown，也可导出 DOCX；需要团队协作时，可在用户完成授权后通过飞书官方 `lark-cli` 创建云文档并逐个插入结果附件。该功能写入用户指定的本地目录或飞书，不会自动写入本项目的 Web 数据库。安装和使用说明见 [Hermes 知识管家](integrations/hermes/README.md#实验记录-skill)。

#### 库存 MCP

已登录用户可在 **MCP 接入** 页面创建可撤销、可过期的只读令牌，将 `https://dorlabaemon.era.ac.cn/api/mcp` 配置到支持 Streamable HTTP 的本地模型或受控 Agent。MCP 在每次调用时重新验证实验室成员权限；它能为如“跑了 KLF6 和 β-actin 的 WB”返回已有一抗候选及货号，但只在唯一精确匹配时提供库存来源快照，多候选必须由研究者选择。库存结果不是本次实际使用的证据。见 [库存 MCP 指南](docs/mcp-inventory.md)。

#### 网页版和桌面端

Web 应用使用 Next.js，桌面端使用 Electron，两端共享一个项目代码库。桌面端连接已部署的服务，不在本地运行数据库或保存服务端密钥。

### 功能一览

| 功能 | 说明 |
| --- | --- |
| 试剂库存 | 新建、编辑和删除试剂记录；按名称、货号、标签或靶点筛选；支持库存增减、批量删除和复制导出。 |
| 实验资源检查 | 选择具体技术、实验方案和可选的研究主题/通路，同时检查方法需求与主题规则。试剂按库存自动核验；耗材、仪器、样本、对照和软件由用户确认。 |
| 知识维护 | 可配置 Skill 与 MCP 服务；AI 解析会保留自检记录，并可按实验室策略启用知识自动写回。 |
| 多实验室协作 | 实验室内成员共享库存；实验室之间的数据相互隔离。PI 和管理员可以邀请成员。 |

### 快速开始

#### DEMO 模式，约 30 秒

DEMO 模式不需要 PostgreSQL 或 Docker，适合先了解主要功能。数据保存在 `.data/demo-store.json`。

```bash
npm install
cp .env.example .env
# 将 .env 中的 DEMO_MODE 改为 "true"
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

#### 数据库模式，macOS

安装并启动 Docker Desktop 后，下面的脚本会启动 PostgreSQL 容器、创建 `.env`、安装依赖、执行数据库迁移并写入初始数据：

```bash
bash scripts/setup-macos.sh
npm run dev
```

首次启动后，注册账号并创建或加入实验室即可开始使用。脚本会在首次创建 `.env` 时提示你填写 `OPENAI_API_KEY`。

#### 手动初始化数据库

如果你的 PostgreSQL 已经可用，先将 `.env.example` 复制为 `.env`，再将 `DEMO_MODE` 设为 `"false"` 并填写正确的 `DATABASE_URL`，然后执行：

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

### 配置

从 `.env.example` 复制生成 `.env` 后，按需要填写以下配置：

#### 推荐配置：MiMo Token Plan

使用 MiMo Token Plan 时，在服务商提供的 OpenAI 兼容接口地址与 API 密钥之外，推荐使用以下模型和开关：

```dotenv
OPENAI_MODEL="mimo-2.5-pro"
OPENAI_VISION_MODEL="mimo-2.5"
LLM_REASONING_EFFORT="off"
REAGENT_SEARCH_ENABLED="false"
```

这组配置使用 `mimo-2.5-pro` 处理文本，`mimo-2.5` 处理图像，关闭项目的模型推理等级和联网搜索。`OPENAI_BASE_URL` 与 `OPENAI_API_KEY` 请按 MiMo Token Plan 提供的值填写。

| 配置 | 用途 |
| --- | --- |
| `DEMO_MODE` | `true` 使用演示数据；`false` 使用 PostgreSQL。 |
| `DATABASE_URL` | PostgreSQL 连接字符串。 |
| `NEXTAUTH_URL`、`NEXTAUTH_SECRET` | 登录地址与会话加密密钥。本地开发地址为 `http://localhost:3000`。 |
| `OPENAI_BASE_URL`、`OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_VISION_MODEL` | OpenAI 兼容模型服务的地址、密钥与模型名称。 |
| `LAB_LLM_CONFIG_ENCRYPTION_KEY` | 实验室公用模型 API Key 的 AES-256-GCM 加密主密钥；生产环境用 `openssl rand -base64 32` 生成且仅保存在服务器环境变量中。 |
| `REAGENT_SEARCH_*` | 联网核验所需的搜索服务配置。 |
| `LLM_ENABLED_SKILLS`、`LLM_ENABLED_MCP_SERVERS` | 启用的 Skill 与 MCP 服务。 |
| `LLM_SELF_CHECK_ENABLED`、`LLM_AUTO_LEARN_ENABLED` | 是否启用 AI 自检与自动学习写回。 |
| `LLM_REASONING_EFFORT` | 模型推理等级，可选 `off`、`low`、`medium` 或 `high`。 |
| `LLM_KNOWLEDGE_VERIFY_*` | 知识库高置信命中时跳过联网验证的开关与阈值。 |
| `HERMES_KNOWLEDGE_EXPORT_PATH` | Hermes 导出 JSONL 的路径。 |

完整的默认值和说明见 [`.env.example`](.env.example)。不要将包含真实密钥的 `.env` 提交到仓库。

#### 实验室公用模型

在数据库模式下，PI 和管理员可在“模型与联网配置”中为各自的实验室保存公用模型。模型的生效顺序是：个人 API Key、当前实验室公用模型、服务器默认模型。成员没有个人 API Key 时可直接使用本实验室的配置；一个实验室的公用模型不会影响其他实验室。

启用这项功能前，服务器必须配置 `LAB_LLM_CONFIG_ENCRYPTION_KEY`。它只保存在服务器环境变量中，用于以 AES-256-GCM 加密公用 API Key；数据库和浏览器不会获得明文。请为它生成独立的随机值，具体部署步骤见[服务器部署文档](docs/deployment-server.md)。

### 技术栈

- Next.js 16、React 19、TypeScript 5 与 Tailwind CSS 4
- Electron 40
- Prisma 6 与 PostgreSQL

### 桌面客户端

桌面端是已部署 Web 服务的客户端，需要可用的网络与 HTTPS 服务。开发和打包命令如下：

```bash
npm run desktop:dev
npm run desktop:dist:mac
npm run desktop:dist:win
```

客户端的连接范围、安全边界与发布步骤见[桌面客户端文档](docs/desktop-client.md)。

### 文档

| 文档 | 内容 |
| --- | --- |
| [系统架构](docs/architecture.md) | 前端、API、数据库、鉴权、AI 编排和知识库模块。 |
| [API 文档](docs/api.md) | 路由与请求用途。 |
| [规则设计](docs/rule-design.md) | 实验必需项、推荐项与方向规则。 |
| [桌面客户端](docs/desktop-client.md) | Electron 客户端的构建、配置与安全边界。 |
| [服务器部署](docs/deployment-server.md) | Docker、Caddy 和 Nginx 的生产部署。 |
| [Hermes 知识管家](integrations/hermes/README.md) | Hermes 的部署、定时产出与导入流程。 |
| [实验记录 skill](integrations/hermes/README.md#实验记录-skill) | 本地可追溯实验记录、结果附件、MD/DOCX 导出与飞书发布。 |
| [库存 MCP](docs/mcp-inventory.md) | 登录授权后的实验室库存检索、模型配置、货号回填边界与飞书接入路线。 |
| [Hermes 集成机制](docs/hermes-integration.md) | 项目侧的校验、写库和检索置信度机制。 |

### 生产部署

仓库提供 `Dockerfile`、`docker-compose.prod.yml` 以及 Caddy 和 Nginx 配置示例。部署前请配置 PostgreSQL、站点地址、会话密钥和模型服务。完整步骤见[服务器部署文档](docs/deployment-server.md)。

### 许可证

本项目使用 [MIT License](LICENSE)。

<p align="right"><a href="#english">English</a></p>

<a id="english"></a>

## English

Dorlabaemon brings reagent inventory, experiment rules, and laboratory membership into one workspace. Researchers can add or import reagents, confirm their fields and categories, then check whether an experiment has the materials it needs. Members work from the same inventory while data remains isolated between laboratories.

Live demo: [dorlabaemon.era.ac.cn](https://dorlabaemon.era.ac.cn)

[中文](#chinese)

### What this project solves

Preparing an experiment involves more than finding a bottle on a shelf. Researchers also need to verify the reagent name and catalog number, its suitability for the experiment, and whether the team is working from the same record. When this information is split across inventory sheets, experiment lists, and personal notes, pre-experiment checks take longer and conditions are easier to miss.

Dorlabaemon follows four steps: add, confirm, check, and collaborate. It does not replace an experimental protocol or human judgment. It keeps the inventory, rules, and collaboration details needed before an experiment in one place.

```mermaid
flowchart LR
  A["Add reagents"] --> B["Confirm fields and categories"]
  B --> C["Check experiment readiness"]
  C --> D["Collaborate in the laboratory"]
```

| Preparation issue | Dorlabaemon approach |
| --- | --- |
| Reagent records contain only a name or catalog number, making it hard to check their experimental use. | Organize reagents into structured fields and describe their use with tags for antibodies, primers, reference controls, cell culture, transfection, and selection. |
| The inventory is known, but it is unclear whether an experiment can begin. | Map inventory to required and recommended experiment items, then list fulfilled, missing, and notable conditions. |
| Team members maintain separate records while laboratories still need clear boundaries. | Share inventory within a laboratory. PIs and administrators can invite members, while laboratory data stays isolated. |

### Highlights

#### From inventory records to experiment readiness

Start by choosing a published, concrete leaf technique, searchable by its Chinese or English name, code, or alias. AI fuzzy matching is also available when needed. The system combines technique rules, optional experimental profiles, and research-topic or pathway rules. A topic appears only when it is compatible with the technique and has concrete rules, so unsupported combinations are not presented as ready to run.

Checks cover reagents, consumables, instruments, samples, controls, and software. Reagents are verified automatically against inventory and capability tags; researchers confirm the other resources. The result is explicit: ready, blocked by a required item, or awaiting confirmation. A technique without published rules or complete resource coverage can never receive a ready result.

#### AI organizes, people confirm

After a reagent name or catalog number is entered, the system can generate a structured parsing draft. Paste a table, upload a reagent-list image, or paste an image from the clipboard to turn it into editable text before batch parsing. With model and search services configured, it can also run online verification and self-checks. Each result still needs confirmation before it enters the inventory, so generated content does not become an experiment record automatically.

#### Maintainable rules and knowledge

Experiment techniques can be submitted as drafts, reviewed, and published as revisions. AI self-checks and knowledge write-backs are recorded so laboratory administrators can review and roll back changes. The optional Hermes integration researches reagent knowledge on a server at scheduled intervals, exports JSONL, and lets the project validate and import it. High-confidence knowledge-base matches can reduce online verification.

#### Experimental-record skill

The repository ships `experimental-record-writer` with the Hermes skills. A researcher can state what was actually done and used, then add image or text results. The skill creates a local record bundle with revision snapshots, a SHA-256 attachment manifest, and audit events. Table-based Markdown is the default, and DOCX export is available. After the user authorizes the official Lark/Feishu `lark-cli`, the confirmed snapshot can also become a Feishu document with its result files inserted in sequence. This workflow writes only to a user-selected local directory or Feishu. It does not automatically persist anything in this application's web database. See the [Hermes guide](integrations/hermes/README.md#实验记录-skill).

#### Inventory MCP

Signed-in users can create a revocable, expiring read-only token on the **MCP Access** page and configure `https://dorlabaemon.era.ac.cn/api/mcp` in a Streamable HTTP-capable local model or controlled agent. Every call rechecks laboratory membership. For a request such as “ran a KLF6 and β-actin WB,” the MCP can return existing primary-antibody candidates and catalog numbers; only one exact match is an inventory-derived snapshot, while multiple candidates require the researcher’s selection. Inventory is not evidence of actual use. See the [inventory MCP guide](docs/mcp-inventory.md).

#### One workspace for team collaboration

The web application uses Next.js and the desktop client uses Electron. Both use the same project codebase. The desktop client connects to a deployed service and does not run a database locally or retain server-side secrets.

### Feature overview

| Feature | Description |
| --- | --- |
| Reagent inventory | Create, edit, and delete reagent records. Filter by name, catalog number, tag, or target. Adjust quantities, delete in batches, and copy or export selected records. |
| Experiment resource checks | Select a concrete technique, experimental profile, and optional research topic or pathway. Method requirements and topic rules are checked together; reagents are verified against inventory while consumables, instruments, samples, controls, and software are confirmed by the user. |
| Knowledge maintenance | Configure Skills and MCP services. AI parsing keeps self-check records, and knowledge write-back can be enabled by laboratory policy. |
| Multi-laboratory collaboration | Members share inventory within a laboratory, while data is isolated between laboratories. PIs and administrators can invite members. |

### Quick start

#### DEMO mode, about 30 seconds

DEMO mode does not require PostgreSQL or Docker and is intended for trying the main workflow. Data is saved to `.data/demo-store.json`.

```bash
npm install
cp .env.example .env
# Set DEMO_MODE="true" in .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

#### Database mode, macOS

After Docker Desktop is installed and running, the following script starts a PostgreSQL container, creates `.env`, installs dependencies, runs database migrations, and seeds initial data.

```bash
bash scripts/setup-macos.sh
npm run dev
```

After the first start, register an account and create or join a laboratory. When the script creates `.env` for the first time, it prompts you to provide `OPENAI_API_KEY`.

#### Initialize the database manually

If PostgreSQL is already available, first copy `.env.example` to `.env`, then set `DEMO_MODE` to `"false"` and provide the correct `DATABASE_URL`, then run:

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

### Configuration

Copy `.env.example` to `.env`, then fill in the configuration you need.

#### Recommended configuration: MiMo Token Plan

When using MiMo Token Plan, use the following models and switches in addition to the OpenAI-compatible endpoint and API key provided by the service.

```dotenv
OPENAI_MODEL="mimo-2.5-pro"
OPENAI_VISION_MODEL="mimo-2.5"
LLM_REASONING_EFFORT="off"
REAGENT_SEARCH_ENABLED="false"
```

This configuration uses `mimo-2.5-pro` for text and `mimo-2.5` for images. It disables the project's model reasoning level and online search. Set `OPENAI_BASE_URL` and `OPENAI_API_KEY` to the values provided by MiMo Token Plan.

| Setting | Purpose |
| --- | --- |
| `DEMO_MODE` | Use demo data with `true`; use PostgreSQL with `false`. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | The sign-in URL and session encryption secret. The local development URL is `http://localhost:3000`. |
| `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_VISION_MODEL` | Endpoint, key, and model names for an OpenAI-compatible model service. |
| `LAB_LLM_CONFIG_ENCRYPTION_KEY` | AES-256-GCM root key for laboratory shared-model API keys; generate it with `openssl rand -base64 32` and keep it only in the production environment. |
| `REAGENT_SEARCH_*` | Search-service settings for online verification. |
| `LLM_ENABLED_SKILLS`, `LLM_ENABLED_MCP_SERVERS` | Enabled Skills and MCP services. |
| `LLM_SELF_CHECK_ENABLED`, `LLM_AUTO_LEARN_ENABLED` | Whether to enable AI self-checks and automatic learning write-back. |
| `LLM_REASONING_EFFORT` | Model reasoning level: `off`, `low`, `medium`, or `high`. |
| `LLM_KNOWLEDGE_VERIFY_*` | The switch and threshold for skipping online verification on high-confidence knowledge-base matches. |
| `HERMES_KNOWLEDGE_EXPORT_PATH` | Path to Hermes-exported JSONL. |

See [`.env.example`](.env.example) for complete defaults and notes. Do not commit an `.env` file that contains real keys.

#### Laboratory shared models

In database mode, PIs and administrators can save a shared model for their laboratory in **Model & Online Configuration**. Configuration takes effect in this order: a personal API key, the current laboratory's shared model, then the server default. Members without a personal API key can use their laboratory's configuration directly, and a shared model never affects another laboratory.

Before enabling this feature, configure `LAB_LLM_CONFIG_ENCRYPTION_KEY` on the server. It stays only in the server environment and encrypts shared API keys with AES-256-GCM; neither the database nor the browser receives plaintext. Generate a separate random value for it and follow the [server deployment guide](docs/deployment-server.md) for the deployment steps.

### Tech stack

- Next.js 16, React 19, TypeScript 5, and Tailwind CSS 4
- Electron 40
- Prisma 6 and PostgreSQL

### Desktop client

The desktop application is a client for a deployed web service and requires network access and an HTTPS service. Use these commands for development and packaging:

```bash
npm run desktop:dev
npm run desktop:dist:mac
npm run desktop:dist:win
```

See the [desktop client guide](docs/desktop-client.md) for connection scope, security boundaries, and release steps.

### Documentation

| Document | Contents |
| --- | --- |
| [Architecture](docs/architecture.md) | Frontend, API, database, authentication, AI orchestration, and knowledge-base modules. |
| [API](docs/api.md) | Routes and their request purposes. |
| [Rule design](docs/rule-design.md) | Required items, recommended items, and research-direction rules. |
| [Desktop client](docs/desktop-client.md) | Build, configuration, and security boundaries for the Electron client. |
| [Server deployment](docs/deployment-server.md) | Production deployment with Docker, Caddy, and Nginx. |
| [Hermes knowledge steward](integrations/hermes/README.md) | Hermes setup, scheduled output, and import workflow. |
| [Experimental-record skill](integrations/hermes/README.md#实验记录-skill) | Traceable local records, result attachments, MD/DOCX export, and Feishu publishing. |
| [Inventory MCP](docs/mcp-inventory.md) | Signed-in inventory retrieval, model setup, catalog-number enrichment, and the Feishu integration boundary. |
| [Hermes integration](docs/hermes-integration.md) | Project-side validation, persistence, and retrieval-confidence behavior. |

### Production deployment

The repository provides a `Dockerfile`, `docker-compose.prod.yml`, and example Caddy and Nginx configuration. Before deployment, configure PostgreSQL, the site URL, the session secret, and the model service. See the [server deployment guide](docs/deployment-server.md) for the full procedure.

### License

This project is licensed under the [MIT License](LICENSE).

<p align="right"><a href="#chinese">中文</a></p>
