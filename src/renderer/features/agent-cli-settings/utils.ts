import type {
  AgentCliAuthMode,
  AgentCliCommandMode,
  AgentCliConnectionCheck,
  AgentCliConnectionRecord,
  AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';
import {
  AGENT_CLI_MODEL_OPTIONS,
  AGENT_CLI_MODEL_REASONING_EFFORTS,
} from '@/domain/app-settings/agent-cli-connection-model';

export const AGENT_CLI_REASONING_EFFORT_OPTIONS = [...AGENT_CLI_MODEL_REASONING_EFFORTS];

export function describeAgentCliCommandMode(commandMode: AgentCliCommandMode): string {
  return commandMode === 'custom' ? '직접 지정' : '시스템 기본값';
}

export function describeAgentCliAuthMode(authMode: AgentCliAuthMode): string {
  return authMode === 'api-key' ? 'API key' : 'ChatGPT 로그인';
}

export function describeAgentCliModel(model: string): string {
  const knownLabels: Record<string, string> = {
    'gpt-5.4': 'GPT-5.4',
    'gpt-5.4-mini': 'GPT-5.4 Mini',
    'gpt-5.3-codex': 'GPT-5.3 Codex',
    'gpt-5.3-codex-spark': 'GPT-5.3 Codex Spark',
    'gpt-5.2': 'GPT-5.2',
    'gpt-5.2-codex': 'GPT-5.2 Codex',
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
  }
}

export function getAgentCliModelOptions(currentModel: string): string[] {
  const nextOptions = [currentModel, ...AGENT_CLI_MODEL_OPTIONS];
  return [...new Set(nextOptions)];
}

export function formatSavedAt(updatedAt: string | null): string {
  if (!updatedAt) {
    return '아직 저장하지 않음';
  }

  return new Date(updatedAt).toLocaleString('ko-KR');
}

export function getConnectionCheckLabel(check: AgentCliConnectionCheck | undefined): string {
  if (!check) {
    return '아직 확인하지 않았습니다.';
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
