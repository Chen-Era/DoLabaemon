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
  <a href="#docker-模式完整数据库--ai"><img src="https://img.shields.io/badge/docker-quick_start-2496ED?logo=docker" alt="Docker" /></a>
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
| 🔬 **专业方向规则** | 内置自噬、外泌体等研究方向的专属判定链 |
| 🔄 **AI 自检与持续学习** | 可配置的 Skill / MCP 链路，解析结果附带自检日志，支持自动学习写回知识库 |
| 🧠 **Hermes 知识管家** | 可选集成开源 Hermes Agent 作为异步知识管家：服务器上定时研究试剂、离线产出知识 JSONL，校验导入后检索置信度更高、联网验证更少 |
| 🖥️ **桌面端 + Web 端** | 基于 Electron 的原生桌面客户端 + Next.js Web 应用，一套代码双端运行 |
| 👥 **多实验室权限隔离** | 实验室内共享库存，实验室间数据严格隔离，PI/Admin 可邀请成员 |
| ⚡ **DEMO 模式 30 秒启动** | 无需 PostgreSQL/Docker，一个环境变量即可体验核心功能 |
| 📦 **Docker 一键部署** | 提供完整 Docker Compose 生产部署方案，含 Caddy/Nginx 反代配置 |
| 🎯 **批量操作** | 多选试剂一键导出剪贴板，按名称/货号/标签/靶点灵活筛选 |

### 🌐 在线体验

> 已部署在线服务器：**[dorlabaemon.era.ac.cn](https://dorlabaemon.era.ac.cn)**

## 🚀 快速开始

### DEMO 模式（推荐，30 秒启动）

无需 PostgreSQL / Docker，一个环境变量即可体验：

```bash
npm install
cp .env.example .env
# 编辑 .env → DEMO_MODE="true"
npm run dev
```

访问 `http://localhost:3000`。数据保存在 `.data/demo-store.json`。

### Docker 模式（完整数据库 + AI）

```bash
bash scripts/setup-macos.sh
npm run dev
```

脚本自动完成：启动 PostgreSQL 容器 → 生成 .env → 安装依赖 → 数据库迁移 + seed。首次启动后注册登录即可。

### 手动启动

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

## ⚙️ 环境变量

| 变量 | 说明 |
|------|------|
| `DEMO_MODE` | `true` 演示模式 / `false` 数据库模式 |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `NEXTAUTH_URL` | 本地 `http://localhost:3000` |
| `NEXTAUTH_SECRET` | NextAuth 加密密钥 |
| `OPENAI_BASE_URL` | *(可选)* OpenAI 兼容接口地址 |
| `OPENAI_API_KEY` | *(可选)* API 密钥 |
| `OPENAI_MODEL` | *(可选)* 文本模型名称 |

> 完整配置项见 `.env.example`

## 🖥️ 桌面客户端

```bash
npm run desktop:dev         # 开发模式启动
npm run desktop:dist:mac    # 打包 macOS 应用
npm run desktop:dist:win    # 打包 Windows 应用
```

详见 [docs/desktop-client.md](docs/desktop-client.md)

## 📁 文档

| 文档 | 说明 |
|------|------|
| [系统架构](docs/architecture.md) | 整体系统架构与模块设计 |
| [API 文档](docs/api.md) | 后端 API 接口说明 |
| [桌面客户端](docs/desktop-client.md) | Electron 桌面端构建与配置 |
| [服务器部署](docs/deployment-server.md) | Docker / Caddy / Nginx 生产部署 |
| [规则设计](docs/rule-design.md) | 实验判定规则引擎设计 |
| [Hermes 知识管家](integrations/hermes/README.md) | Hermes Agent 异步知识集成：部署、定时产出与导入上手 |
| [Hermes 集成机制](docs/hermes-integration.md) | 项目侧知识流转、校验门与置信度关系 |

## 🚢 生产部署

提供 `Dockerfile`、`docker-compose.prod.yml`、Caddy/Nginx 反代配置，详见 [docs/deployment-server.md](docs/deployment-server.md)。
