# API

- `POST /api/reagents/parse`: 输入试剂基础信息，返回 LLM 解析草稿
- `POST /api/reagents/confirm`: 确认草稿并入库
- `GET /api/reagents/list?labId=...`: 获取实验室试剂列表
- `POST /api/reagents/create`: 手动新建试剂记录（同名货号冲突返回 `CATALOG_NO_EXISTS`）
- `PATCH /api/reagents/[reagentId]`: 编辑试剂全部字段（含抗体/引物元数据，随类别切换自动清理）
- `DELETE /api/reagents/[reagentId]`: 删除单条试剂记录
- `POST /api/reagents/adjust-quantity`: 按增量增减库存（`delta` 非零，库存下限为 0）
- `POST /api/reagents/batch-delete`: 按 id 列表批量删除当前实验室试剂
- `GET /api/experiment-techniques?labId=...&page=...&pageSize=...`: 分页获取已发布实验技术目录摘要
- `GET /api/experiment-techniques/[code]`: 获取单个已发布实验技术详情
- `POST /api/experiment-techniques/resolve`: 输入实验名称/别名，返回精确自动匹配或待人工选择的候选
- `POST /api/experiment-techniques/ai-match`: 输入模糊实验名称，调用大模型按规则从已发布目录中返回一个或多个候选（含置信度与理由，幻觉 code 自动过滤）；未配置 LLM 时返回 `LLM_NOT_CONFIGURED`
- `POST /api/experiment-checks`: 对指定技术（可选 profile）执行库存就绪检查
- `GET/POST /api/experiment-techniques/drafts`: 查询或创建实验室级技术草稿
- `POST /api/experiment-techniques/drafts/[draftId]/submit`: 提交草稿进入审核
- `POST /api/experiment-techniques/drafts/[draftId]/review`: PI/ADMIN 审核草稿（通过或驳回）
- `POST /api/experiment-techniques/drafts/[draftId]/publish`: 发布已通过审核的草稿为不可变修订
- `POST /api/experiment-techniques/[code]/rollback`: 将技术回滚到历史修订（生成新修订，PI/ADMIN）
- `POST /api/labs/invite`: 邀请成员加入实验室
- `GET /api/labs/my`: 获取当前用户可访问实验室
- `GET/POST /api/settings/llm`: 读取或保存用户级模型、搜索、skill、MCP、自检与自动学习配置
- `POST /api/settings/llm/test`: 测试模型、搜索、skill registry 与 MCP 注册状态
- `GET/POST /api/settings/ai-policy`: 读取或保存实验室级 AI 写回策略
- `GET/POST/DELETE /api/mcp/tokens`: 已登录用户列出、创建或撤销其只读库存 MCP 个人访问令牌；明文令牌只在创建响应中出现一次
- `POST /api/mcp`: 使用 `Authorization: Bearer <personal-token>` 的只读 Streamable HTTP MCP；提供实验室列表、试剂检索与 WB 一抗候选解析，且每次调用重新检查实验室成员权限
- `GET /api/knowledge/logs?labId=...`: 查询知识变更日志
- `POST /api/knowledge/rollback`: 回滚某条知识变更日志
- 仪表盘页面 `/knowledge`：调用上述接口展示知识审计记录、前后内容摘要与回滚操作

## Runtime Knowledge

- 正式运行时知识现优先来自数据库表：
  - `ReagentKnowledgeEntry`
  - `ExperimentKnowledgeEntry`
- `prisma/seed.ts` 会把现有静态 JSON 基线导入这些表。
- 当自动学习写回通过权限、自检和风险校验后，新条目会先写入上述表，再记录到 `KnowledgeMutationLog`。

## Reagent Parse Output

- `experimentTags`: 标准化实验用途标签，例如 `WB_LYSIS_BUFFER`、`QPCR_MASTER_MIX`、`FIXATIVE`
- 标签已扩展覆盖常见实验环节，例如细胞培养、筛选抗生素、转染/转导、蛋白定量、WB 转膜膜材、ELISA、流式、外泌体分离等
- `antibodyMeta`: 抗体角色、宿主、识别种属、靶点
- `primerMeta`: 引物靶点与是否为内参引物
- `ai`: 运行时 skill/MCP、自检结果与自动学习日志摘要

## Experiment Technique Resolve Output

- `autoSelectedCode`: 精确命中 code/名称/别名时自动选定的技术代码，否则为 `null`
- `candidates`: 候选技术摘要列表（模糊命中总是需要人工选择）
- `requiresHumanSelection`: 是否存在多个精确候选需要人工确认

## Experiment Check Output

- `status`: `READY`、`BLOCKED`、`NEEDS_CONFIRMATION` 或 `UNSUPPORTED`
  - `READY`：所有必需资源均已自动匹配或人工确认
  - `BLOCKED`：存在缺失的可自动校验必需试剂
  - `NEEDS_CONFIRMATION`：必需或条件资源仍需人工确认
  - `UNSUPPORTED`：技术未发布、为导航族节点、资源维度不完整或需求模型为空
- `items`: 逐项资源核查结果（`MATCHED`/`MISSING`/`CONFIRMED`/`UNCONFIRMED`/`NOT_APPLICABLE`）
- `reasons`: 状态判定理由
