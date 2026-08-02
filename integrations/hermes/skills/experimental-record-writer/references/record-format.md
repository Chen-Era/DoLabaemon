# Record format

## Bundle layout

```text
<output-directory>/
  record.json                    # current structured state
  record.md                      # current Markdown view
  manifest.json                  # attachment and export inventory
  audit.jsonl                    # append-only event log
  revisions/
    record-r0001.json            # immutable source snapshot
  exports/
    record-r0001.md              # revisioned Markdown snapshot
    record-r0001.docx            # optional DOCX snapshot
  attachments/
    att-<hash>-<source-name>     # copied original or derived result
  lark-publish.json              # optional remote publication receipt
```

`record.json` may be rewritten as the current view. Never use it as the only evidence of history: inspect `revisions/` and `audit.jsonl` as well.

## Input contract

Use the example JSON as a starting point. The script preserves user-supplied fields and adds only record metadata, revision data, attachment metadata, and audit events.

Use ISO 8601 timestamps with a timezone, for example `2026-08-02T15:42:00+08:00`. Use arrays for repeated rows. A planned step belongs in `plannedSteps`; only an observed operation belongs in `actualSteps`.

## Amendment rules

When a record is already `ATTESTED` or `REVIEWED`, adding a result requires `--reason` and changes the current status to `AMENDED`. The previous revision remains in `revisions/`. The tool intentionally does not implement delete or silent overwrite operations.

## Validation

For all records, validation checks record structure and attachment hashes. For attestation or review, it also requires a performer, a timezone-bearing execution time, an objective, and at least one actual step. Missing samples, reagents, instruments, or controls are warnings because they are not applicable to every method, but confirm they are truly out of scope before attesting.
