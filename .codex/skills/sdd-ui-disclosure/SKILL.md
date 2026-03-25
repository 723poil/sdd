---
name: sdd-ui-disclosure
description: Use when designing or refining user-facing UI copy, helper text, empty states, dense inspector panels, or on-demand help behavior in this repository. Covers progressive disclosure, tooltip-first secondary help, minimal visible copy, and when guidance should stay inline.
---

# SDD UI Disclosure

Use this skill when the task is about renderer copy density, helper text placement, tooltip/help affordances, empty-state wording, or deciding what should stay visible in workspace UI.

## Source documents

Read these first:

- `/Users/723poil/git/side/sdd/AGENTS.md`
- `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/06-design-patterns.md`
- `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/07-engineering-conventions.md`

## Default rule

- Keep visible UI copy minimal.
- Default visible elements should usually be: title, current state, primary action, selected context, and critical stats.
- If the user can complete the next action without a sentence, do not keep that sentence visible by default.

## Move to on-demand help when

- the same explanation repeats across multiple cards or sections
- the text explains structure or background, not the next action
- the detail is useful only for some users or only after confusion
- the copy competes with map, spec, or chat content in a dense workspace

## Keep inline only when

- the user is blocked without it
- the text explains error recovery or validation failure
- the action is destructive or hard to undo
- the screen is a first-run or empty state and needs one clear next step

## Tooltip and secondary help rules

- Prefer a tooltip first for short clarifications.
- Tooltip help must be optional, short, task-focused, and reachable by hover and keyboard focus.
- If the content is longer or needs persistence, use a help button, collapsible help, or a secondary panel instead.
- Do not spread the same helper sentence across every card header.
- If help grows beyond two or three short sentences, move it to docs or a secondary help surface.

## Review checklist

- Can the section be understood from its title, controls, and state alone?
- Is the same explanation repeated elsewhere in the same screen?
- Would removing the sentence change the user's next action?

If the answer to the last question is `no`, remove it or move it behind an on-demand help trigger.

## Output style

When giving UI direction, explicitly classify the copy as one of:

- `keep inline`
- `move to on-demand help`
- `remove entirely`
