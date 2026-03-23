---
name: sdd-codex-cli
description: Use when integrating Codex CLI into this repository. Covers exec-first integration, main-process subprocess rules, final output contracts, auth choices, and the current status of app-server and mcp-server.
---

# SDD Codex CLI

Use this skill when the task involves Codex CLI execution, subprocess management, auth decisions, or planning future Codex integration in this repository.

## Source documents

Read these first:

- `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/08-codex-cli-integration.md`
- `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/03-mvp-plan.md`
- `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/07-engineering-conventions.md`

## Fixed current policy

- MVP uses `codex exec` first.
- Codex runs from `main process`, never directly from renderer.
- Renderer talks through typed IPC only.
- Codex produces analysis/spec/patch results.
- The app writes `.sdd` files itself.

## Current connection choice

Prefer:

- `codex exec` for MVP

Possible later option:

- `codex app-server`, but treat it as an experimental/high-integration option

Lower-priority option for this repo:

- `codex mcp-server`, only if the app becomes MCP-native later

## Output contract

For `codex exec`, use this separation:

- stdout JSONL: progress and intermediate events
- `--output-last-message`: canonical final payload
- `--output-schema`: optional final shape constraint for structured output

Do not mix these responsibilities casually.

## Auth guidance

- ChatGPT login is acceptable for personal local use.
- API key becomes preferable as app-driven automation increases.

## Safety guidance

- Codex subprocess may be sandboxed/read-only for analysis work.
- `.sdd` persistence still requires app-side write access to the project.
- If the project path is read-only, do not silently pretend persistence succeeded.

## When changing Codex integration

If you change contracts or transport assumptions, update:

- `08-codex-cli-integration.md`
- `03-mvp-plan.md`
- `AGENTS.md`
