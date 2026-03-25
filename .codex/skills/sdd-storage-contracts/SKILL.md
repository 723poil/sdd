---
name: sdd-storage-contracts
description: Use when modifying .sdd storage, spec versions, patch application, chat logs, run files, or schema contracts in this repository. Covers source of truth, event-log rules, schemaVersion, revision, and recovery behavior.
---

# SDD Storage Contracts

Use this skill whenever the task touches `.sdd/`, spec storage, patch persistence, chat history, or recovery rules.

## Source documents

Read these first:

- `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/04-storage-format.md`
- `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/06-design-patterns.md`
- `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/07-engineering-conventions.md`

## Fixed storage rules

- Project data is stored under `.sdd/` inside the target project.
- `analysis/context.json` and `analysis/summary.md` may exist before the first real analysis run, but that state must remain an honest empty state.
- `project.json.lastAnalyzedAt` is the baseline flag for whether a completed analysis exists.
- Project-scoped conversation sessions are stored under `.sdd/sessions/`.
- Major JSON files must include `schemaVersion`.
- Mutable metadata JSON should support `revision` or `updatedAt`.
- Repository reads must validate schema immediately.
- Writes should use atomic write.

## Session storage rules

- `sessions/index.json` is a rebuildable index for quick listing.
- The source of truth for each project session is `sessions/<session-id>/meta.json`.
- Session messages live in `sessions/<session-id>/messages.jsonl`.
- Session messages may be user-only before Codex is connected, but the UI must present that honestly.

## Source of truth rules

For each spec:

- source of truth: `specs/<spec-slug>/meta.json`
- version source: `specs/<spec-slug>/versions/*`
- rebuildable cache/index: `specs/index.json`

If `index.json` and `meta.json` disagree, trust `meta.json` and rebuild the index.

## Versioning rules

- Never overwrite old version files.
- Always create a new version file.
- `meta.json.latestVersion` points to the active version.
- `approved` means the current spec baseline selected by the user.

## Chat log rules

`chat.jsonl` is an append-only event log, not a plain message array.

Expected event types:

- `user_message`
- `assistant_message`
- `patch_proposed`
- `patch_applied`
- `patch_rejected`

Each event should be projection-friendly and patch-traceable.

## Patch application rules

- Treat patch application as command-style logic.
- Validate `baseVersion` before applying.
- Reject duplicate patch application.
- Use copy-on-write and create a new version file.
- Update `meta.json` last.

Recommended write order:

1. create new version file
2. update patch status
3. append chat event
4. update `meta.json`
5. regenerate or update `index.json`

## Recovery rules

- If intermediate files exist but `meta.json` did not move, treat the apply as failed.
- Recovery should use `meta.json.latestVersion` as the baseline.
- `index.json` may be rebuilt from spec folders.

## When changing contracts

If you change `.sdd` structure or field meanings, update these together:

- `04-storage-format.md`
- `06-design-patterns.md`
- `07-engineering-conventions.md`
