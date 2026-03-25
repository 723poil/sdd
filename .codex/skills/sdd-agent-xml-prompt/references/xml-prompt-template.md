# XML Prompt Template

Use this as a starting skeleton when creating a new repository-facing agent prompt.

```xml
<request_name>
  <task>
    <project_name>...</project_name>
    <instruction>...</instruction>
    <goal>...</goal>
  </task>

  <inputs>
    <input path="...">...</input>
    <input path="...">...</input>
  </inputs>

  <workflow>
    <stage id="analysis">Inspect the real repository or input artifacts first and identify the relevant structure, uncertainty, or evidence.</stage>
    <stage id="execution">Perform the requested generation, transformation, or synthesis using the inspected evidence.</stage>
    <stage id="verification">Validate coverage, schema, exact paths, and rule compliance before returning the final answer.</stage>
  </workflow>

  <delegation>
    <policy>If the repository is large or the task splits naturally, proactively use subagents when available.</policy>
    <preferred_split>...</preferred_split>
    <preferred_split>...</preferred_split>
    <merge_requirement>Merge delegated findings into one final result yourself.</merge_requirement>
    <output_requirement>Do not mention delegation or subagents in the output.</output_requirement>
  </delegation>

  <constraints>
    <constraint>Inspect the actual codebase or provided artifacts.</constraint>
    <constraint>Use exact relative paths that already exist when paths matter.</constraint>
    <constraint>Do not invent files, modules, flows, or conclusions without evidence.</constraint>
    <constraint>Keep the final output high signal.</constraint>
  </constraints>

  <output_contract>
    <format>json_or_markdown</format>
    <schema_requirement>Return only the requested format and match the provided schema exactly when a schema is supplied.</schema_requirement>
    <field_guidance field="...">...</field_guidance>
    <field_guidance field="...">...</field_guidance>
  </output_contract>
</request_name>
```

## Adaptation notes

- Rename the top-level tag to the actual task.
- Keep the workflow stage ids exactly `analysis`, `execution`, `verification`.
- If the output is structured, add or update the schema in code next to the prompt.
- If the task is human-readable Markdown, replace `field_guidance` with concrete section expectations.
- If the task has critical failure modes, add explicit verification checks for them.
