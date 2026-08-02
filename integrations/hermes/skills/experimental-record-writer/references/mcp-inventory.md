# 试剂库存 MCP

仅在用户已从已登录的 MCP 接入页配置个人令牌后使用库存 MCP。先在实验室不明确时调用 `list_authorized_labs`，再按实验类型调用 `resolve_western_blot_antibodies` 或 `search_lab_reagents`。

## 记录安全的写入规则

1. 把每个返回项当作候选试剂。多候选、模糊匹配或 `not_found` 时，显示紧凑候选表并要求用户选择。
2. 只有用户已经说过使用该靶标，且返回唯一精确匹配时，才可自动带入试剂信息。
3. 只接收并保存 MCP 的规范字段：`reagentName`、`manufacturer`、`catalogNumber`、`category`、`antibody`、`availability.state` 和顶层 `lookupTimestamp`。
4. 实验记录的试剂表显示名称、厂家、货号、类别和已提供的浓度/稀释度。不要显示库存平台名称、URL、令牌、MCP 名称、内部 ID、`lookupTimestamp` 或库存服务来源。
5. 不记录批号、有效期或用量。库存状态和查询时间只作为内部输入上下文，不能表述为实际使用证明。

对“跑了 KLF6 和 β-actin 的 WB”，分别查询 `KLF6` 与 `β-actin`。`ACTB` 可作为 β-actin 的别名，但不得把二抗当作所需的一抗。
