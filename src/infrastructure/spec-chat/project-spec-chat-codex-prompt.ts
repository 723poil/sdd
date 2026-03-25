import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
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
  const specVersion = escapeXml(input.spec.meta.latestVersion);
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
    '    <instruction>Continue the spec-scoped conversation and answer the latest user message in Korean.</instruction>',
    '    <goal>Help the user refine, review, and clarify the selected spec without pretending that files were already changed.</goal>',
    '  </task>',
    '  <inputs>',
    '    <input path=".sdd/analysis/summary.md">Optional project summary the agent may inspect for repository context.</input>',
    '    <input path=".sdd/analysis/context.json">Optional structured project context the agent may inspect when it needs architecture or file hints.</input>',
    '    <input path=".sdd/analysis/file-index.json">Optional indexed file references the agent may inspect when it needs exact paths or related files.</input>',
    '    <current_spec>',
    `      <status>${specStatus}</status>`,
    `      <version>${specVersion}</version>`,
    `      <summary>${specSummary}</summary>`,
    `      <markdown>${specMarkdown}</markdown>`,
    '    </current_spec>',
    '    <conversation_history>',
    conversationHistory,
    '    </conversation_history>',
    '  </inputs>',
    '  <workflow>',
    '    <stage id="analysis">Read the current spec and recent conversation first. Inspect repository files or saved analysis artifacts only when the user question depends on concrete implementation evidence, exact file paths, or architecture constraints.</stage>',
    '    <stage id="execution">Answer the latest user turn directly, using the spec as the current source of truth. If the user asks for spec changes, explain the concrete proposal, what sections would change, and what is still uncertain.</stage>',
    '    <stage id="verification">Check that the reply is grounded in the provided spec and repository context, does not invent file changes or completed work, and clearly marks uncertainty instead of guessing.</stage>',
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
    '    <field_guidance field="reply">One assistant reply for the user-facing chat. Keep it concise, grounded, and useful for spec work. Plain text is sufficient.</field_guidance>',
    '  </output_contract>',
    '</spec_chat_request>',
  ].join('\n');
}

export function createProjectSpecChatOutputSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['reply'],
    properties: {
      reply: {
        type: 'string',
      },
    },
  };
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
