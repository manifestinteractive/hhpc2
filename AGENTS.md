<!-- BEGIN:nextjs-agent-rules -->

# Next.js: Read docs before coding

Before any Next.js change, read the relevant bundled docs in `node_modules/next/dist/docs/`. Treat those docs as the source of truth for the installed version.

<!-- END:nextjs-agent-rules -->

# HHPC2 Project Guidance

## Supported AI Workspace

This repository officially supports `Codex inside VS Code`.

Keep shareable AI workspace assets in-repo:

- `AGENTS.md` is the canonical project guidance
- `DEVELOPERS.md` is the canonical developer onboarding and local workflow guide
- `.agents/skills/` contains project-local Codex skills
- `.codex/config.toml` defines the repo-tracked Codex project configuration for trusted workspaces

Keep `AGENTS.md` at the repository root as the canonical rules entrypoint for this project.

Do not add Cursor-specific or Claude Code-specific repo configuration unless explicitly requested.

Current project-local skills:

- `shadcn` for shadcn/ui workflows
- `next-best-practices` for Next.js implementation guidance
- `supabase-postgres-best-practices` for Postgres schema and query guidance

Current MCP-backed integrations:

- `nextjs` via `next-devtools-mcp`
- `shadcn` via `shadcn@latest mcp`
- `supabase` via the local Supabase MCP endpoint at `http://localhost:54321/mcp`
- `vercel` via the hosted Vercel MCP endpoint
- `openaiDeveloperDocs` via `https://developers.openai.com/mcp`

Workspace notes:

- The supported agent workflow is the Codex IDE extension running inside VS Code.
- `.codex/config.toml` is the repo-local Codex configuration entrypoint and is loaded after the project is trusted.
- `.codex/config.toml` currently pins `gpt-5.4` with `medium` reasoning effort for project-scoped sessions.
- Repository instructions stay in root `AGENTS.md`.
- Do not set `model_instructions_file` unless you intentionally want to replace normal `AGENTS.md` discovery.
- Repository skills stay in `.agents/skills/`, which is the documented Codex repository skill discovery path.
- Standalone Codex CLI outside VS Code is not a supported workflow for this repository.
- Do not assume developers lack personal `~/.codex/config.toml` settings. Repo guidance should work even if extra personal MCP servers are present.
- Supabase MCP is expected to be used against local development by default.
- Vercel MCP may require editor-side authentication and should be treated as optional unless deployment work is active.

## Purpose

HHPC2 is the Crew Readiness Platform prototype described in `README.md` and `planning-docs/`.
This codebase is a modular monolith that will evolve phase-by-phase from engineering bootstrap through simulation, ingestion, processing, scoring, dashboard UI, and AI-assisted summaries.
Use `DEVELOPERS.md` for local setup, commands, Supabase workflow, and developer-facing operational documentation.

## Phase Boundaries

- Phase 0 owns bootstrap, tooling, environment strategy, health endpoints, AI-agent guidance, CI scaffolding, and local Supabase workflow.
- Phase 1 owns the first real database schema, seed data, CRUD utilities, constraints, and persistence layer.
- Do not pull Phase 1 persistence work back into Phase 0 unless explicitly requested.

## Domain Vocabulary

- `raw readings`: immutable sensor inputs as received
- `normalized readings`: derived, cleaned, or transformed values
- `detected events`: structured annotations derived from normalized signals
- `readiness scores`: explainable aggregates derived from normalized signals and events
- `ai summaries`: narrative outputs layered on top of structured system state

## Code Organization

- Put routes and route handlers in `src/app`.
- Put reusable UI in `src/components`.
- Put domain and infrastructure logic in `src/lib`.
- Keep shared types in `src/types`.
- Keep product logic out of route handlers and UI components. Routes compose; `src/lib` implements.

## Naming Conventions

- Database tables and fields: `snake_case`
- Route segments and API path names: `kebab-case`
- TypeScript types, interfaces, and React components: `PascalCase`
- Variables and functions: `camelCase`
- Public resource collections and route namespaces: plural nouns

## Module Rules

- Extend an existing domain module before creating a new one.
- Shared helpers belong in `src/lib`, not inside route folders, unless the helper is route-private.
- Processing, simulation, scoring, and normalization logic should stay pure and testable.
- Refactor when duplication crosses module boundaries or hides domain intent. Do not refactor for style churn alone.

## Engineering Patterns

- Keep normalization deterministic and recomputable from raw readings.
- Run event detection on normalized data, not directly on raw inputs.
- Keep event rules isolated, explicit, and replayable.
- Keep readiness scoring bounded, deterministic, and explainable through named components.
- Preserve traceability from raw input to normalized signal to event to score.

## AI Usage Boundaries

- Architecture, schema design, scoring logic, and auth boundaries are human-led decisions.
- AI can implement within an approved plan, but generated code must stay explicit, typed, and reviewable.
- Avoid opaque abstractions, hidden side effects, and speculative framework patterns.
- For larger changes, propose the plan before editing. For bounded implementation work inside an approved phase, execute directly.
- Prefer repo-local AI tooling over global configuration whenever the supported client allows it.
- When using MCP servers that connect to live services, default to development-only usage and least privilege.
- Treat MCP servers as execution surfaces, not just documentation sources. Review tool scope before using write-capable integrations.
- Use the `openaiDeveloperDocs` MCP server for OpenAI or Codex product questions before falling back to general web search.

## Environment and Secrets

- Never inline secrets in tracked files.
- Keep server-only credentials off the client. Only `NEXT_PUBLIC_*` values may be client-visible.
- Use `.env.example` to document the contract and `.env.local` for local secrets.

## Testing and Validation

- Minimum validation for significant changes: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Use targeted unit tests for pure business logic.
- Use route-level health checks to confirm bootstrap wiring before later phases add product behavior.
