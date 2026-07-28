<p align="center">
  <img src="./logo.png" alt="Dorlabaemon" width="420" />
</p>

<h1 align="center">Dorlabaemon</h1>

<p align="center">面向科研实验室的试剂库存管理与实验可行性判断系统</p>

<p align="center">
  <a href="https://github.com/Chen-Era/DoLabaemon/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Chen-Era/DoLabaemon?color=blue" alt="MIT License" /></a>
  <a href="https://github.com/Chen-Era/DoLabaemon/releases"><img src="https://img.shields.io/github/v/release/Chen-Era/DoLabaemon?include_prereleases&color=green" alt="Release" /></a>
  <a href="https://dorlabaemon.era.ac.cn"><img src="https://img.shields.io/badge/demo-live-ff69b4" alt="Live demo" /></a>
</p>

Dorlabaemon 把试剂库存、实验规则和实验室成员权限放在同一个工作区中。研究人员可以录入或导入试剂，确认字段和分类，再检查某项实验所需的材料是否齐备。团队成员查看的是同一份库存，实验室之间的数据保持隔离。

在线体验：[dorlabaemon.era.ac.cn](https://dorlabaemon.era.ac.cn)

## 项目要解决什么问题

实验准备不只是确认货架上有没有一瓶试剂。还要核对名称和货号是否准确，它是否符合当前实验的用途，以及团队成员是否在查看同一份记录。把这些信息分别放在库存表、实验清单和个人记录里，会让实验前的确认变得费时，也容易遗漏条件。

Dorlabaemon 的工作流程是“录入、确认、检查、协作”。它不替代实验方案或人工判断，而是把准备实验时需要核对的库存、规则和协作信息集中起来。

```mermaid
flowchart LR
  A["录入试剂"] --> B["确认字段与分类"]
  B --> C["检查实验条件"]
  C --> D["在实验室内协作"]
```

| 实验准备中的问题 | Dorlabaemon 的做法 |
| --- | --- |
| 试剂记录只有名称或货号，难以按实验用途核对 | 将试剂整理为结构化字段，并用抗体、引物、内参、细胞培养、转染和筛选等标签描述用途。 |
| 知道库存里有什么，却不清楚能否开始一项实验 | 将库存映射到实验的必需项和推荐项，列出已满足、待补充和需要注意的条件。 |
| 团队成员各自维护记录，实验室之间又需要边界 | 以实验室为单位共享库存；PI 和管理员可邀请成员，实验室数据相互隔离。 |

## 项目亮点

### 从库存记录走到实验条件

系统不仅保存库存数量，也会根据试剂标签、抗体靶点和引物信息检查实验要求。当前规则覆盖 WB、qPCR、IF、ELISA 和 FLOW，也包含自噬与外泌体的相关判断。

### AI 负责整理，人负责确认

填写试剂名称或货号后，系统可以生成结构化解析草稿。配置模型和搜索服务后，还可进行联网核验与自检。解析结果在入库前仍需确认，避免把自动生成的内容直接当作实验记录。

### 规则与知识可以维护

实验技术可作为草稿提交、审核并发布为修订版本。AI 自检和知识写回会留下记录，实验室管理员可以查看并回滚变更。可选的 Hermes 集成会在服务器上定时整理试剂知识，导出 JSONL 后由项目校验并导入。高置信度的知识库命中可以减少联网核验。

### 一套工作区服务团队协作

Web 应用使用 Next.js，桌面端使用 Electron，两端共享一个项目代码库。桌面端连接已部署的服务，不在本地运行数据库或保存服务端密钥。

## 功能一览

| 功能 | 说明 |
| --- | --- |
| 试剂库存 | 新建、编辑和删除试剂记录；按名称、货号、标签或靶点筛选；支持库存增减、批量删除和复制导出。 |
| 实验可行性判断 | 根据库存检查实验的必需项与推荐项，并说明缺失的材料。 |
| 知识维护 | 可配置 Skill 与 MCP 服务；AI 解析会保留自检记录，并可按实验室策略启用知识自动写回。 |
| 多实验室协作 | 实验室内成员共享库存；实验室之间的数据相互隔离。PI 和管理员可以邀请成员。 |

## 快速开始

### DEMO 模式（约 30 秒）

DEMO 模式不需要 PostgreSQL 或 Docker，适合先体验主要流程。数据会保存到 `.data/demo-store.json`。

```bash
npm install
cp .env.example .env
# 将 .env 中的 DEMO_MODE 改为 "true"
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

### 数据库模式（macOS）

安装并启动 Docker Desktop 后，下面的脚本会启动 PostgreSQL 容器、创建 `.env`、安装依赖、执行数据库迁移并写入初始数据：

```bash
bash scripts/setup-macos.sh
npm run dev
```

首次启动后，注册账号并创建或加入实验室即可开始使用。脚本会在首次创建 `.env` 时提示你填写 `OPENAI_API_KEY`。

### 手动初始化数据库

如果你的 PostgreSQL 已经可用，先将 `.env` 中的 `DEMO_MODE` 设为 `"false"`，并填写正确的 `DATABASE_URL`，然后执行：

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

## 配置

从 `.env.example` 复制生成 `.env` 后，按需要填写以下配置：

| 配置 | 用途 |
| --- | --- |
| `DEMO_MODE` | `true` 使用演示数据；`false` 使用 PostgreSQL。 |
| `DATABASE_URL` | PostgreSQL 连接字符串。 |
| `NEXTAUTH_URL`、`NEXTAUTH_SECRET` | 登录地址与会话加密密钥。本地开发地址为 `http://localhost:3000`。 |
| `OPENAI_BASE_URL`、`OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_VISION_MODEL` | OpenAI 兼容模型服务的地址、密钥与模型名称。 |
| `REAGENT_SEARCH_*` | 联网核验所需的搜索服务配置。 |
| `LLM_ENABLED_SKILLS`、`LLM_ENABLED_MCP_SERVERS` | 启用的 Skill 与 MCP 服务。 |
| `LLM_SELF_CHECK_ENABLED`、`LLM_AUTO_LEARN_ENABLED` | 是否启用 AI 自检与自动学习写回。 |
| `LLM_REASONING_EFFORT` | 模型推理等级，可选 `off`、`low`、`medium` 或 `high`。 |
| `LLM_KNOWLEDGE_VERIFY_*` | 知识库高置信命中时跳过联网验证的开关与阈值。 |
| `HERMES_KNOWLEDGE_EXPORT_PATH` | Hermes 导出 JSONL 的路径。 |

完整的默认值和说明见 [`.env.example`](.env.example)。不要将包含真实密钥的 `.env` 提交到仓库。

## 技术栈

- Next.js 16、React 19、TypeScript 5 与 Tailwind CSS 4
- Electron 40
- Prisma 6 与 PostgreSQL

## 桌面客户端

桌面端是已部署 Web 服务的客户端，需要可用的网络与 HTTPS 服务。开发和打包命令如下：

```bash
npm run desktop:dev
npm run desktop:dist:mac
npm run desktop:dist:win
```

客户端的连接范围、安全边界与发布步骤见[桌面客户端文档](docs/desktop-client.md)。

## 文档

| 文档 | 内容 |
| --- | --- |
| [系统架构](docs/architecture.md) | 前端、API、数据库、鉴权、AI 编排和知识库模块。 |
| [API 文档](docs/api.md) | 路由与请求用途。 |
| [规则设计](docs/rule-design.md) | 实验必需项、推荐项与方向规则。 |
| [桌面客户端](docs/desktop-client.md) | Electron 客户端的构建、配置与安全边界。 |
| [服务器部署](docs/deployment-server.md) | Docker、Caddy 和 Nginx 的生产部署。 |
| [Hermes 知识管家](integrations/hermes/README.md) | Hermes 的部署、定时产出与导入流程。 |
| [Hermes 集成机制](docs/hermes-integration.md) | 项目侧的校验、写库和检索置信度机制。 |

## 生产部署

仓库提供 `Dockerfile`、`docker-compose.prod.yml` 以及 Caddy 和 Nginx 配置示例。部署前请配置 PostgreSQL、站点地址、会话密钥和模型服务。完整步骤见[服务器部署文档](docs/deployment-server.md)。

## 许可证

本项目使用 [MIT License](LICENSE)。
