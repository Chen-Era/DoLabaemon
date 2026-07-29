# Hermes Agent 知识管家集成

[Hermes Agent](https://github.com/NousResearch/hermes-agent) 是 NousResearch 开源的自改进 agent。它可以按定时任务在服务器上研究试剂，并产出结构化的试剂知识 JSONL。项目脚本校验后，会把这些数据导入本地试剂知识库（`ReagentKnowledgeEntry` 表）。更完整的知识库通常能提高检索置信度，减少联网验证。

## 架构

```text
┌────────────────────── 服务器（异步，定时） ──────────────────────┐
│  Hermes Agent                                                    │
│    cron/routine 定时触发                                         │
│      ├─ skills/reagent-curator → 研究→核对→产出知识条目           │
│      └─ skills/reagent-parser  → 离线批量解析（可选，中间产物）   │
│           │ 追加写入（每行一个 JSON 对象）                        │
│           ▼                                                      │
│    导出目录 integrations/hermes/output/knowledge.jsonl           │
└───────────────────────────┬──────────────────────────────────────┘
                            │  rsync / scp / 共享盘 / 对象存储
┌───────────────────────────▼────────── 项目主机 ──────────────────┐
│  npm run knowledge:hermes-sync                                   │
│    ① src/lib/reagent-knowledge/hermes-import.ts                  │
│       zod 校验（真实枚举 / 置信度 0-1 / 正则逐条试编译 / id 前缀）│
│    ② upsertRuntimeReagentKnowledgeEntry 按 id upsert 写库        │
│           ▼                                                      │
│  ReagentKnowledgeEntry 表 ──→ 运行时检索（runtime.ts）            │
│    检索置信度↑ → 自检/解析流程更少依赖联网验证，响应更快          │
└──────────────────────────────────────────────────────────────────┘

要点：Hermes 与项目之间只有"文件"这一个接口，没有任何同步调用。
```

## 为什么是异步知识管家，而不是同步识别接口

1. **延迟**：识别是用户等待的在线路径，调用外部 agent 会把秒级甚至分钟级的等待塞进请求里；异步产出把研究成本挪到离线时段。
2. **可靠性**：同步调用把 Hermes 的可用性、网络、配额变成主流程的单点故障；文件接口下，Hermes 宕机只是"知识库不更新"，识别照常运行。
3. **质量**：研究型产出需要多轮检索和核对，适合离线处理。产出后还要经过项目侧的枚举、正则和置信度校验，不合格的行会被拒绝。
4. **幂等可重放**：JSONL 是纯数据文件，可审查、可 diff、可重复导入（按 `id` upsert），出问题时回滚比重跑 agent 简单。

## 三步上手

### 第 1 步：服务器上部署 Hermes 与 skills

```bash
bash integrations/hermes/setup-server.sh
```

脚本会用官方安装器装 Hermes、把 `skills/` 下的全部技能拷到 `~/.hermes/skills/`、创建导出目录，并打印建议的 routine 文本。

### 第 2 步：让 Hermes 定时产出 JSONL

按脚本末尾打印的指引创建定时任务（核心形态如下，具体参数以 `hermes cron create --help` 与官方文档为准）：

```bash
hermes cron create "0 3 * * *" \
  "使用 reagent-curator 技能研究 3~5 种本实验室常用试剂……通过核对的条目追加写入 <导出目录>/knowledge.jsonl（每行一个 JSON 对象，禁止 markdown 包裹）。不确定的宁可不产出。" \
  --name "reagent-knowledge-curator" \
  --skills "reagent-curator"
```

用 `hermes cron list` / `hermes cron run <ID>` 确认任务存在并能跑通。

### 第 3 步：项目侧校验导入

把 `knowledge.jsonl` 弄回项目主机（rsync/scp/共享盘均可），然后在项目根目录运行：

```bash
npm run knowledge:hermes-sync                       # 默认读 integrations/hermes/output/knowledge.jsonl
HERMES_KNOWLEDGE_EXPORT_PATH=/data/knowledge.jsonl npm run knowledge:hermes-sync
npm run knowledge:hermes-sync -- --file /data/knowledge.jsonl --strict
```

输出形如 `Hermes 知识同步完成：导入 N 条，拒绝 M 条`；`--strict` 下有拒绝行时退出码为 1（适合 CI/定时任务告警）。`--file` 优先级高于 `HERMES_KNOWLEDGE_EXPORT_PATH`，高于默认路径。

## 两个 skill 的分工

| skill | 作用 | 输出 |
|-------|------|------|
| `skills/reagent-curator` | 试剂知识管理员：研究→核对→产出知识条目 | 知识条目 JSONL，契约对齐 `ReagentKnowledgeEntry`，**会**被项目导入 |
| `skills/reagent-parser` | 离线结构化解析器：批量试剂文本 → 解析结果 | 解析结果 JSONL，契约对齐 `reagentParsedSchema`，**不会**被项目主流程消费，只作离线整理与 curator 的中间产物 |

细节分别见两个目录下的 `SKILL.md`；`reagent-curator/reference/taxonomy.md` 是从项目内置知识库摘出的分类速查。

## 定时同步建议

项目主机上用 crontab 定时拉取并导入（示例：每小时一次，拒绝行即告警）：

```cron
0 * * * * cd /opt/lab-reagent-system && rsync -az hermes-server:/path/to/knowledge.jsonl integrations/hermes/output/knowledge.jsonl && /usr/bin/npm run knowledge:hermes-sync -- --strict >> /var/log/hermes-sync.log 2>&1
```

Hermes 侧产出频率与项目侧导入频率不需要一致：文件是追加式，重复导入幂等。

## 已确认事实与假设（透明度说明）

以下来自 hermes-agent 官方仓库（2026-07 拉取的 README、`hermes-already-has-routines.md`、CLI 参考与源码）：

- 官方安装器：`curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`。
- skills 目录约定：`get_skills_dir() = HERMES_HOME/skills`（默认 `~/.hermes/skills/`，支持 `HERMES_HOME` 环境变量覆盖）；自定义 skill 放入即加载。
- cron/routine：`hermes cron create <SCHED> "<prompt>" --name ... --skills "a,b"`；SCHED 支持 cron 表达式、`every 2h` 等自然间隔、ISO 时间戳；管理子命令 `list/edit/pause/resume/run/remove/status`。
- skill 格式：`目录 + SKILL.md`，YAML frontmatter 至少含 `name`/`description`（agentskills.io 开放标准）。

假设/未逐字确认：

- `--deliver local` 的确切落盘路径未在文档中写明，因此本集成让 agent 在 prompt 里显式写文件，不依赖 deliver 行为。
- `hermes cron create` 的其余选项未逐一核对，脚本与文档均标注"以 `hermes --help` / 官方文档为准"。

## 故障排查

| 症状 | 排查 |
|------|------|
| `hermes` 命令找不到 | 重开终端，或把 `~/.local/bin` 加入 `PATH` 后重跑 setup 脚本（幂等） |
| agent 没有产出/产出位置不对 | `hermes cron list` 看任务状态，`hermes cron run <ID>` 手动触发；检查 routine 文本中的目标文件路径是否为绝对路径、agent 是否有写权限 |
| 同步脚本报"读取失败" | 确认文件已传回项目主机；用 `--file` 或 `HERMES_KNOWLEDGE_EXPORT_PATH` 显式指定 |
| 大量行被拒绝 | 逐条看 stderr 的"第 N 行被拒绝"原因；常见为枚举外值、正则无法编译、aliases 为空、JSON 被 markdown 包裹 |
| 导入后检索没变化 | 运行时知识表非空时优先于静态 catalog；确认导入的是目标环境（`DEMO_MODE`/数据库）一致的库 |

更偏项目侧机制（校验门、写库路径、置信度关系）见 [docs/hermes-integration.md](../../docs/hermes-integration.md)。
