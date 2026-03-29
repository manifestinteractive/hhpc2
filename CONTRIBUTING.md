# Contributing

This project has completed `Phase 0` and uses a lightweight workflow intended for a small prototype team as it moves into `Phase 1`.

## Branch Strategy

- `main` is the integration branch.
- Use short-lived topic branches for all non-trivial work.
- Preferred branch prefixes:
  - `feature/<scope>`
  - `fix/<scope>`
  - `chore/<scope>`
  - `docs/<scope>`
- Rebase or merge `main` into your branch before opening or updating a pull request if it has drifted.

## Commit Conventions

- Prefer small, reviewable commits over large mixed commits.
- Use a conventional subject line:
  - `feat:`
  - `fix:`
  - `chore:`
  - `docs:`
  - `refactor:`
  - `test:`
  - `build:`
  - `ci:`
- Keep the subject line imperative and specific.
- If a commit is phase-scoped, mention the phase in the body rather than overloading the subject.

Examples:

- `feat: add bootstrap status cards`
- `docs: clarify Codex project config`
- `ci: validate local Supabase startup`

## Pull Requests

- Open a pull request for any change beyond a trivial typo.
- Keep pull requests focused on one concern or one roadmap step.
- Include:
  - what changed
  - why it changed
  - how it was validated
  - any follow-up work or known gaps

Minimum expected validation before merge:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If your change touches Supabase workflow or local infrastructure, also validate:

```bash
pnpm db:start
pnpm db:status
pnpm db:stop
```

## Local Supabase Expectations

- Local Supabase requires Docker Desktop or another Docker-compatible runtime.
- The repository-scoped `supabase/` directory is committed and is the source of truth for local configuration.
- Treat local Supabase as development-only infrastructure.
- Do not check secrets into the repo; keep them in `.env.local`.

Expected local verification flow:

```bash
pnpm db:start
pnpm db:status
pnpm db:types:local
pnpm db:stop
```

## Phase Discipline

- Keep Phase 0 focused on tooling, bootstrap, AI workspace, docs, and scaffolding.
- Do not pull Phase 1 schema or CRUD implementation into Phase 0 unless explicitly requested.
- When a change introduces new processing, event, or scoring behavior, document the rule shape before broad implementation.
