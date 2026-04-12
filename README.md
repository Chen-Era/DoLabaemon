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
- 权限隔离：实验室内共享，实验室间数据隔离；PI/Admin 可邀请成员。

## 一键启动（新用户推荐）

```bash
cd "/Users/era/Desktop/文件夹/开发/lab-reagent-system"
bash scripts/setup-macos.sh
npm run dev
```

访问 `http://localhost:3000`，先注册再登录。

## 手动启动（进阶）

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

## 无数据库演示模式（最简单）

如果你只想先演示功能，不想安装数据库：

```bash
cd "/Users/era/Desktop/文件夹/开发/lab-reagent-system"
cp .env.example .env
```

把 `.env` 改成：

```env
DEMO_MODE="true"
```

然后直接：

```bash
npm install
npm run dev
```

说明：
- 演示模式下不需要 PostgreSQL，不依赖注册登录。
- 可直接访问 `/labs`、`/reagents/new`、`/experiment-check` 体验完整流程。
- 生产环境请关闭 `DEMO_MODE` 并配置真实数据库。

## Docker 常见问题

- 报错 `Cannot connect to the Docker daemon ... docker.sock`：
- 说明 Docker Desktop 没启动，不是项目代码问题。
- 先执行 `open -a Docker`，等 Docker 完全启动后重试。
- 若首次使用脚本，它会自动帮你检测并提示下一步。

## 本地数据库替代方案（不用 Docker）

- 如果你不想用 Docker，可以安装本机 PostgreSQL（例如 Homebrew）。
- 安装后保证 `DATABASE_URL` 指向可用数据库，再执行：

```bash
npx prisma migrate dev --name init
npm run db:seed
```

## 环境变量

- `DATABASE_URL`：PostgreSQL 连接串
- `OPENAI_BASE_URL`：OpenAI 兼容接口地址（可用 Minimax）
- `OPENAI_API_KEY`：模型密钥（不要提交到 GitHub）
- `OPENAI_MODEL`：模型名称
- `OPENAI_VISION_MODEL`：图片转文字专用视觉模型；若留空则回退到 `OPENAI_MODEL`
- `REAGENT_SEARCH_ENABLED`：是否启用试剂联网检索纠错；设为 `false` 时只保留本地知识库 + LLM
- `REAGENT_SEARCH_PROVIDER`：外部搜索提供方，当前支持 `tavily` 和 `serper`
- `REAGENT_SEARCH_API_KEY`：外部搜索 API 密钥
- `REAGENT_SEARCH_BASE_URL`：可选，自定义搜索 API 地址
- `NEXTAUTH_URL`、`NEXTAUTH_SECRET`：认证配置

### 试剂联网纠错

- 单条与批量试剂解析现在都采用两阶段流程：先产出结构化初稿，再进行联网核验和纠错。
- 若当前模型提供方支持原生 web search，会优先走模型原生工具。
- 若当前 `OPENAI_BASE_URL` 对应的兼容接口不支持原生工具，则自动退回到外部搜索 API + 页面抓取。
- 前端仅展示“已联网核验 / 未联网核验”状态，不直接展示来源 URL。
