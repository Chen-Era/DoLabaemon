# Hermes 知识管家集成（项目侧机制）

> 部署与上手步骤见 [integrations/hermes/README.md](../integrations/hermes/README.md)；本文只讲项目侧的知识流转与置信度机制。

## 知识流转

```text
Hermes 服务器（定时研究）
  └─ knowledge.jsonl（每行一个 JSON 对象）
        │  rsync / scp / 共享盘
        ▼
scripts/hermes-knowledge-sync.ts（npm run knowledge:hermes-sync）
  └─ src/lib/reagent-knowledge/hermes-import.ts
       importHermesKnowledge()：逐行 zod 校验 + 正则试编译 + id 规范化
        │  合法行
        ▼
upsertRuntimeReagentKnowledgeEntry()（src/lib/knowledge/runtime-store.ts）
        │  按 id upsert
        ▼
ReagentKnowledgeEntry 表（DEMO 模式写 demo-store）
        │
        ▼
retrieveReagentKnowledgeRuntime()（src/lib/reagent-knowledge/runtime.ts）
  运行时表非空 → 用运行时表检索；为空 → 回退静态 catalog.json
```

要点：

- Hermes 与项目之间只有文件接口，项目**从不**同步调用 Hermes。
- 导入按行独立：合法行入库，坏行只记录行号与原因，不阻塞整批。
- 重复导入幂等：按 `id` upsert；Hermes 条目统一 `hermes-` 前缀（缺失时导入器规范化后补上），与内置条目（无前缀）和学习条目（`reagent-` 前缀）天然区分。

## 校验门（hermes-import.ts）

每行依次过五道闸，任何一道失败即拒收（`{ line, error }`）：

1. 非空行 + 合法 JSON（空行与文件末尾换行直接跳过，不计拒绝）。
2. zod schema：`category` 必须命中 `reagentCategoryValues`（8 值）；`experimentTags` 必须全部命中 `rules/catalog.ts` 的 62 个枚举；`evidenceType` 仅 `exact_alias` / `pattern` / `keyword_family`；`confidenceHint` 在 0~1；`aliases` 至少 1 个。
3. `namePatterns` 逐条 `new RegExp` 试编译，非法正则拒收（保护运行时检索不被坏模式炸掉）。
4. `id` 规范化：小写 slug 化并强制 `hermes-` 前缀；规范化后为空则拒收。
5. 通过后映射为 `ReagentKnowledgeEntry`（`subCategory` 缺省置 `null`）。

## 写库路径

- `DEMO_MODE=true`：`upsertRuntimeReagentKnowledgeEntry` 写入 demo-store JSON 文件（可用 `LAB_REAGENT_DEMO_STORE_PATH` 指定）。
- 数据库模式：写入 `ReagentKnowledgeEntry` 表；脚本直接复用 `@/lib/prisma`（`@prisma/client` 自动读取 `.env` 的 `DATABASE_URL`），不依赖 Next 运行时。更新已有条目时 `source` 置为 `LEARNED`。

## 与"跳过联网验证"的关系

打分规则（`src/lib/reagent-knowledge/scoring.ts`）：精确别名 +100、别名被包含 +45、正则命中 +30、必需关键词 +12、排除关键词 -80。检索置信度 = `min(最高分 / 100, 0.98)`（`retrieval.ts` / `runtime.ts`）。

下游如何使用这个置信度：

- 试剂解析短路：`retrievalConfidence ≥ LLM_KNOWLEDGE_VERIFY_THRESHOLD`（默认 0.9，且"知识库高置信时跳过联网验证"开关开启）时，解析流程在初稿后直接按"知识库核验"定稿，跳过联网搜索与二次模型验证（`src/lib/reagent-ingest/parse-reagent.ts`）。
- 自检评分：`retrievalConfidence ≥ 0.75` 时自检加 0.45 分（`src/lib/mcp/servers/self-check-server.ts`）。
- 实验归一：`retrievalConfidence ≥ 0.82` 时直接采用知识匹配短路（`src/lib/experiment/resolve.ts`）。
- 兜底解析：有命中条目时解析置信度至少 0.86（`src/lib/reagent-tagging.ts`）。

因此 Hermes 条目的别名质量是命门：一条覆盖中英文别名与货号写法的条目，一次精确别名命中即可把检索置信度顶到 0.98，让主流程在多数情况下无需再依赖联网核验；反之只有学名的条目几乎不起作用。这也是 curator skill 把"别名覆盖"列为质量红线的原因。

## reagent-parser skill 的位置

`integrations/hermes/skills/reagent-parser` 的输出契约对齐 `src/lib/llm/schemas.ts` 的 `reagentParsedSchema`（category / subCategory / vendor / confidence / warnings / experimentTags / antibodyMeta / primerMeta），但**项目主流程不消费它**：它只用于 Hermes 侧离线批量解析（如整理库存清单）以及作为 `reagent-curator` 研究前的结构化中间产物。项目侧没有任何导入该输出的脚本，如需消费请人工审阅后转交 curator 流程。

## 运维命令速查

```bash
npm run knowledge:hermes-sync                                # 默认路径导入
npm run knowledge:hermes-sync -- --file /path/x.jsonl        # 指定文件
npm run knowledge:hermes-sync -- --strict                    # 有拒绝行则退出码 1
LAB_REAGENT_DEMO_STORE_PATH=/tmp/t.json node --test --import tsx "src/lib/reagent-knowledge/hermes-import.test.ts"
```

## 相关文件

- `src/lib/reagent-knowledge/hermes-import.ts`：校验与导入纯函数。
- `src/lib/reagent-knowledge/hermes-import.test.ts`：单测（含样例文件回归）。
- `scripts/hermes-knowledge-sync.ts`：导入薄壳脚本。
- `integrations/hermes/skills/`：Hermes 侧两个 skill。
- `integrations/hermes/output/sample-knowledge.jsonl`：合法样例（被单测覆盖）。
