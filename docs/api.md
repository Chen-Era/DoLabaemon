# API

- `POST /api/reagents/parse`: 输入试剂基础信息，返回 LLM 解析草稿
- `POST /api/reagents/confirm`: 确认草稿并入库
- `GET /api/reagents/list?labId=...`: 获取实验室试剂列表
- `POST /api/experiment/resolve`: 手动输入实验名称，返回已匹配类型或候选实验模板
- `POST /api/experiment/check`: 返回最低缺失、推荐缺失、兼容性风险
- `POST /api/experiment/confirm`: 确认一个模型生成的实验解析草稿
- `POST /api/labs/invite`: 邀请成员加入实验室
- `GET /api/labs/my`: 获取当前用户可访问实验室

## Reagent Parse Output

- `experimentTags`: 标准化实验用途标签，例如 `WB_LYSIS_BUFFER`、`QPCR_MASTER_MIX`、`FIXATIVE`
- 标签已扩展覆盖常见实验环节，例如细胞培养、筛选抗生素、转染/转导、蛋白定量、WB 转膜膜材、ELISA、流式、外泌体分离等
- `antibodyMeta`: 抗体角色、宿主、识别种属、靶点
- `primerMeta`: 引物靶点与是否为内参引物

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
