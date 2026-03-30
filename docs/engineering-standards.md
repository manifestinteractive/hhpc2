# Engineering Standards

This document captures the Phase 0 engineering standards that shape later implementation phases.

## Domain Vocabulary

- `raw readings`: immutable sensor inputs as received
- `normalized readings`: cleaned or transformed values derived from raw readings
- `detected events`: explicit flags or annotations produced from normalized data
- `readiness scores`: bounded, explainable aggregates derived from normalized readings and events
- `ai summaries`: human-reviewable narrative outputs derived from structured system state

## Naming Conventions

- Database tables and fields use `snake_case`
- Route segments and API names use `kebab-case`
- TypeScript types, interfaces, and React components use `PascalCase`
- Variables and functions use `camelCase`

## Code Organization

- Routes and route handlers live in `src/app`
- Reusable UI lives in `src/components`
- Domain and infrastructure logic lives in `src/lib`
- Shared types live in `src/types`
- Pure logic should be isolated from UI and persistence concerns

## File Boundaries

- Keep route handlers thin; they orchestrate and validate, but do not contain business logic
- Keep reusable domain logic out of components
- Put shared helpers in `src/lib`, not inside route folders, unless they are route-private
- Extend an existing module before creating a new top-level domain folder

## Normalization Pattern

- Never overwrite or mutate raw sensor inputs
- Normalize from `raw -> normalized` in explicit, deterministic stages
- Keep normalization functions pure, testable, and versionable
- Record enough metadata to explain how a normalized value was produced
- Treat normalization as recomputable from stored raw data

## Event Detection Pattern

- Run event detection on normalized data, not raw sensor inputs
- Express detection rules as isolated, reviewable functions
- Emit structured event outputs with clear evidence and rule identity
- Keep thresholds and rule parameters explicit rather than hidden in handlers or UI
- Design event detection to be replayable if thresholds change later

## Readiness Scoring Pattern

- Compute readiness scores from normalized readings and detected events only
- Keep scoring deterministic, bounded, and explainable
- Represent scoring as named subcomponents plus an aggregate result
- Preserve enough traceability to explain why a score changed
- Version scoring rules so later phases can recompute history safely

## Module Lifecycle Rules

- Write a new module when a concern is distinct and cannot fit an existing boundary cleanly
- Extend an existing module when the new behavior belongs to the same domain
- Refactor when duplication crosses module boundaries or hides domain intent
- Prefer iteration over premature abstraction in early phases

## Shared Utilities vs Domain Logic

- Shared utilities should be generic, dependency-light, and reusable across domains
- Domain logic should encode project meaning and stay close to the domain module that owns it
- Do not bury domain rules in generic utility files
