export const APP_SETTINGS_SCHEMA_VERSION = 4;
export const DEFAULT_AGENT_CLI_ID = 'codex';

export const AGENT_CLI_IDS = ['codex', 'claude-code', 'gemini-cli'] as const;
export type AgentCliId = (typeof AGENT_CLI_IDS)[number];

export const AGENT_CLI_COMMAND_MODES = ['system', 'custom'] as const;
export type AgentCliCommandMode = (typeof AGENT_CLI_COMMAND_MODES)[number];

export const AGENT_CLI_AUTH_MODES = [
  'chatgpt',
  'claude',
  'anthropic-console',
  'google',
  'api-key',
  'vertex-ai',
] as const;
export type AgentCliAuthMode = (typeof AGENT_CLI_AUTH_MODES)[number];

export const AGENT_CLI_MODEL_REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;
export type AgentCliModelReasoningEffort =
  (typeof AGENT_CLI_MODEL_REASONING_EFFORTS)[number];

export const AGENT_CLI_TRANSPORTS = ['exec', 'app-server', 'mcp-server'] as const;
export type AgentCliTransport = (typeof AGENT_CLI_TRANSPORTS)[number];

export const AGENT_CLI_FEATURE_IDS = [
  'project-analysis',
  'reference-tags',
  'spec-chat',
  'model-selection',
  'reasoning-effort',
] as const;
export type AgentCliFeatureId = (typeof AGENT_CLI_FEATURE_IDS)[number];

export interface AgentCliCapabilities {
  projectAnalysis: boolean;
  referenceTags: boolean;
  specChat: boolean;
  modelSelection: boolean;
  reasoningEffort: boolean;
}

export interface AgentCliConnectionDefinition {
  agentId: AgentCliId;
  displayName: string;
  description: string;
  defaultExecutableName: string;
  connectionCheckArgs: string[];
  recommendedTransport: AgentCliTransport;
  futureTransports: AgentCliTransport[];
  supportedAuthModes: AgentCliAuthMode[];
  capabilities: AgentCliCapabilities;
  modelOptions: string[];
  defaultModel: string;
  defaultModelReasoningEffort: AgentCliModelReasoningEffort;
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

export interface AgentCliSettingsSnapshot {
  selectedAgentId: AgentCliId;
  connections: AgentCliConnectionRecord[];
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
    description: 'OpenAI Codex CLI 연결을 저장하고 분석과 채팅에 사용합니다.',
    defaultExecutableName: 'codex',
    connectionCheckArgs: ['--version'],
    recommendedTransport: 'exec',
    futureTransports: ['app-server', 'mcp-server'],
    supportedAuthModes: ['chatgpt', 'api-key'],
    capabilities: {
      projectAnalysis: true,
      referenceTags: true,
      specChat: true,
      modelSelection: true,
      reasoningEffort: true,
    },
    modelOptions: [
      'gpt-5.4',
      'gpt-5.4-mini',
      'gpt-5.3-codex',
      'gpt-5.3-codex-spark',
      'gpt-5.2',
      'gpt-5.2-codex',
    ],
    defaultModel: 'gpt-5.4',
    defaultModelReasoningEffort: 'xhigh',
  },
  {
    agentId: 'claude-code',
    displayName: 'Claude Code',
    description: 'Anthropic Claude Code 연결을 저장하고 분석과 채팅에 사용합니다.',
    defaultExecutableName: 'claude',
    connectionCheckArgs: ['--version'],
    recommendedTransport: 'exec',
    futureTransports: [],
    supportedAuthModes: ['claude', 'anthropic-console', 'api-key'],
    capabilities: {
      projectAnalysis: true,
      referenceTags: true,
      specChat: true,
      modelSelection: true,
      reasoningEffort: false,
    },
    modelOptions: ['sonnet', 'opus'],
    defaultModel: 'sonnet',
    defaultModelReasoningEffort: 'high',
  },
  {
    agentId: 'gemini-cli',
    displayName: 'Gemini CLI',
    description: 'Google Gemini CLI 연결을 저장하고 명세 채팅에 사용합니다.',
    defaultExecutableName: 'gemini',
    connectionCheckArgs: ['--version'],
    recommendedTransport: 'exec',
    futureTransports: [],
    supportedAuthModes: ['google', 'api-key', 'vertex-ai'],
    capabilities: {
      projectAnalysis: false,
      referenceTags: false,
      specChat: true,
      modelSelection: true,
      reasoningEffort: false,
    },
    modelOptions: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    defaultModel: 'gemini-2.5-pro',
    defaultModelReasoningEffort: 'high',
  },
] as const;

export function listAgentCliConnectionDefinitions(): AgentCliConnectionDefinition[] {
  return [...AGENT_CLI_CONNECTION_DEFINITIONS];
}

export function listAgentCliIds(): AgentCliId[] {
  return [...AGENT_CLI_IDS];
}

export function isAgentCliId(value: unknown): value is AgentCliId {
  return typeof value === 'string' && AGENT_CLI_IDS.includes(value as AgentCliId);
}

export function findAgentCliConnectionDefinition(
  agentId: AgentCliId,
): AgentCliConnectionDefinition | null {
  return (
    AGENT_CLI_CONNECTION_DEFINITIONS.find((definition) => definition.agentId === agentId) ?? null
  );
}

export function getDefaultAgentCliId(): AgentCliId {
  return DEFAULT_AGENT_CLI_ID;
}

export function listAgentCliModelOptions(agentId: AgentCliId): string[] {
  return findAgentCliConnectionDefinition(agentId)?.modelOptions ?? [];
}

export function isAgentCliFeatureSupported(
  agentId: AgentCliId,
  featureId: AgentCliFeatureId,
): boolean {
  const capabilities = findAgentCliConnectionDefinition(agentId)?.capabilities;
  if (!capabilities) {
    return false;
  }

  switch (featureId) {
    case 'project-analysis':
      return capabilities.projectAnalysis;
    case 'reference-tags':
      return capabilities.referenceTags;
    case 'spec-chat':
      return capabilities.specChat;
    case 'model-selection':
      return capabilities.modelSelection;
    case 'reasoning-effort':
      return capabilities.reasoningEffort;
  }
}

export function describeUnsupportedAgentCliFeature(
  agentId: AgentCliId,
  featureId: Extract<AgentCliFeatureId, 'project-analysis' | 'reference-tags' | 'spec-chat'>,
): string {
  const definition = findAgentCliConnectionDefinition(agentId);
  const displayName = definition?.displayName ?? '선택한 에이전트';

  switch (featureId) {
    case 'project-analysis':
      return `${displayName}는 아직 이 앱의 전체 분석 실행을 지원하지 않습니다.`;
    case 'reference-tags':
      return `${displayName}는 아직 이 앱의 자동 태그 생성을 지원하지 않습니다.`;
    case 'spec-chat':
      return `${displayName}는 아직 이 앱의 명세 채팅을 지원하지 않습니다.`;
  }
}

export function createDefaultAgentCliConnectionSettings(
  agentId: AgentCliId,
  overrides?: {
    authMode?: AgentCliAuthMode | null;
    model?: string | null;
    modelReasoningEffort?: AgentCliModelReasoningEffort | null;
  },
): AgentCliConnectionSettings {
  const definition = findAgentCliConnectionDefinition(agentId);
  const authMode =
    definition?.supportedAuthModes.includes(overrides?.authMode as AgentCliAuthMode) &&
    overrides?.authMode
      ? overrides.authMode
      : (definition?.supportedAuthModes[0] ?? 'api-key');

  return {
    agentId,
    commandMode: 'system',
    executablePath: null,
    authMode,
    model: normalizeModel(agentId, overrides?.model),
    modelReasoningEffort: normalizeModelReasoningEffort(agentId, overrides?.modelReasoningEffort),
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
  const definition = findAgentCliConnectionDefinition(input.agentId);
  const executablePath =
    input.commandMode === 'custom' ? normalizeExecutablePath(input.executablePath) : null;
  const authMode = definition?.supportedAuthModes.includes(input.authMode)
    ? input.authMode
    : (definition?.supportedAuthModes[0] ?? 'api-key');

  return {
    agentId: input.agentId,
    commandMode: input.commandMode,
    executablePath,
    authMode,
    model: normalizeModel(input.agentId, input.model),
    modelReasoningEffort: normalizeModelReasoningEffort(
      input.agentId,
      input.modelReasoningEffort,
    ),
    updatedAt: input.updatedAt,
  };
}

export function isAgentCliConnectionSettings(value: unknown): value is AgentCliConnectionSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    isAgentCliId(candidate.agentId) &&
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

function normalizeModel(agentId: AgentCliId, value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length > 0) {
    return trimmed;
  }

  return findAgentCliConnectionDefinition(agentId)?.defaultModel ?? '';
}

function normalizeModelReasoningEffort(
  agentId: AgentCliId,
  value: AgentCliModelReasoningEffort | null | undefined,
): AgentCliModelReasoningEffort {
  if (isAgentCliModelReasoningEffort(value)) {
    return value;
  }

  return findAgentCliConnectionDefinition(agentId)?.defaultModelReasoningEffort ?? 'high';
}
