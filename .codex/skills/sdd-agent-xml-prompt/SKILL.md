---
name: sdd-agent-xml-prompt
description: Use when writing or updating prompts for Codex exec, agent task requests, structured analysis/spec/tagging instructions, or any reusable AI prompt in this repository. Covers XML prompt contracts, mandatory analysis-execution-verification workflow, subagent/delegation guidance, and output contract design.
---

# SDD Agent XML Prompt

Use this skill when the task is about creating, refining, reviewing, or standardizing prompts that this repository sends to an agent.

## Source documents

Read these first:

- `/Users/723poil/git/side/sdd/AGENTS.md`
- `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/08-codex-cli-integration.md`
- `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/06-design-patterns.md`
- `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/07-engineering-conventions.md`

When starting from scratch or refactoring a large prompt, also read:

- `references/xml-prompt-template.md`

## Default contract

- Write the prompt as XML, not free-form prose.
- Use one clear top-level request tag such as `<project_analysis_request>` or `<reference_tag_generation_request>`.
- Prefer lowercase snake_case tag names.
- Keep XML structure readable and deterministic.
- Use exact repository paths, product terms, and runtime boundaries from the real codebase.

## Required sections

Unless there is a strong reason not to, include these sections:

- `<task>`
  - who or what the request is for
  - the concrete instruction
  - the real goal
- `<inputs>` or `<context>`
  - files, documents, or runtime facts the agent should use first
- `<workflow>`
  - always include `analysis`, `execution`, and `verification` stages in this order
- `<delegation>`
  - tell the agent to use subagents when the work splits naturally or the repository is large
  - require the main agent to merge delegated findings into one final result
  - require the final output to omit delegation chatter
- `<constraints>`
  - what the agent must inspect
  - what it must not invent
  - repository-specific safety or formatting rules
- `<output_contract>`
  - expected format
  - schema requirement when structured output is needed
  - field guidance or section guidance for the final answer

## Workflow rule

Always encode the base routine explicitly:

- `analysis`
  - inspect the real repository, documents, or input artifacts first
  - identify uncertainty before acting
- `execution`
  - perform the requested synthesis, generation, or transformation
- `verification`
  - validate coverage, schema, path correctness, and rule compliance before finalizing

Do not collapse these into one vague instruction.

## Delegation rule

Prompts should proactively allow subagent usage when it helps:

- If the repository is large or the task separates by feature, layer, or validation pass, instruct the agent to use subagents when available.
- Suggest preferred split dimensions such as feature areas, layer boundaries, or verification.
- Require one merged final output.
- Require the final output not to mention subagents, delegation, or internal coordination unless the user explicitly asked for that.

## Output design rule

- If the app consumes structured output, require JSON only and attach a schema.
- If the agent writes Markdown, specify section count, tone, and what not to repeat.
- If file paths matter, require exact relative paths that already exist.
- If verification matters, state what must be checked before returning.

## Review checklist

- Does the prompt use XML with a single top-level request tag?
- Does it include `analysis`, `execution`, and `verification` stages explicitly?
- Does it tell the agent when to use subagents?
- Does it require the main agent to merge delegated work?
- Does it hide delegation chatter from the final output?
- Does it define a concrete output contract?
- Does it forbid invented files, modules, or flows where that matters?

## When changing prompt conventions

If prompt structure or delegation expectations change, update:

- `AGENTS.md`
- `docs/codex-spec-workflow/08-codex-cli-integration.md`
- this skill
