import type {
  AgentCliAuthMode,
  AgentCliCommandMode,
  AgentCliConnectionCheck,
  AgentCliConnectionRecord,
} from '@/domain/app-settings/agent-cli-connection-model';

export function describeAgentCliCommandMode(commandMode: AgentCliCommandMode): string {
  return commandMode === 'custom' ? '직접 지정' : '시스템 기본값';
}

export function describeAgentCliAuthMode(authMode: AgentCliAuthMode): string {
  return authMode === 'api-key' ? 'API key' : 'ChatGPT 로그인';
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
