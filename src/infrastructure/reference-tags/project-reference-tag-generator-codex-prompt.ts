export function createProjectReferenceTagGeneratorPrompt(input: {
  fileCount: number;
  projectName: string;
}): string {
  const fileCount = String(input.fileCount);
  const projectName = escapeXml(input.projectName);

  return [
    '<reference_tag_generation_request>',
    '  <task>',
    `    <project_name>${projectName}</project_name>`,
    '    <instruction>Generate reusable file tags for the repository and assign them to every indexed file.</instruction>',
    '    <goal>Produce a practical tag catalog the app can use to group related files in the reference map and to isolate concrete implementation scopes.</goal>',
    '  </task>',
    '  <inputs>',
    '    <input path=".sdd/analysis/file-index.json">Primary source of indexed files, roles, categories, summaries, and references.</input>',
    '    <input path=".sdd/analysis/context.json">Supporting source for directory, layer, and architecture context.</input>',
    '    <input path=".sdd/analysis/summary.md">Optional high-level analysis summary for terminology alignment.</input>',
    `    <expected_file_count>${fileCount}</expected_file_count>`,
    '  </inputs>',
    '  <workflow>',
    '    <stage id="analysis">Read the indexed analysis files first, inspect representative repository files when needed, and identify concrete user tasks, domain actions, bounded workflows, or subsystem responsibilities before proposing any tags. Prefer capabilities that could stand on their own as a focused implementation or review scope.</stage>',
    '    <stage id="execution">Create a tag set at the feature or work-unit level and assign every indexed file to one or more tags based on actual responsibility, feature boundary, or workflow involvement. Split broad surfaces such as admin or operations into narrower capabilities whenever the code supports it, and separate distinct lifecycle steps when the code paths are materially different.</stage>',
    '    <stage id="verification">Verify that every returned path exists in .sdd/analysis/file-index.json, every indexed file is covered by at least one tag, and no tag remains so broad that it hides distinct work scopes that should be separated. Reject tags that are too vague to guide one coherent implementation or review task.</stage>',
    '  </workflow>',
    '  <delegation>',
    '    <policy>If the repository is large or the concerns split naturally, proactively use subagents when available.</policy>',
    '    <preferred_split>analysis of major feature clusters</preferred_split>',
    '    <preferred_split>assignment of infrastructure or shared files</preferred_split>',
    '    <preferred_split>verification of full file coverage</preferred_split>',
    '    <merge_requirement>Merge delegated findings into one final JSON result yourself.</merge_requirement>',
    '    <output_requirement>Do not mention delegation or subagents in the output.</output_requirement>',
    '  </delegation>',
    '  <constraints>',
    '    <constraint>Inspect the actual repository when the analysis files are not sufficient.</constraint>',
    '    <constraint>Use exact relative paths that already exist in .sdd/analysis/file-index.json.</constraint>',
    '    <constraint>Do not invent files, tags, or feature boundaries without evidence.</constraint>',
    '    <constraint>Every indexed file must appear in at least one tag.</constraint>',
    '    <constraint>Prefer 1-3 tags per file.</constraint>',
    '    <constraint>Start from concrete features, domain actions, policies, approval flows, synchronization jobs, reporting slices, or bounded internal workflows before considering broader organizational areas.</constraint>',
    '    <constraint>Choose tags at roughly the size of one meaningful implementation ticket or one coherent review scope. If a tag still represents multiple deliverable units, split it further.</constraint>',
    '    <constraint>If one proposed tag would contain files serving multiple distinct tasks, split it into narrower reusable tags instead of keeping one umbrella label.</constraint>',
    '    <constraint>If create, update, delete, review, approve, reject, import, export, search, sync, reconcile, or notify paths are implemented separately, prefer separate tags for those capabilities rather than one broader feature label.</constraint>',
    '    <constraint>Do not keep the total tag count artificially low. Use as many reusable tags as needed to reflect real feature or workflow boundaries, and merge only when two tags truly represent the same responsibility.</constraint>',
    '    <constraint>Prefer concern-oriented tags such as feature, workflow, runtime area, or shared capability, but make them specific enough to guide implementation or review work.</constraint>',
    '    <constraint>Avoid umbrella labels such as 어드민 운영, 관리자 기능, 백오피스, 공통 기능, 지원 기능, 기타, misc, or management unless the repository genuinely has no defensible finer split.</constraint>',
    '    <constraint>When an admin or backoffice surface exists, subdivide it by the real responsibility in code such as approval, review, permission, policy, pricing, settlement, reconciliation, import, export, notification, analytics, audit, or search when supported by evidence.</constraint>',
    '    <constraint>Prefer labels that read like concrete capabilities such as 승인 처리, 권한 정책, 알림 발송, 검색 인덱싱, 리포트 집계, 정산 검증, 가져오기 동기화 rather than department-like buckets.</constraint>',
    '    <constraint>Use shared or infrastructure-oriented tags only for files that truly cross multiple capabilities and cannot be defensibly attached to one primary feature tag.</constraint>',
    '    <constraint>Avoid tags that only restate file extensions, framework names, or raw directory names unless they represent a real subsystem.</constraint>',
    '    <constraint>Keep labels short and reusable. Write them in Korean when natural, but preserve domain or product terms when that is more precise.</constraint>',
    '    <constraint>Descriptions should be one short sentence and explain the concrete responsibility or work scope the tag isolates.</constraint>',
    '  </constraints>',
    '  <output_contract>',
    '    <format>json</format>',
    '    <schema_requirement>Return JSON only and match the provided schema exactly.</schema_requirement>',
    '    <field_guidance field="tags">Each item represents one reusable tag group. Bias toward narrow capability tags that help someone choose a focused implementation slice.</field_guidance>',
    '    <field_guidance field="tags[].label">Short reusable tag label that names a concrete feature, workflow, or bounded responsibility, not an umbrella organization area. Prefer capability-level phrasing over department-style phrasing.</field_guidance>',
    '    <field_guidance field="tags[].description">Short explanation of the concrete responsibility or workflow the tag groups.</field_guidance>',
    '    <field_guidance field="tags[].paths">Exact relative paths assigned to that tag.</field_guidance>',
    '  </output_contract>',
    '</reference_tag_generation_request>',
  ].join('\n');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function createProjectReferenceTagGeneratorOutputSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['tags'],
    properties: {
      tags: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['label', 'description', 'paths'],
          properties: {
            label: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
            paths: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  };
}
