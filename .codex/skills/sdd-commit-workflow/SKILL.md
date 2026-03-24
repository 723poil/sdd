---
name: sdd-commit-workflow
description: Use when preparing a commit in this repository. Covers commit scope review, staged vs unstaged change checks, required document sync checks, and drafting Conventional Commit messages for SDD.
---

# SDD Commit Workflow

Use this skill when the user asks to prepare a commit, review whether changes are ready to commit, draft a commit message, or actually create a commit in this repository.

## Source documents

Read these first:

- `/Users/723poil/Desktop/projects/sdd/AGENTS.md`
- `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/06-design-patterns.md`
- `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/07-engineering-conventions.md`

Read these when the touched files require them:

- storage or `.sdd` changes:
  - `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/04-storage-format.md`
- architecture or layer boundary changes:
  - `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/02-architecture.md`
- Codex integration changes:
  - `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/03-mvp-plan.md`
  - `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/08-codex-cli-integration.md`

## Commit preparation workflow

1. Inspect the worktree first.
- Run `git status --short`.
- Check both staged and unstaged changes.
- Treat staged scope as intentional only if it is coherent.

2. Separate commit scope before writing a message.
- Do not bundle unrelated feature, refactor, docs, and dependency changes into one commit if they can be split cleanly.
- If the current changes mix unrelated concerns, say so explicitly and propose the split.
- Do not assume staged files are safe to commit together without checking their intent.

3. Read focused diffs.
- Use `git diff --stat` and `git diff --cached --stat` first.
- Read only the changed files needed to understand the real intent.
- Prefer the smallest commit that preserves a coherent story.

4. Check required document sync.
- If `.sdd` structure or schema meaning changed, confirm:
  - `04-storage-format.md`
  - `06-design-patterns.md`
  - `07-engineering-conventions.md`
- If Codex integration changed, confirm:
  - `08-codex-cli-integration.md`
  - `03-mvp-plan.md`
- If architecture, IPC boundaries, or layer rules changed, confirm:
  - `02-architecture.md`
  - `06-design-patterns.md`
  - `07-engineering-conventions.md`
- If project skills were added or changed, update `AGENTS.md`.

5. Draft the commit message.
- Use Conventional Commit format.
- Prefer one best message, not many alternatives, unless asked.
- Keep the subject concise and imperative.
- Use scopes only when they improve clarity.

## Type guidance

Prefer these types:

- `feat`: new user-visible capability
- `fix`: behavior correction or bug fix
- `refactor`: structural improvement without intended behavior change
- `docs`: document-only change
- `test`: test-only change
- `chore`: maintenance, setup, or housekeeping
- `build`: dependency/build tooling change

Useful scopes in this repo:

- `renderer`
- `analysis`
- `storage`
- `session`
- `codex`
- `docs`
- `skills`

## Commit execution rules

- Do not run `git commit` unless the user explicitly asks to commit.
- Prefer non-interactive git commands only.
- Do not amend unless the user explicitly asks.
- Never hide unrelated staged changes. Call them out first.
- If verification was not run, say so instead of implying the commit is ready.

## Output style

When asked for commit help, provide:

- the proposed commit scope
- any required document follow-up
- one recommended Conventional Commit message

If the user asks to actually commit, give the message first, then create the commit with a non-interactive command.
