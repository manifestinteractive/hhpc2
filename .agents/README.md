# AI Workspace

This repository keeps its shareable AI workspace configuration in-repo.

Canonical files:

- `DEVELOPERS.md` for local setup, commands, and developer workflow
- `AGENTS.md` for project guidance and implementation boundaries
- `.agents/skills/` for Codex project-local skills
- `.codex/config.toml` for the repo-tracked Codex project configuration in trusted workspaces
- `CONTRIBUTING.md` for branch, commit, and PR conventions

Current project-local skill set:

- `shadcn` for registry-aware shadcn/ui workflows
- `next-best-practices` for Next.js implementation guidance
- `supabase-postgres-best-practices` for Postgres schema and query guidance

Current MCP-backed integrations:

- `nextjs` via `next-devtools-mcp`
- `shadcn` via `shadcn@latest mcp`
- `supabase` via the local Supabase MCP endpoint
- `vercel` via the hosted Vercel MCP endpoint
- `openaiDeveloperDocs` via the OpenAI developer docs MCP server

Not every framework in the stack publishes a stable project-local Codex skill. This repository therefore uses a mixed model: pinned project-local skills where available and Codex MCP servers for the rest.

Non-goals:

- No Cursor-specific repo setup
- No Claude Code-specific repo setup
- No required global Codex MCP configuration for the supported workflow

Supported workflow:

1. Open the repository in VS Code.
2. Trust the workspace so Codex can load `.codex/config.toml`.
3. Use the Codex IDE extension inside VS Code so it can access the Codex MCP servers, project overrides, and the project-local skills.

Path conventions:

- `.codex/config.toml` is the repo-local Codex config file.
- `.codex/config.toml` currently pins `gpt-5.4` with `medium` reasoning effort for project-scoped sessions.
- `AGENTS.md` at the repository root is the canonical project instruction file.
- This repository intentionally relies on normal `AGENTS.md` discovery rather than `model_instructions_file`.
- `.agents/skills/` is the documented repository skill location for Codex.
- `~/.codex/AGENTS.md` in the Codex docs refers to home-scope guidance unless `CODEX_HOME` is explicitly redirected.
- Personal `~/.codex/config.toml` settings can still be merged by Codex, but they are optional and not required by this repository.
