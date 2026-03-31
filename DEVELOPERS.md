# Developer Guide

This document is the developer-facing entrypoint for working in this repository.

Use this alongside:

- `.agents/README.md` for Codex skill and MCP workspace notes
- `AGENTS.md` for project rules and AI execution boundaries
- `CONTRIBUTING.md` for branch, commit, PR, and validation expectations

## Current Stack

- Next.js 16 App Router
- React 19
- TypeScript strict mode
- Tailwind CSS v4
- Source-based shadcn-style UI components
- Supabase workflow for local and hosted environments
- Vitest for unit testing
- ESLint and Prettier
- GitHub Actions CI, Vercel preview preflight, and hosted Supabase migration automation

## Repository Structure

- `docs/` living project documentation, standards, and walkthroughs
- `planning-docs/` original requirements, planning, and roadmap artifacts
- `scripts/` developer utility scripts
- `src/app/` routes, layouts, and route handlers
- `src/components/` reusable UI and bootstrap views
- `src/lib/` environment, health, and domain or infrastructure modules
- `src/types/` shared application types

## Quick Start

### Prerequisites

- Node.js 24.14.1
- `pnpm` 10.33.0 or later
- Docker Desktop if you want to run Supabase locally

### Install

Use the pinned runtime before installing dependencies:

```bash
nvm use
```

```bash
pnpm install
```

Notes:

- `.nvmrc`, `package.json#engines.node`, GitHub Actions, and Vercel should all stay aligned on Node 24.14.1.
- `.npmrc` enforces the pinned `node` and `pnpm` versions during install, so run `nvm use` before `pnpm install`.
- `pnpm-workspace.yaml` commits the approved dependency build scripts required for pnpm 10 and Vercel installs.

### Configure the environment

Copy the example environment file and fill in the values you want to use locally:

```bash
cp .env.example .env.local
```

Minimum local bootstrap values:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Recommended additional values:

- `SUPABASE_PROJECT_ID`
- `OPENAI_API_KEY`
- `DEMO_BASIC_AUTH_USERNAME`
- `DEMO_BASIC_AUTH_PASSWORD`

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

## API Endpoints

The application currently exposes server-side API routes for:

- `GET /api/crew`
- `GET /api/crew/[crewCode]`
- `GET /api/events`
- `GET /api/readiness-scores`
- `GET /api/summaries`
- `POST /api/simulation/control`
- `POST /api/ingestion/simulation`
- `POST /api/processing/normalize`
- `POST /api/processing/detect-events`
- `POST /api/processing/calculate-readiness`

The read routes are intended for the dashboard and detail views. The write routes are internal operational endpoints for simulation and processing.

## Supabase Workflow

This repo supports a hybrid local and hosted Supabase workflow while keeping the product schema explicit and migration-driven.

Common commands:

```bash
pnpm db:start
pnpm db:status
pnpm db:check
pnpm db:stop
pnpm db:reset
pnpm db:migrations:list:local
pnpm db:migrations:list:linked
pnpm db:push:linked:dry-run
pnpm db:push:linked
pnpm db:types:local
pnpm db:types:linked
pnpm validate:supabase
```

Notes:

- Local Supabase requires Docker.
- The expected local validation flow is `pnpm db:start`, `pnpm db:status`, `pnpm validate:supabase`, `pnpm db:types:local`, then `pnpm db:stop`.
- CI validates that the local Supabase stack starts and that the repository smoke suite passes against it.
- `db:types:local` and `db:types:linked` keep generated types aligned with the active schema.
- `db:migrations:list:linked` and `db:push:linked*` require the repo to be linked to the hosted Supabase project first.
- Link a local checkout to the hosted project with:

```bash
pnpm exec supabase link --project-ref "$SUPABASE_PROJECT_ID" --password "$SUPABASE_DB_PASSWORD" --yes
```

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
pnpm validate:persistence
pnpm validate:ingestion
pnpm validate:normalization
pnpm validate:events
pnpm validate:api
pnpm validate:supabase
```

## Deployment and CI/CD

The deployment path is split intentionally:

- Vercel Git integration handles application hosting, preview deployments, and production promotion.
- GitHub Actions handles repository validation, Vercel preview parity checks, and hosted Supabase migrations.

### One-time Vercel setup

1. Import the repository into Vercel and keep `main` as the production branch.
2. Configure the application environment variables in Vercel for Preview and Production:
   - `NEXT_PUBLIC_APP_NAME`
   - `NEXT_PUBLIC_APP_ENV`
   - `APP_URL`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_PROJECT_ID`
   - `OPENAI_API_KEY` if AI summaries should run
   - `OPENAI_MODEL_SUMMARY` if you want a non-default summary model
   - `DEMO_BASIC_AUTH_USERNAME` and `DEMO_BASIC_AUTH_PASSWORD` if the hosted demo should be protected
3. Add the GitHub repository variables and secrets used by `.github/workflows/vercel-preview.yml`:
   - repo variable `VERCEL_ORG_ID`
   - repo variable `VERCEL_PROJECT_ID`
   - repo secret `VERCEL_TOKEN`

Notes:

- Set the Vercel project Node.js version to `24.14.1` so hosted builds match `.nvmrc`, `package.json#engines.node`, and GitHub Actions.
- `SUPABASE_SERVICE_ROLE_KEY` is required for the current server-side query layer, simulation pipeline, and summary processing.
- The Vercel preview workflow is a preflight check only. Actual deploys should come from Vercel's native Git integration.

### One-time Supabase automation setup

1. Create the hosted Supabase project and capture:
   - project ref as `SUPABASE_PROJECT_ID`
   - database password as `SUPABASE_DB_PASSWORD`
2. Add the GitHub configuration used by `.github/workflows/supabase-deploy.yml`:
   - repo variable `SUPABASE_PROJECT_ID`
   - repo secret `SUPABASE_ACCESS_TOKEN`
   - repo secret `SUPABASE_DB_PASSWORD`
3. Confirm the hosted project environment values in Vercel match the same Supabase project.

Automation behavior once configured:

- Pull requests that touch `supabase/` run a remote dry-run migration check.
- Pushes to `main` that touch `supabase/` apply pending migrations to the linked hosted project.

### Local release commands

Run these from a linked local checkout when you want to inspect or manage the hosted database manually:

```bash
pnpm db:migrations:list:linked
pnpm db:push:linked:dry-run
pnpm db:push:linked
pnpm db:types:linked
```

Recommended pre-deploy sequence:

```bash
pnpm check
pnpm env:check
pnpm db:start
pnpm validate:supabase
pnpm db:types:local
pnpm db:stop
pnpm db:push:linked:dry-run
```

## Hosted Demo Notes

This repository is intended to be released as a hosted demo of a rapid prototype.

- The site-facing app metadata and branding can stay product-like.
- Repository and developer-facing documentation should remain explicit that the deployment is a demo of a rapid prototype.
- Hosted environments should set `NEXT_PUBLIC_APP_ENV` to `preview` or `production`.
- Hosted environments should set `APP_URL` to the deployed canonical URL. `localhost` is only valid for local development.
- `src/app/robots.ts` explicitly disallows crawling so the hosted demo is not indexed by search engines.

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
- `playwright` MCP via `@playwright/mcp`
- `eslint` MCP via `eslint --mcp`
- `supabase` MCP via the local Supabase MCP endpoint at `http://localhost:54321/mcp`
- `vercel` MCP via the hosted Vercel MCP endpoint
- `openaiDeveloperDocs` MCP via `https://developers.openai.com/mcp`
- `shadcn` Codex skill under `.agents/skills/shadcn`
- `next-best-practices` Codex skill under `.agents/skills/next-best-practices`
- `supabase-postgres-best-practices` Codex skill under `.agents/skills/supabase-postgres-best-practices`

Notes:

- `.codex/config.toml` currently pins `gpt-5.4` with `high` reasoning effort for project-scoped Codex sessions.
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

## Demo Protection

The hosted demo can be protected with site-wide HTTP Basic Auth via `src/proxy.ts`.

Behavior:

- if `DEMO_BASIC_AUTH_USERNAME` and `DEMO_BASIC_AUTH_PASSWORD` are both unset, Basic Auth is disabled
- if both are set, the whole application and API surface are challenged before access is granted
- if only one is set, `pnpm env:check` fails so the mismatch is caught early

## Planning Documents

The original planning set used to define the system scope and sequencing lives in:

- `planning-docs/business-requirements.md` for business requirements, scope, success metrics, and assumptions
- `planning-docs/functional-requirements.md` for system behavior and feature definitions
- `planning-docs/technical-requirements.md` for architecture, integrations, and quality constraints
- `planning-docs/implementation-roadmap.md` for phased sequencing
- `planning-docs/raci-matrix.md` for roles and responsibilities
- `planning-docs/executive-summary.md` for a high-level system summary

Current project documentation lives in:

- `docs/engineering-standards.md` for naming, boundaries, normalization, event, and scoring patterns
- `docs/demo-scenario-walkthroughs.md` for scripted demo scenarios and operator walkthroughs
