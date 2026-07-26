# Analysis Deliberation: Experimental Technique Knowledge Base

## Knowledge Consolidation

The current system has three drifting sources of truth: experiment knowledge JSON,
hard-coded experiment types, and deterministic rules. It has only five techniques and treats
zero applicable rules as a passing result. Runtime database records also replace the entire
static catalog whenever any record exists. A larger catalog would amplify these correctness
failures before search performance became a concern.

The product needs two linked but distinct representations:

1. a scientific technique record describing what the method is and how it is assessed; and
2. resource requirements describing what can be verified automatically or manually.

The technique is the single source of truth. Search, selection, prompts, checks, and database
synchronization are projections from it.

## Candidate Approaches

### Extend the existing three catalogs

- Strength: smallest initial diff.
- Weakness: preserves drift and makes 335 entries require synchronized edits in several files.
- Rejected because a missed rule can produce a false pass.

### Store all new data in unvalidated JSON

- Strength: rapid authoring.
- Weakness: no runtime guarantees for nested workflow, evidence, safety, or requirement data.
- Rejected because scientific and safety fields need machine-enforced publication gates.

### Unified validated model with repository baseline and reviewed runtime overrides

- Strength: one code, taxonomy, rule, evidence, and publication lifecycle.
- Weakness: requires a schema migration and API/UI rewrite.
- Selected because the user explicitly permits breaking backend changes and requires complete
  modeling for every published leaf technique.

## Selected Approach

- A validated server-only content bundle contains the curated baseline.
- Published database records override the baseline by technique code; partial databases never
  hide baseline techniques.
- Abstract family nodes support navigation. Only complete published leaf nodes count toward
  the 335-entry target and participate in checks.
- Reagent requirements can match inventory automatically. Consumables, instruments, samples,
  controls, and acquisition software require explicit user confirmation until corresponding
  inventory domains exist.
- Overall states are `BLOCKED`, `NEEDS_CONFIRMATION`, `READY`, and `UNSUPPORTED`; an empty or
  invalid requirement set is always `UNSUPPORTED`.
- AI and ordinary members create lab-scoped drafts. Only PI/ADMIN review can create a global
  immutable published revision.
- Search performs exact code/name/alias resolution automatically. Fuzzy candidates always
  require user selection.

## Key Risks and Mitigations

- **Generic content masquerading as precise guidance:** require per-technique names, principle,
  scope, samples, readouts, workflow, controls/QC, safety, and evidence before publication.
- **Copyright leakage:** store original summaries and links; preserve source/license metadata.
- **False compliance:** keep reporting, methodology, and readiness statuses separate.
- **Lost production knowledge:** merge by code and preserve curated records and drafts during
  SYSTEM synchronization.
- **Client bundle growth:** query paginated summaries from server-side Route Handlers and
  load detail on demand.
