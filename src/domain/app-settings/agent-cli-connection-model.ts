export const APP_SETTINGS_SCHEMA_VERSION = 3;

export const AGENT_CLI_IDS = ['codex'] as const;
export type AgentCliId = (typeof AGENT_CLI_IDS)[number];

export const AGENT_CLI_COMMAND_MODES = ['system', 'custom'] as const;
export type AgentCliCommandMode = (typeof AGENT_CLI_COMMAND_MODES)[number];

export const AGENT_CLI_AUTH_MODES = ['chatgpt', 'api-key'] as const;
export type AgentCliAuthMode = (typeof AGENT_CLI_AUTH_MODES)[number];

export const AGENT_CLI_MODEL_REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;
export type AgentCliModelReasoningEffort =
  (typeof AGENT_CLI_MODEL_REASONING_EFFORTS)[number];

export const AGENT_CLI_MODEL_OPTIONS = [
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
  'gpt-5.3-codex-spark',
  'gpt-5.2',
  'gpt-5.2-codex',
] as const;

export const AGENT_CLI_TRANSPORTS = ['exec', 'app-server', 'mcp-server'] as const;
export type AgentCliTransport = (typeof AGENT_CLI_TRANSPORTS)[number];

export interface AgentCliConnectionDefinition {
  agentId: AgentCliId;
  displayName: string;
  description: string;
  defaultExecutableName: string;
  connectionCheckArgs: string[];
  recommendedTransport: AgentCliTransport;
  futureTransports: AgentCliTransport[];
  supportedAuthModes: AgentCliAuthMode[];
}

export interface AgentCliConnectionSettings {
  agentId: AgentCliId;
  commandMode: AgentCliCommandMode;
  executablePath: string | null;
  authMode: AgentCliAuthMode;
  model: string;
  modelReasoningEffort: AgentCliModelReasoningEffort;
  updatedAt: string | null;
}

export interface AgentCliConnectionRecord {
  definition: AgentCliConnectionDefinition;
  settings: AgentCliConnectionSettings;
}

export type AgentCliConnectionCheckStatus = 'ready' | 'missing' | 'error';

export interface AgentCliConnectionCheck {
  agentId: AgentCliId;
  status: AgentCliConnectionCheckStatus;
  message: string;
  checkedAt: string;
  resolvedCommand: string | null;
  version: string | null;
}

const AGENT_CLI_CONNECTION_DEFINITIONS: ReadonlyArray<AgentCliConnectionDefinition> = [
  {
    agentId: 'codex',
    displayName: 'Codex CLI',
    description: 'Codex CLI 실행 위치와 인증 방식을 설정하세요.',
    defaultExecutableName: 'codex',
    connectionCheckArgs: ['--version'],
    recommendedTransport: 'exec',
    futureTransports: ['app-server', 'mcp-server'],
    supportedAuthModes: ['chatgpt', 'api-key'],
  },
];

export function listAgentCliConnectionDefinitions(): AgentCliConnectionDefinition[] {
  return [...AGENT_CLI_CONNECTION_DEFINITIONS];
}

export function findAgentCliConnectionDefinition(
  agentId: AgentCliId,
): AgentCliConnectionDefinition | null {
  return AGENT_CLI_CONNECTION_DEFINITIONS.find((definition) => definition.agentId === agentId) ?? null;
}

export function createDefaultAgentCliConnectionSettings(
  agentId: AgentCliId,
  overrides?: {
    model?: string | null;
    modelReasoningEffort?: AgentCliModelReasoningEffort | null;
  },
): AgentCliConnectionSettings {
  return {
    agentId,
    commandMode: 'system',
    executablePath: null,
    authMode: 'chatgpt',
    model: normalizeModel(overrides?.model),
    modelReasoningEffort: normalizeModelReasoningEffort(overrides?.modelReasoningEffort),
    updatedAt: null,
  };
}

export function createAgentCliConnectionSettings(input: {
  agentId: AgentCliId;
  commandMode: AgentCliCommandMode;
  executablePath: string | null;
  authMode: AgentCliAuthMode;
  model?: string | null;
  modelReasoningEffort?: AgentCliModelReasoningEffort | null;
  updatedAt: string | null;
}): AgentCliConnectionSettings {
  const executablePath =
    input.commandMode === 'custom'
      ? normalizeExecutablePath(input.executablePath)
      : null;

  return {
    agentId: input.agentId,
    commandMode: input.commandMode,
    executablePath,
    authMode: input.authMode,
    model: normalizeModel(input.model),
    modelReasoningEffort: normalizeModelReasoningEffort(input.modelReasoningEffort),
    updatedAt: input.updatedAt,
  };
}

export function isAgentCliConnectionSettings(value: unknown): value is AgentCliConnectionSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.agentId === 'string' &&
    AGENT_CLI_IDS.includes(candidate.agentId as AgentCliId) &&
    typeof candidate.commandMode === 'string' &&
    AGENT_CLI_COMMAND_MODES.includes(candidate.commandMode as AgentCliCommandMode) &&
    (typeof candidate.executablePath === 'string' || candidate.executablePath === null) &&
    typeof candidate.authMode === 'string' &&
    AGENT_CLI_AUTH_MODES.includes(candidate.authMode as AgentCliAuthMode) &&
    (typeof candidate.model === 'string' || typeof candidate.model === 'undefined') &&
    (typeof candidate.modelReasoningEffort === 'undefined' ||
      AGENT_CLI_MODEL_REASONING_EFFORTS.includes(
        candidate.modelReasoningEffort as AgentCliModelReasoningEffort,
      )) &&
    (typeof candidate.updatedAt === 'string' || candidate.updatedAt === null)
  );
}

export function isAgentCliModelReasoningEffort(
  value: unknown,
): value is AgentCliModelReasoningEffort {
  return (
    typeof value === 'string' &&
    AGENT_CLI_MODEL_REASONING_EFFORTS.includes(value as AgentCliModelReasoningEffort)
  );
}

function normalizeExecutablePath(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';

  return trimmed.length > 0 ? trimmed : null;
}

function normalizeModel(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';

  return trimmed.length > 0 ? trimmed : 'gpt-5.4';
}

function normalizeModelReasoningEffort(
  value: AgentCliModelReasoningEffort | null | undefined,
): AgentCliModelReasoningEffort {
  return isAgentCliModelReasoningEffort(value) ? value : 'xhigh';
}
