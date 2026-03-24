---
name: sdd-engineering-conventions
description: Use when applying or reviewing coding conventions in this repository. Covers code style, TypeScript rules, lint/format expectations, file split rules, method design rules, error handling, and testing priorities.
---

# SDD Engineering Conventions

Use this skill whenever the task involves code conventions, file organization, method boundaries, naming, error handling style, or testing expectations in this repository.

## Source documents

Read these first:

- `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/07-engineering-conventions.md`
- `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/06-design-patterns.md`
- `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/02-architecture.md`

## Core rules

- Use TypeScript only.
- Assume strict TypeScript.
- Do not use default exports.
- Do not create giant utility files.
- Do not let renderer access file system or `.sdd` details directly.
- Cross-feature access should go through public APIs only.
- Keep domain rules out of repositories.
- Validate storage schema at repository read boundaries.

## File split rules

- One file should have one main reason to change.
- Split files once UI, domain rule, persistence, and transport concerns mix together.
- Keep feature folders cohesive and expose a small public surface.
- Prefer explicit names over vague `helpers`, `common`, `misc`, `utils`.
- A renderer page file should usually assemble subcomponents and wire hooks, not contain the full UI, all handlers, all derived state, and all helper logic at once.
- When a screen grows, split into `components`, `types`, `constants`, and `utils` before it becomes hard to review.
- Feature-local hooks should own async UI workflows and derived view state when that keeps presentational components simple.

## Method rules

- A method should have one clear responsibility.
- Split methods when validation, orchestration, persistence, and formatting are all mixed together.
- Prefer object parameters once inputs stop being simple.
- Keep side effects near the boundary and business decisions in application/domain layers.
- Return explicit result shapes for use cases.
- Avoid passing object methods directly to JSX props if lint rules treat them as unbound; wrap them in local arrow handlers at the page boundary.

## Error handling rules

- Use case boundaries should return predictable `AppError`-style failures.
- Infrastructure may catch and convert raw exceptions.
- UI should receive user-safe error information, not internal stack details.

## UI/UX conventions

- Use Korean-first user-facing text unless there is a strong reason not to.
- Prefer concise labels and hide implementation details from end users.
- Do not surface internal roadmap, future extensibility, transport choices, or other engineering-facing detail in the main UI copy.
- Keep user-facing explanations centered on the action the user can take now; move internal background to docs.
- Do not reorder visible lists as a side effect of selection.
- If a list order is user-meaningful, store and preserve that order explicitly.

## Format and lint expectations

- Follow the repository TypeScript, ESLint, and Prettier setup once added.
- Convention documents are the source of truth until config files exist.
- If code and convention docs diverge, update both in the same task or explain why not.

## Testing priority

1. domain/state transition
2. use case
3. repository integration
4. IPC contract
5. Electron E2E
6. component test

## When to use this skill

Use it for:

- new module scaffolding
- refactor reviews
- naming and file split decisions
- method extraction decisions
- lint/format config work
- code review against repository standards

## When changing conventions

If you change conventions, update:

- `07-engineering-conventions.md`
- `06-design-patterns.md` when pattern expectations change
- `AGENTS.md`
