---
name: sdd-implementation-guardrails
description: Use when implementing or refactoring code in this repository. Enforces the project's architecture, design patterns, engineering conventions, IPC boundaries, testing priorities, and file/module split rules.
---

# SDD Implementation Guardrails

Use this skill for any implementation, refactor, module design, IPC work, renderer work, or architectural decision in this repository.

## Source documents

Read these first:

- `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/02-architecture.md`
- `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/06-design-patterns.md`
- `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/07-engineering-conventions.md`

## Required architecture

Use this structure:

- `renderer` for UI only
- `preload` for typed IPC bridge only
- `main` for OS/process/subprocess work
- `application` for use cases
- `domain` for rules and state transitions
- `infrastructure` for file system, analyzers, Codex adapters

Do not let renderer directly access file system details or `.sdd` internals.

## Required patterns

Prefer these patterns:

- `Use Case Pattern`
- `Repository Pattern`
- `State Machine Pattern`
- `Pipeline Pattern`
- `Strategy + Factory`
- `Typed IPC Facade`
- `Atomic Write`
- `Versioned Document`
- `Append-only Event Log`

## Engineering rules

- Use TypeScript only.
- Assume strict TypeScript.
- No default exports.
- No giant `utils.ts`.
- No direct `fs` access in renderer.
- No cross-feature internal imports; use public API only.
- Keep business rules out of repositories.
- Keep file format parsing behind repositories.
- Do not keep a complex renderer screen in a single page file.
- Treat `Page` components as composition roots, not implementation buckets.

## Function and file rules

- One file should have one main reason to change.
- Split large functions once they mix validation, state transition, persistence, and formatting.
- Use object parameters when a function grows beyond simple inputs.
- Use explicit result types for use cases.
- In renderer features, prefer this split once complexity grows:
  - `Page`
  - `components/*`
  - `hooks/*` or feature hook file
  - `types`
  - `constants`
  - `utils`
- Keep user-facing text and interaction semantics in renderer.
- Keep async orchestration and IPC calls inside a feature hook or boundary helper, not spread across many presentational components.

## Renderer UX rules

- User-facing UI should describe product actions, not implementation details like IPC or internal transport.
- Do not expose internal roadmap, future expansion plans, experimental options, or implementation detail as primary user-facing copy.
- If future capability or technical limitation must be mentioned, keep it short and user-task oriented; move the real detail to docs, not the main UI.
- If a feature is not actually connected yet, present it as `준비 중` or an empty state, not as a fake live feature.
- Project-scoped chat sessions must appear inside the selected project context, not as unrelated global workflow stages.
- Selecting a project must not silently reorder project lists.
- If ordering matters in UI, prefer explicit user-controlled ordering such as drag-and-drop.

## Error handling rules

- Use case boundary should expose predictable `AppError`-style failures.
- Infrastructure may catch and convert lower-level exceptions.
- Do not leak raw internal errors to UI.

## Testing priority

1. domain/state transition
2. use case
3. repository integration
4. IPC contract
5. Electron E2E
6. component test

## When changing structure

If you change architecture, IPC boundaries, or conventions, update these documents together:

- `02-architecture.md`
- `06-design-patterns.md`
- `07-engineering-conventions.md`
