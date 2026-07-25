# Architecture

- Frontend: Next.js App Router
- API: Next.js Route Handlers
- DB: PostgreSQL + Prisma
- Auth: NextAuth Credentials
- LLM: OpenAI-compatible API for reagent parsing
- Rule Engine: deterministic rule matching for minimum/recommended reagent checks
- Runtime Skills: server-published skill registry for reagent and experiment curation
- Runtime MCP: in-process search/fetch/self-check tool servers used by parsing and resolving flows
- AI Orchestrator: central flow runner that combines user LLM config, lab AI policy, self-check and learning logs
- AI Policy: lab-level allowlist for auto-learning roles and knowledge domains
- Knowledge Audit: knowledge mutation logs and rollback endpoint for AI-generated write-back attempts
- Runtime Knowledge Source: `ReagentKnowledgeEntry` and `ExperimentKnowledgeEntry` tables are now the preferred formal knowledge source; static JSON remains the seed/baseline fallback
