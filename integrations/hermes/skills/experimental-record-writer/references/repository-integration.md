# Repository integration

Use this repository as a source of method and reagent context, not as evidence that a particular experiment happened.

## Authoritative sources

| Need | Read | Use in a record |
| --- | --- | --- |
| Structured reagent fields | `src/lib/reagent-ingest/types.ts`, `src/lib/llm/schemas.ts`, `prisma/schema.prisma` | Name, manufacturer, catalog number, category, and antibody/primer metadata. Map inventory results to the record-safe MCP fields. |
| Reagent vocabulary | `src/lib/rules/catalog.ts` | The current capability-tag authority. Do not copy the older 62-tag list from Hermes documents. |
| Reagent knowledge | `src/lib/reagent-knowledge/runtime.ts`, `retrieval.ts`, `catalog.json` | Candidate aliases and evidence. Show ambiguous matches for confirmation. |
| Experiment techniques | `src/lib/experiment-techniques/types.ts`, `runtime.ts`, `search.ts`, `data/` | Technique code/revision, workflow stages, parameter recording rules, QC, safety, reporting standards. Snapshot selected fields and versions. |
| Readiness checks | `src/lib/experiment-techniques/check.ts`, `inventory.ts` | A separate readiness snapshot. It does not prove actual execution. |
| Older five-technique catalog | `src/lib/experiment-knowledge/` | Compatibility context only. Do not use it as the sole authority for a current method. |

## Safe workflow

1. Resolve a technique by exact code/name/alias. If matching is fuzzy, show candidates and wait for the user to select one.
2. Read the published workflow only to draft a concise conventional process. Default an unreported key parameter to `同前次记录`; ask only when leaving it unspecified would be unsafe or misleading.
3. For a unique exact inventory match, map its record-safe fields to the reagent table. For an ambiguous match, preserve the user's wording and ask them to select a candidate.
4. Use explicit sample or cell-line names and targets to populate the input table and the per-sample group table.
5. Later knowledge-base changes must not rewrite an existing record or its Feishu publication receipt.

The application currently has no experiment-record, attachment, or result-persistence API. This skill therefore writes a local file bundle and does not claim that it stored anything in Dorlabaemon's database or web UI.
