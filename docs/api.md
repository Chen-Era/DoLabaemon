# API

- `POST /api/reagents/parse`: 输入试剂基础信息，返回 LLM 解析草稿
- `POST /api/reagents/confirm`: 确认草稿并入库
- `GET /api/reagents/list?labId=...`: 获取实验室试剂列表
- `POST /api/experiment/resolve`: 手动输入实验名称，返回已匹配类型或候选实验模板
- `POST /api/experiment/check`: 返回最低缺失、推荐缺失、兼容性风险
- `POST /api/experiment/confirm`: 确认一个模型生成的实验解析草稿
- `POST /api/labs/invite`: 邀请成员加入实验室
- `GET /api/labs/my`: 获取当前用户可访问实验室
- `GET/POST /api/settings/llm`: 读取或保存用户级模型、搜索、skill、MCP、自检与自动学习配置
- `POST /api/settings/llm/test`: 测试模型、搜索、skill registry 与 MCP 注册状态
- `GET/POST /api/settings/ai-policy`: 读取或保存实验室级 AI 写回策略
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

## Experiment Check Output

- `status`: `PASS` 或 `BLOCKED`
- `minMissing`: 最低必需缺失项
- `recommendedMissing`: 推荐补充缺失项
- `warnings`: 前置实验缺失、规则覆盖不足等提醒
- `compatibilityIssues`: 目前包含 `WB` 一抗/二抗种属兼容性风险
- `resolvedExperimentType`: 手动输入实验名称最终归一到的正式实验类型
- `resolutionSource`: `DIRECT`、`ALIAS_MATCH` 或 `MODEL_SUGGESTION`
- `resolutionConfidence`: 实验名称解析置信度
- `needsConfirmation`: 若为 `true`，表示当前结果仍是候选建议，不会自动进入正式实验目录
- `suggestion`: 低匹配时返回候选实验模板，包含流程阶段、最低必需试剂和推荐试剂
- `ai`: 运行时 skill/MCP、自检结果与自动学习日志摘要
