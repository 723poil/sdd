import type {
  AgentCliAuthMode,
  AgentCliCommandMode,
  AgentCliConnectionCheck,
  AgentCliConnectionRecord,
  AgentCliId,
  AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';
import {
  AGENT_CLI_MODEL_REASONING_EFFORTS,
  listAgentCliModelOptions,
} from '@/domain/app-settings/agent-cli-connection-model';

import type { AgentCliConnectionDraft } from '@/renderer/features/agent-cli-settings/types';

export const AGENT_CLI_REASONING_EFFORT_OPTIONS = [...AGENT_CLI_MODEL_REASONING_EFFORTS];

export function describeAgentCliCommandMode(commandMode: AgentCliCommandMode): string {
  return commandMode === 'custom' ? '직접 지정' : '시스템 기본값';
}

export function describeAgentCliAuthMode(authMode: AgentCliAuthMode): string {
  switch (authMode) {
    case 'chatgpt':
      return 'ChatGPT 로그인';
    case 'claude':
      return 'Claude 로그인';
    case 'anthropic-console':
      return 'Anthropic Console';
    case 'google':
      return 'Google 로그인';
    case 'api-key':
      return 'API key';
    case 'vertex-ai':
      return 'Vertex AI';
  }
}

export function describeAgentCliModel(model: string): string {
  const knownLabels: Record<string, string> = {
    'gpt-5.4': 'GPT-5.4',
    'gpt-5.4-mini': 'GPT-5.4 Mini',
    'gpt-5.3-codex': 'GPT-5.3 Codex',
    'gpt-5.3-codex-spark': 'GPT-5.3 Codex Spark',
    'gpt-5.2': 'GPT-5.2',
    'gpt-5.2-codex': 'GPT-5.2 Codex',
    sonnet: 'Sonnet',
    opus: 'Opus',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
  };

  return knownLabels[model] ?? model;
}

export function describeAgentCliReasoningEffort(
  modelReasoningEffort: AgentCliModelReasoningEffort,
): string {
  switch (modelReasoningEffort) {
    case 'low':
      return '낮음';
    case 'medium':
      return '보통';
    case 'high':
      return '높음';
    case 'xhigh':
      return '매우 높음';
    default:
      return modelReasoningEffort;
  }
}

export function getAgentCliModelOptionsForAgent(
  agentId: AgentCliId,
  currentModel: string,
): string[] {
  const nextOptions = [currentModel, ...listAgentCliModelOptions(agentId)];
  return [...new Set(nextOptions)];
}

export function hasAgentCliConnectionDraftChanges(
  connection: AgentCliConnectionRecord,
  draft: AgentCliConnectionDraft,
): boolean {
  return (
    connection.settings.commandMode !== draft.commandMode ||
    (connection.settings.executablePath ?? '') !== draft.executablePath ||
    connection.settings.authMode !== draft.authMode ||
    connection.settings.model !== draft.model ||
    connection.settings.modelReasoningEffort !== draft.modelReasoningEffort
  );
}

export function describeAgentCliConnectionSummary(
  connection: AgentCliConnectionRecord,
  draft: AgentCliConnectionDraft,
): string {
  const summaryParts = [describeAgentCliCommandMode(draft.commandMode)];

  if (connection.definition.capabilities.modelSelection) {
    summaryParts.unshift(describeAgentCliModel(draft.model));
  }

  return summaryParts.join(' · ');
}

export function getAgentCliCapabilityItems(connection: AgentCliConnectionRecord): Array<{
  enabled: boolean;
  label: string;
}> {
  return [
    {
      enabled: connection.definition.capabilities.projectAnalysis,
      label: '분석',
    },
    {
      enabled: connection.definition.capabilities.referenceTags,
      label: '태그',
    },
    {
      enabled: connection.definition.capabilities.specChat,
      label: '채팅',
    },
  ];
}

export function formatSavedAt(updatedAt: string | null): string {
  if (!updatedAt) {
    return '아직 저장하지 않음';
  }

  return new Date(updatedAt).toLocaleString('ko-KR');
}

export function getConnectionCheckLabel(check: AgentCliConnectionCheck | undefined): string {
  if (!check) {
    return '미확인';
  }

  if (check.status === 'ready') {
    return '실행 가능';
  }

  if (check.status === 'missing') {
    return '경로 확인 필요';
  }

  return '확인 실패';
}

export function getConnectionCheckTone(
  check: AgentCliConnectionCheck | undefined,
): 'positive' | 'warning' | 'neutral' | 'danger' {
  if (!check) {
    return 'neutral';
  }

  if (check.status === 'ready') {
    return 'positive';
  }

  if (check.status === 'missing') {
    return 'warning';
  }

  return 'danger';
}

export function isCustomCommandMode(connection: AgentCliConnectionRecord): boolean {
  return connection.settings.commandMode === 'custom';
}
