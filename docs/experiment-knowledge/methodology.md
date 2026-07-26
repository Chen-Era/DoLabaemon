# Methodology: Experimental Technique Knowledge Base Upgrade

## Research Question

How can the application represent, retrieve, review, and check at least 335 wet-lab and
instrument techniques without scientific source drift, false readiness, or unbounded client
payloads?

## Data Description

- Existing baseline: five static experiment entries, five formal experiment types, 66 rules,
  62 reagent capability tags, and three global research directions.
- Runtime sources: PostgreSQL/Prisma in production and a JSON demo store.
- Consumers: experiment resolution, deterministic inventory checks, knowledge audit, and the
  dashboard experiment-check page.

## Implementation Pipeline

### 1. Content contract

- Define Zod schemas for technique, requirement, profile, evidence, claim binding, reporting
  standard, safety, workflow, QC, and draft payloads.
- Create 12 controlled categories with explicit leaf quotas totaling 335.
- Validate uniqueness, parent/category references, aliases, evidence, resource coverage, and
  publication completeness.

### 2. Unified runtime

- Load and validate server-only category bundles.
- Merge repository baseline and published runtime overrides by code.
- Derive search summaries, exact aliases, fuzzy candidates, profiles, and check requirements
  from the merged model.
- Return `UNSUPPORTED` for missing, unpublished, invalid, or empty requirement models.

### 3. Persistence and governance

- Add unified technique, requirement/profile/evidence, revision, and lab-scoped draft models.
- Migrate the five existing techniques and link historical check runs by stable code.
- Synchronize SYSTEM records transactionally; deactivate removed SYSTEM records and preserve
  CURATED records and drafts.
- Publish and roll back through immutable revisions and audited PI/ADMIN actions.

### 4. API and UI

- Add paginated technique list, detail, resolve, readiness-check, draft, review, publish, and
  rollback Route Handlers.
- Keep catalog loading in Server Components/Route Handlers; Client Components receive only
  paginated summaries and selected details.
- Add atlas, draft review, audit, technique detail, searchable picker, profile selection, and
  manual resource confirmation interfaces.

## Validation Plan

- At least 335 complete published leaf techniques and all category quotas satisfied.
- Exact/alias/fuzzy/negative retrieval cases for every technique.
- Complete inventory, missing required reagent, missing recommendation, and unconfirmed
  manual-resource scenarios.
- Baseline/runtime merge, old demo-store upgrade, draft isolation, permission, publish, and
  rollback coverage.
- Local search p95 below 5 ms for 1,000 entries and below 15 ms for 5,000 entries.
- Node 22 CI gates: lint, typecheck, isolated unit/integration tests, Next build, and desktop
  tests; `.data` excluded from production artifacts.

## Limitations

- Full operational conditions remain in versioned external protocols rather than copied SOP
  text.
- Non-reagent resources are knowledge requirements with manual confirmation, not managed
  inventory entities in this release.
- Pure computational analysis methods remain outside the technique catalog.
