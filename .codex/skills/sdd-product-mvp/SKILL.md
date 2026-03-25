---
name: sdd-product-mvp
description: Use when planning features, screens, scope, or product behavior for this repository. Covers the single-user local app assumptions, MVP boundaries, screen flow, and phased delivery rules.
---

# SDD Product MVP

Use this skill when the task is about product scope, feature planning, screen flow, or deciding whether work belongs in the current MVP.

## Source documents

Read these first:

- `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/01-product-overview.md`
- `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/03-mvp-plan.md`
- `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/05-risks-and-questions.md`

## Fixed assumptions

- The product is a single-user local developer tool.
- The user is the developer running the app on their own laptop.
- The app works on a local project folder.
- The app stores project-specific data inside `.sdd/`.
- Project-scoped sessions may be implemented before Codex connection as persistent conversation containers.
- MVP stops at project analysis, spec drafting, spec chat, diff review, and execution preparation.
- MVP does not include automatic code modification by Codex.
- Chat sessions are project-scoped, not global workflow stages.
- The project list order should remain stable unless the user explicitly changes it.

## Use this skill to decide

- whether a feature is in or out of MVP
- how a new screen fits into the current flow
- whether work belongs to planning or later execution phases
- whether a request changes product assumptions

## MVP boundary rules

Include by default:

- local project selection
- project analysis
- project overview
- spec draft generation
- spec editing and chat
- patch/diff review
- persistence and re-entry
- execution preparation only

Exclude by default:

- multi-user collaboration
- cloud sync
- advanced permissions
- automatic code modification
- automatic test execution
- Git-integrated execution workflow

## Screen flow reminder

The expected order is:

1. start screen
2. project selection
3. analysis progress
4. project overview
5. spec work
6. patch review
7. execution preparation

If a proposed feature does not fit this flow, justify why it is needed now.

## UI product rules

- Do not present unimplemented features as if they are already live.
- Favor a commercial-tool information architecture:
  - selected project context
  - primary current action
  - secondary side panels that may collapse
- When multiple projects are shown, switching projects should preserve list order and context predictability.
- If sessions are shown early, they should appear as part of the selected project context.
- If sessions exist before Codex is connected, present them honestly as saved conversation threads or notes, not as fake live AI responses.

## Output style

When planning, explicitly say one of:

- `Fits current MVP`
- `Better as post-MVP`
- `Changes a core assumption`

If it changes a core assumption, point to the exact document that must be updated.
