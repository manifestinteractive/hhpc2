# Developer Guide

This document is the developer-facing entrypoint for working in this repository.

Use this alongside:

- `AGENTS.md` for project rules and AI execution boundaries
- `CONTRIBUTING.md` for branch, commit, PR, and validation expectations
- `.agents/README.md` for Codex skill and MCP workspace notes

## Current Stack

- Next.js 16 App Router
- React 19
- TypeScript strict mode
- Tailwind CSS v4
- Source-based shadcn-style UI components
- Supabase workflow scaffolding for local and hosted environments
- Vitest for unit testing
- ESLint and Prettier
- GitHub Actions CI and Vercel preview scaffolding

## Repository Structure

- `planning-docs/` requirements, roadmap, and operating documents
- `src/app/` routes, layouts, and route handlers
- `src/components/` reusable UI and bootstrap views
- `src/lib/` environment, health, and domain or infrastructure modules
- `src/types/` shared application types
- `scripts/` developer utility scripts

## Quick Start

### Prerequisites

- Node.js 20.9 or later
- `pnpm` 10.33.0 or later
- Docker Desktop if you want to run Supabase locally

### Install

```bash
pnpm install
```

### Configure the environment

Copy the example environment file and fill in the values you want to use locally:

```bash
cp .env.example .env.local
```

Minimum local bootstrap values:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Recommended additional values:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_ID`
- `OPENAI_API_KEY`

### Validate the environment

```bash
pnpm env:check
```

### Start the app

```bash
pnpm dev
```

Then open `http://localhost:3000`.

## Health Endpoints

The bootstrap layer exposes two route handlers:

- `GET /api/health` basic application and env-contract status
- `GET /api/health/dependencies` environment plus dependency connectivity checks

These are intentionally simple and exist to verify the bootstrap before deeper product behavior is added.

## Supabase Workflow

This repo supports a hybrid local and hosted Supabase workflow while keeping the product schema explicit and migration-driven.

Common commands:

```bash
pnpm db:start
pnpm db:status
pnpm db:check
pnpm db:stop
pnpm db:reset
pnpm db:types:local
```

Notes:

- Local Supabase requires Docker.
- The expected local validation flow is `pnpm db:start`, `pnpm db:status`, `pnpm db:types:local`, then `pnpm db:stop`.
- CI also validates that the local Supabase stack can start successfully on GitHub-hosted runners.
- `db:types:local` and `db:types:linked` keep generated types aligned with the active schema.
- Core schema and persistence live in `supabase/migrations/`, `supabase/seed.sql`, and `src/lib/db/`.

## Developer Commands

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format
pnpm format:write
pnpm check
```

## AI Workspace Setup

This repository standardizes on the `Codex IDE extension inside VS Code`.

Shareable AI workspace assets live in-repo:

- `AGENTS.md` is the canonical project guidance
- `.agents/skills/` contains project-local Codex skills
- `.codex/config.toml` defines the repo-tracked Codex project configuration for trusted workspaces
- `CONTRIBUTING.md` defines branch, commit, PR, and local validation conventions

Included AI integrations:

- `nextjs` MCP via `next-devtools-mcp`
- `shadcn` MCP via `shadcn@latest mcp`
- `supabase` MCP via the local Supabase MCP endpoint at `http://localhost:54321/mcp`
- `vercel` MCP via the hosted Vercel MCP endpoint
- `openaiDeveloperDocs` MCP via `https://developers.openai.com/mcp`
- `shadcn` Codex skill under `.agents/skills/shadcn`
- `next-best-practices` Codex skill under `.agents/skills/next-best-practices`
- `supabase-postgres-best-practices` Codex skill under `.agents/skills/supabase-postgres-best-practices`

Notes:

- `.codex/config.toml` currently pins `gpt-5.4` with `medium` reasoning effort for project-scoped Codex sessions.
- Not every dependency used by this project publishes a stable project-local Codex skill. Today the repo pins `shadcn`, `next-best-practices`, and `supabase-postgres-best-practices`, and uses MCP integrations for the rest of the stack.
- The supported Codex workflow is the Codex IDE extension in VS Code, not a standalone CLI-first setup.
- For the supported workflow, `.codex/config.toml` is the single repo-tracked Codex configuration layer and requires the workspace to be trusted.
- Codex can still merge personal configuration from `~/.codex/config.toml`, but this repository does not require any global MCP or skill setup for the supported workflow.
- Repo instructions remain in the repository-root `AGENTS.md`. The `~/.codex/AGENTS.md` examples in Codex docs describe home-scope guidance, not the normal project instruction location.
- This repository intentionally relies on normal `AGENTS.md` discovery instead of `model_instructions_file` so future nested `AGENTS.md` or `AGENTS.override.md` files continue to work as documented.
- Repo-local Codex skills remain in `.agents/skills/`, which is the documented repository skill discovery path.
- Supabase MCP becomes available after local Supabase is running.
- Vercel MCP may require editor-side authentication before tools are available.
- `openaiDeveloperDocs` is a safe read-only MCP for OpenAI and Codex documentation questions.
- When working on Next.js code, agents should read the bundled docs in `node_modules/next/dist/docs/` before making framework changes.

## Planning Documents

The system scope and sequencing are defined in:

- `planning-docs/business-requirements.md` for business requirements, scope, success metrics, and assumptions
- `planning-docs/functional-requirements.md` for system behavior and feature definitions
- `planning-docs/technical-requirements.md` for architecture, integrations, and quality constraints
- `planning-docs/implementation-roadmap.md` for phased sequencing
- `planning-docs/engineering-standards.md` for naming, boundaries, normalization, event, and scoring patterns
- `planning-docs/raci-matrix.md` for roles and responsibilities
- `planning-docs/executive-summary.md` for a high-level system summary
