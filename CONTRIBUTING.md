# Contributing

This project uses a lightweight workflow intended for a small prototype team.

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
- Avoid delivery-stage naming in commits, filenames, code, and runtime messaging.

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

## Scope Discipline

- Keep tooling, infrastructure, and domain behavior separated into focused changes where practical.
- Avoid naming files, functions, or messages after roadmap phases or delivery stages.
- When a change introduces new processing, event, or scoring behavior, document the rule shape before broad implementation.
