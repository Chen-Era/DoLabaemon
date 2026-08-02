# Repository integration

Use this repository as a source of method and reagent context, not as evidence that a particular experiment happened.

## Authoritative sources

| Need | Read | Use in a record |
| --- | --- | --- |
| Structured reagent fields | `src/lib/reagent-ingest/types.ts`, `src/lib/llm/schemas.ts`, `prisma/schema.prisma` | Vendor, catalog number, category, antibody/primer metadata, expiry, and a confirmed inventory snapshot. Record lot number only if supplied separately. |
| Reagent vocabulary | `src/lib/rules/catalog.ts` | The current capability-tag authority. Do not copy the older 62-tag list from Hermes documents. |
| Reagent knowledge | `src/lib/reagent-knowledge/runtime.ts`, `retrieval.ts`, `catalog.json` | Candidate aliases and evidence. Show ambiguous matches for confirmation. |
| Experiment techniques | `src/lib/experiment-techniques/types.ts`, `runtime.ts`, `search.ts`, `data/` | Technique code/revision, workflow stages, parameter recording rules, QC, safety, reporting standards. Snapshot selected fields and versions. |
| Readiness checks | `src/lib/experiment-techniques/check.ts`, `inventory.ts` | A separate readiness snapshot. It does not prove actual execution. |
| Older five-technique catalog | `src/lib/experiment-knowledge/` | Compatibility context only. Do not use it as the sole authority for a current method. |

## Safe workflow

1. Resolve a technique by exact code/name/alias. If matching is fuzzy, show candidates and wait for the user to select one.
2. Read the published technique's workflow stages, `keyParameters.recordingRule`, QC, safety, and reporting standards. Use them as a checklist of fields to ask about.
3. Parse a reagent only into a candidate structure. Preserve the original user wording and request confirmation before copying a candidate into the actual-use table.
4. If available, snapshot a readiness check separately with its date, selected technique version, and missing/confirmed resources. Never re-label it as an execution result.
5. Save only the confirmed snapshots in the record. Later knowledge-base changes must not rewrite historical records.

The application currently has no experiment-record, attachment, or result-persistence API. This skill therefore writes a local file bundle and does not claim that it stored anything in Dorlabaemon's database or web UI.
