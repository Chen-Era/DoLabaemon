---
name: experimental-record-writer
description: Create or update concise, revisioned laboratory experiment records from a researcher's completed experiment, reagents, images, and text results. Use for experiment notebook entries, bench records, Markdown or DOCX records, automatic sample and group tables, and creating or updating the matching Feishu/Lark document.
---

# Experimental record writer

Create one factual record bundle per experiment. Keep this as one skill: the bundled scripts handle drafting, result amendments, DOCX export, and Feishu synchronization without separate handoffs.

## Record rules

- Write a concise Chinese record. Use tables by default. Use `narrative` only when the user asks for a short note.
- A user saying an experiment was completed authorizes a short conventional workflow draft. It is not a claim that unreported numeric settings, durations, controls, observations, or results occurred.
- Set the execution date to the record creation date unless the user gives another date. Store and display the date only, never a start or end time.
- Use the current user as the performer. Ask who performed the work before creating the record if the current user is unknown. Pass that name with `--actor`; the script copies it to the record and steps.
- Show `同前次记录` when instruments, software, or key parameters are not specified. Ask only when a missing parameter would make the requested workflow unsafe or misleading.
- Infer explicitly named samples and input targets. For example, “我跑了一个 a498 和 achn 的 WB，蛋白是 klf6 和 β-actin” creates A498 and ACHN cell-sample rows plus a group table whose rows contain each cell line and KLF6、β-actin.
- Keep results and original attachments in the same revisioned bundle. Preserve audit events and snapshots internally.
- Do not render a status line, technique code/revision, protocol URL, start/end time, lot, expiry, amount, controls/QC, observations, follow-up, source notes, or completeness statement.
- Never write an inventory service name, URL, token, MCP name, internal ID, or platform attribution into any record field, export, filename, audit event, or attachment. A reagent table may show only factual product information such as name, manufacturer, catalog number, category, and stated concentration/dilution.

## Inventory lookup

When the researcher names a reagent or antibody target, read [MCP inventory](references/mcp-inventory.md). For a resolved and user-authorized match, copy only these canonical record-safe fields into the input JSON:

```json
{
  "reagentName": "KLF6 antibody",
  "manufacturer": "Manufacturer name",
  "catalogNumber": "Catalog number",
  "category": "primary antibody",
  "antibody": {"target": "KLF6"},
  "availability": {"state": "available"},
  "lookupTimestamp": "2026-08-02T00:00:00+08:00"
}
```

Do not infer a product from a fuzzy or multiple match. Show candidates and ask the researcher to choose. Inventory data identifies a candidate product; it does not prove that a bottle was used. The displayed record contains the reagent name, manufacturer, catalog number, category, and concentration/dilution only. Do not ask for or record lot, expiry, or amount.

## Create a record

Read [record standard](references/record-standard.md). When repository context is needed, read [repository integration](references/repository-integration.md). Put confirmed fields and any resolved reagent rows in `assets/record-input.example.json`, then create the bundle outside this repository.

```bash
python3 scripts/record_bundle.py create \
  --input /absolute/path/record-input.json \
  --output-dir /absolute/path/records/2026-08-02-rna-extraction \
  --layout table \
  --actor "张三"
```

For an already completed experiment described only by a name and scenario, use the deterministic sparse draft command. It extracts known cell lines and protein targets from `--scenario`; `--sample` and `--target` add names that cannot be inferred.

```bash
python3 scripts/record_bundle.py create-sparse-draft \
  --experiment WB \
  --scenario "我跑了一个 A498 和 ACHN 的 WB，蛋白是 KLF6 和 β-actin。写实验记录。" \
  --actor "张三" \
  --output-dir /absolute/path/records/2026-08-02-klf6-wb
```

Run validation before presenting the record. Do not attest or review for the user.

```bash
python3 scripts/record_bundle.py validate --record /absolute/path/records/2026-08-02-klf6-wb
```

## Add results and update Feishu

When the user later provides a result summary, image, or UTF-8 text file, amend the same bundle. The script copies the source, preserves its hash, and writes a new revision. An image requires local `tesseract` OCR screening before it can enter the record.

```bash
python3 scripts/record_bundle.py add-result \
  --record /absolute/path/records/2026-08-02-klf6-wb \
  --summary "KLF6 条带已完成采集，详见附件。" \
  --actor "张三" \
  --attachment /absolute/path/result.png
```

Read the installed official `lark-shared` and `lark-doc` skills before any Feishu write. Read [Feishu delivery](references/feishu-delivery.md) before initial publication. A result amendment identifies its matching Feishu document from the bundle's `lark-publish.json` receipt and appends only unsynchronized result entries and their attachments. First show the plan. Execute only after the user authorizes the remote update.

```bash
python3 scripts/publish_lark.py \
  --record /absolute/path/records/2026-08-02-klf6-wb \
  --sync-results \
  --dry-run

python3 scripts/publish_lark.py \
  --record /absolute/path/records/2026-08-02-klf6-wb \
  --sync-results \
  --execute
```

The result synchronizer never replaces the document body, creates a second document, or changes sharing permissions.

## DOCX

Create a DOCX snapshot only after the Markdown record is correct.

```bash
python3 scripts/export_docx.py \
  --record /absolute/path/records/2026-08-02-klf6-wb
```

Render and inspect the DOCX before delivery when a CJK-capable renderer is available. If it is not available, deliver the Markdown source and ask the user to check the DOCX in Word, WPS Office, or Feishu.
