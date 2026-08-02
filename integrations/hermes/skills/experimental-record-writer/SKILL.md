---
name: experimental-record-writer
description: Create or amend traceable laboratory experiment records from a researcher's actual work, reagents, observations, images, and text results. Use when a user asks to write an experiment notebook entry, lab record, bench note, result record, Markdown or DOCX experiment document, or to create the record in Feishu/Lark. Produces a local revisioned record bundle by default and can publish the confirmed snapshot and attachments through the official lark-cli.
---

# Experimental record writer

Create a factual, reviewable record. Treat the user's statement, confirmed inventory data, published technique data, and attached source files as separate evidence. Do not turn a protocol template into a claim that the experiment happened.

## Non-negotiable rules

- Record only facts the user supplied, confirmed repository facts, or facts in an attached source. Mark anything else as `未提供` or `待确认`.
- Never invent a time, lot number, concentration, temperature, duration, replicate count, control, instrument setting, observation, or result. Do not backdate.
- Keep plans, actual execution, observations, interpretations, and next steps in separate sections. Record failed, negative, and anomalous results without softening or deleting them.
- Preserve original image and text result files unchanged. Before copying an attachment, inspect UTF-8 text directly and screen images with local `tesseract` OCR. Copy only an accepted file into the record bundle, compute SHA-256, and list it in the record. Treat OCR, image interpretation, and derived tables as derived files with their source identified.
- Do not put the inventory platform name, URL, token, MCP name, or other service attribution in `record.json`, Markdown, DOCX, audit entries, filenames, attachments, or Feishu exports. For a reagent, show its manufacturer (`vendor`) and catalog number only. Service-side access logs retain the lookup provenance. If an image OCR check or text attachment contains a platform name, reject it without altering the original file.
- Start every record as `DRAFT`. Do not attest or review it for the user. A record remains a file-based audit trail, not a claim of 21 CFR Part 11 compliance.
- Use plain technical language. Prefer short, active sentences and tables. Do not add promotional wording, vague attributions, filler, or em dashes.

## Inputs and repository context

Ask only for missing details that affect the factual record. A minimal request such as "I used TRIzol to extract RNA" is sufficient to create a draft, not a completed record.

When this repository is available, read [repository integration](references/repository-integration.md) before using its data. If the user has configured Dorlabaemon inventory MCP, also read [MCP inventory](references/mcp-inventory.md). Resolve an ambiguous technique or reagent only as a candidate. Show the candidate and confidence, then wait for the user to confirm it. Snapshot the confirmed name, version, fields, and readiness result into the record. Do not write an inventory field, a protocol parameter, or a readiness check result as actual execution.

Read [record standard](references/record-standard.md) before creating a record. Use [record format](references/record-format.md) when the user needs a custom template, a status change, or an amendment.

## Create or amend a local record bundle

Use the bundled script for deterministic filenames, attachment copies, SHA-256 hashes, revision snapshots, and audit events. Never place records in `integrations/hermes/output/`, which is reserved for knowledge JSONL. Ask the user for an output directory outside the repository, or use a user-approved project records directory.

1. Turn confirmed facts into the JSON shape in `assets/record-input.example.json`. Keep unobserved values empty instead of filling them from a method template.
2. Create the bundle. Table layout is the default. Use `narrative` only when the user explicitly asks for a short text note.

```bash
python scripts/record_bundle.py create \
  --input /absolute/path/record-input.json \
  --output-dir /absolute/path/records/2026-08-02-rna-extraction \
  --layout table
```

3. When the user provides an image or text result, add it to the same bundle. The script copies rather than moves the source. If the record is already attested or reviewed, require a real amendment reason.

Image attachment screening requires a local `tesseract` executable with English recognition data. If it is missing or OCR fails, do not add the image until the check can be completed. Result attachments are limited to images and UTF-8 text files so the record can enforce the platform-name boundary.

```bash
python scripts/record_bundle.py add-result \
  --record /absolute/path/records/2026-08-02-rna-extraction \
  --summary "RNA A260/280 readings were 1.96 and 1.99." \
  --observed-at "2026-08-02T15:42:00+08:00" \
  --actor "Zhang San" \
  --attachment /absolute/path/measurements.txt \
  --attachment /absolute/path/qc-plot.png
```

4. Validate before presenting a record as ready for attestation. Fix errors; preserve missing facts as draft fields rather than guessing.

```bash
python scripts/record_bundle.py validate --record /absolute/path/records/2026-08-02-rna-extraction
python scripts/record_bundle.py attest --record /absolute/path/records/2026-08-02-rna-extraction --actor "Zhang San" --reason "I verified the actual execution and attachments."
```

The bundle contains `record.json` (current structured record), immutable `revisions/`, `audit.jsonl`, `manifest.json`, `record.md`, revisioned exports, and `attachments/`. `record.md` is a current view; revision snapshots and the audit file preserve prior states.

### Sparse experiment name and scenario

When the user supplies only an experiment name and a short scenario, create a `DRAFT` from the selected repository-derived standard workflow. If the user says the experiment was completed, write a concise conventional workflow into `actualSteps` to save the researcher from retyping routine steps. Mark these rows as standard-workflow drafts in the structured record and require the researcher to review them before attestation. Never invent numeric parameters, times, operators, vendors, catalog numbers, lots, dilutions, controls, observations, or results. If the user is only planning an experiment, put the workflow in `plannedSteps` instead.

Use `create-sparse-draft` for a deterministic standard draft. Extract user-reported targets from the scenario and pass each one with `--target`. Use `--reported-as planned` when the user is preparing an experiment rather than reporting one already performed.

For a user-reported target antibody, query the configured inventory MCP before asking for a catalog number. Copy the manufacturer and catalog number only from one exact, user-authorized primary-antibody match; otherwise show candidates or ask the researcher to provide the reagent information. A target name alone must remain a target-detection entry rather than a made-up product.

```bash
python scripts/record_bundle.py create-sparse-draft \
  --experiment WB \
  --scenario "比较缺氧处理后肾癌细胞中 KLF6 的蛋白表达，并以 β-actin 作为上样内参。" \
  --target KLF6 \
  --target β-actin \
  --reported-as reported \
  --output-dir /absolute/path/records/2026-08-02-klf6-wb
```

The first bundled template is `WB`, derived from this repository's published WB workflow and reagent checklist. Extend `assets/standard-draft-templates.json` with a new code, aliases, planned steps, reported steps, and required checklist before using another technique. Do not turn a generic template into numeric, pass/fail, or result language.

## Markdown and DOCX

Markdown is produced automatically. For DOCX, run the exporter with a Python runtime that has `python-docx`, then render and inspect it before delivery. For DOCX work, follow the `documents` skill's render-and-inspect workflow. The exporter embeds supported image attachments inline and lists other source files with their hashes.

```bash
python scripts/export_docx.py \
  --record /absolute/path/records/2026-08-02-rna-extraction

python /path/to/documents/render_docx.py \
  /absolute/path/records/2026-08-02-rna-extraction/exports/record-r0001.docx \
  --output_dir /tmp/record-render
```

Inspect every rendered page. If no DOCX runtime or renderer is available, provide the Markdown record and state that DOCX visual review was not completed.

When a record contains Chinese text, render it on the target delivery runtime. If the local headless renderer drops or substitutes CJK glyphs, do not treat that preview as a successful visual check: provide the complete Markdown source and ask the user to verify the DOCX in Microsoft Word, WPS Office, Feishu, or another CJK-capable renderer before treating it as delivered. The DOCX exporter writes an explicit `Arial Unicode MS` East-Asian font preference but cannot install or guarantee fonts in the recipient's renderer.

## Feishu/Lark delivery

Read [Feishu delivery](references/feishu-delivery.md) before an installation, login, or write operation. The local bundle is the source record. The Feishu document is a published snapshot with a recorded URL, revision, and attachment list.

Use the official `lark-cli` skills and commands, not an undocumented HTTP request. First check authentication and scopes. Authentication opens a browser flow and requires the user's participation.

```bash
lark-cli auth status --json --verify
```

With explicit user approval to create the document, preview the publish plan and then execute it. The publisher creates a Markdown-based Feishu document, uploads images inline, attaches text and other source files, and saves the returned document URL in `lark-publish.json`.

```bash
python scripts/publish_lark.py \
  --record /absolute/path/records/2026-08-02-rna-extraction \
  --parent-token <approved-folder-or-wiki-token> \
  --dry-run

python scripts/publish_lark.py \
  --record /absolute/path/records/2026-08-02-rna-extraction \
  --parent-token <approved-folder-or-wiki-token> \
  --execute
```

Do not publish sensitive human data, credentials, or unapproved identifiers. Use the user's identity unless they explicitly choose an application identity. Do not alter sharing permissions, transfer ownership, overwrite a remote document, or publish an amendment without the user's specific instruction.

## Response format

First say what was created or updated and provide the record path. Then state only the essential unresolved fields or validation warnings. For a short text record, write a concise factual paragraph followed by the same traceability tables that have data. Do not claim a result is valid, reproducible, compliant, or final unless the user supplies the basis for that statement.
