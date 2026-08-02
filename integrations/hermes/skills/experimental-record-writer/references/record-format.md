# 记录文件包

```text
<output-directory>/
  record.json                    # 当前结构化记录，含内部状态和修订号
  record.md                      # 当前 Markdown 导出
  manifest.json                  # 附件与导出清单
  audit.jsonl                    # 追加式审计事件
  revisions/record-r0001.json    # 不可变修订快照
  exports/record-r0001.md        # 修订化 Markdown 快照
  exports/record-r0001.docx      # 可选 DOCX 快照
  attachments/                   # 复制的原始或派生结果文件
  lark-publish.json              # 已发布飞书文档的本地绑定与同步回执
```

`record.json` 可记录内部 `status`、创建时间、输入哈希和审计所需信息；这些字段不会显示在日常实验记录正文。记录正文的 `performedAt` 为 `YYYY-MM-DD`，默认创建当天。

试剂行使用 `reagentName`、`manufacturer`、`catalogNumber`、`category`、`antibody`、`availability.state`、`lookupTimestamp` 的 MCP 安全输入模型。导出时仅显示名称、厂家、货号、类别和浓度/稀释度。

后续结果通过 `add-result` 创建新修订。已发布到飞书的记录可由 `publish_lark.py --sync-results` 根据 `lark-publish.json` 识别同一份文档，并仅追加未同步的结果和附件。远程同步是外部写操作，必须先 dry-run 并获得用户批准；不得替换既有文档正文。
