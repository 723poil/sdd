import {
  PROJECT_SPEC_TEMPLATE_SECTION_TITLES,
  type ProjectSpecDocument,
} from '@/domain/project/project-spec-model';
import type { ProjectSessionMessage } from '@/domain/project/project-session-model';

const MAX_PROMPT_MESSAGE_COUNT = 24;
const MAX_PROMPT_HISTORY_CHARACTERS = 12_000;

export function createProjectSpecChatPrompt(input: {
  projectName: string;
  sessionMessages: ProjectSessionMessage[];
  spec: ProjectSpecDocument;
}): string {
  const projectName = escapeXml(input.projectName);
  const specTitle = escapeXml(input.spec.meta.title);
  const specStatus = escapeXml(describeSpecStatus(input.spec.meta.status));
  const specVersion = escapeXml(input.spec.meta.currentVersion ?? 'draft');
  const specSummary = escapeXml(input.spec.meta.summary ?? '요약 없음');
  const specMarkdown = escapeXml(input.spec.markdown);
  const conversationHistory = renderConversationHistory(
    selectPromptMessages(input.sessionMessages),
  );

  return [
    '<spec_chat_request>',
    '  <task>',
    `    <project_name>${projectName}</project_name>`,
    `    <spec_title>${specTitle}</spec_title>`,
    '    <instruction>Continue the spec-scoped conversation in Korean and update the current spec draft together with the user.</instruction>',
    '    <goal>Use the chat to maintain a concrete working spec that the user can keep editing directly, instead of returning a chat reply only.</goal>',
    '  </task>',
    '  <inputs>',
    '    <input path=".sdd/analysis/summary.md">Optional project summary the agent may inspect for repository context.</input>',
    '    <input path=".sdd/analysis/context.json">Optional structured project context the agent may inspect when it needs architecture or file hints.</input>',
    '    <input path=".sdd/analysis/file-index.json">Optional indexed file references the agent may inspect when it needs exact paths or related files.</input>',
    '    <input path=".sdd/analysis/manual-reference-tags.json">Optional saved reference-tag catalog and file assignments for the reference map.</input>',
    '    <input path="AGENTS.md">Optional project-specific instructions and skill index. Inspect it when present.</input>',
    '    <input path=".codex/skills">Optional project skill directory. Inspect relevant SKILL.md files when present.</input>',
    '    <current_spec>',
      `      <status>${specStatus}</status>`,
      `      <version>${specVersion}</version>`,
      `      <summary>${specSummary}</summary>`,
      `      <markdown>${specMarkdown}</markdown>`,
    '    </current_spec>',
    '    <spec_template>',
    renderSpecTemplateSections(),
    '    </spec_template>',
    '    <conversation_history>',
    conversationHistory,
    '    </conversation_history>',
    '  </inputs>',
    '  <workflow>',
    '    <stage id="analysis">Read the current spec and recent conversation first. Inspect .sdd analysis artifacts, saved reference tags, AGENTS.md, and project skill files when they matter for the requested feature, affected scope, reference tags, skill selection, or implementation impact. Use the reference map evidence to determine likely impacted files and flows instead of guessing.</stage>',
    '    <stage id="execution">Produce one user-facing chat reply and one updated full spec draft. Keep the spec in the fixed template structure, revise the title and markdown when the conversation changes the plan, list relevant existing reference tags, propose new tags when the capability does not fit existing ones, and update the impact-analysis and project-skill sections using real repository evidence when available.</stage>',
    '    <stage id="verification">Check that the updated spec keeps the required sections, that impact analysis is grounded in file-index, file references, or saved reference tags when possible, that project skills come from AGENTS.md or .codex/skills when present, and that uncertainty is labeled clearly instead of invented facts.</stage>',
    '  </workflow>',
    '  <delegation>',
    '    <policy>If the repository is large or the question naturally splits by feature or validation pass, use subagents when available.</policy>',
    '    <preferred_split>repository inspection for concrete file evidence</preferred_split>',
    '    <preferred_split>validation of spec impact or missing constraints</preferred_split>',
    '    <merge_requirement>Merge delegated findings into one final reply yourself.</merge_requirement>',
    '    <output_requirement>Do not mention delegation or subagents in the reply.</output_requirement>',
    '  </delegation>',
    '  <constraints>',
    '    <constraint>Answer in Korean.</constraint>',
    '    <constraint>Use the current spec markdown and recent conversation as the primary context.</constraint>',
    '    <constraint>The returned markdown must be a full spec document, not a patch note or fragment.</constraint>',
    '    <constraint>Always keep the spec in this section order: 요약, 배경 / 문제, 목표, 비목표, 사용자 시나리오, 기능 요구사항, 비기능 요구사항, 참조 태그, 영향도 분석, 사용 스킬, 수용 기준, 오픈 질문.</constraint>',
    '    <constraint>The 참조 태그 section must list existing relevant tags when evidence exists. If the requested capability is not represented well by existing tags, add a clearly marked proposed tag.</constraint>',
    '    <constraint>The 영향도 분석 section must reference impacted files, layers, flows, or modules using saved analysis data when available.</constraint>',
    '    <constraint>The 사용 스킬 section must state which project-defined skills should be used for this spec, based on AGENTS.md or .codex/skills when available.</constraint>',
    '    <constraint>Do not claim that the spec file or codebase was already edited unless the user explicitly says it was changed.</constraint>',
    '    <constraint>If exact repository evidence matters, inspect the real repository or saved analysis files instead of guessing.</constraint>',
    '    <constraint>When naming files, use exact relative paths that already exist.</constraint>',
    '    <constraint>If the user request is ambiguous, state the key uncertainty briefly and still provide the most practical next answer.</constraint>',
    '    <constraint>Keep the reply high signal. Prefer short paragraphs or flat bullets over long essays.</constraint>',
    '    <constraint>Avoid roadmap commentary, transport details, or internal implementation chatter unless the user explicitly asks for them.</constraint>',
    '  </constraints>',
    '  <output_contract>',
    '    <format>json</format>',
    '    <schema_requirement>Return JSON only and match the provided schema exactly.</schema_requirement>',
    '    <field_guidance field="reply">One assistant reply for the user-facing chat. Keep it concise, grounded, and useful for collaborative spec writing. Plain text is sufficient.</field_guidance>',
    '    <field_guidance field="title">Updated spec title. Reflect the current feature or change goal clearly.</field_guidance>',
    '    <field_guidance field="summary">Short summary used in the spec list. One or two short sentences.</field_guidance>',
    '    <field_guidance field="markdown">Full updated spec markdown that follows the required template and includes reference tags, impact analysis, and project skills.</field_guidance>',
    '  </output_contract>',
    '</spec_chat_request>',
  ].join('\n');
}

export function createProjectSpecChatOutputSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['reply', 'title', 'summary', 'markdown'],
    properties: {
      reply: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
      summary: {
        type: 'string',
      },
      markdown: {
        type: 'string',
      },
    },
  };
}

function renderSpecTemplateSections(): string {
  return PROJECT_SPEC_TEMPLATE_SECTION_TITLES.map(
    (sectionTitle) => `      <section title="${escapeXml(sectionTitle)}" />`,
  ).join('\n');
}

function selectPromptMessages(messages: ProjectSessionMessage[]): ProjectSessionMessage[] {
  const recentMessages = messages.slice(-MAX_PROMPT_MESSAGE_COUNT);
  const selected: ProjectSessionMessage[] = [];
  let totalCharacters = 0;

  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const message = recentMessages[index];
    if (!message) {
      continue;
    }

    const nextCharacters = totalCharacters + message.text.length;
    if (selected.length > 0 && nextCharacters > MAX_PROMPT_HISTORY_CHARACTERS) {
      break;
    }

    selected.unshift(message);
    totalCharacters = nextCharacters;
  }

  return selected;
}

function renderConversationHistory(messages: ProjectSessionMessage[]): string {
  if (messages.length === 0) {
    return '      <message role="system" created_at="">대화 이력이 없습니다.</message>';
  }

  return messages
    .map(
      (message) =>
        `      <message role="${message.role}" created_at="${escapeXml(message.createdAt)}">${escapeXml(message.text)}</message>`,
    )
    .join('\n');
}

function describeSpecStatus(status: ProjectSpecDocument['meta']['status']): string {
  switch (status) {
    case 'draft':
      return 'draft';
    case 'approved':
      return 'approved';
    case 'archived':
      return 'archived';
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
