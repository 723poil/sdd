import type {
  AgentCliAuthMode,
  AgentCliCommandMode,
  AgentCliConnectionCheck,
  AgentCliConnectionRecord,
  AgentCliId,
  AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';

export interface AgentCliConnectionDraft {
  agentId: AgentCliId;
  commandMode: AgentCliCommandMode;
  executablePath: string;
  authMode: AgentCliAuthMode;
  model: string;
  modelReasoningEffort: AgentCliModelReasoningEffort;
}

export interface AgentCliSettingsViewState {
  connections: AgentCliConnectionRecord[];
  draftsByAgentId: Partial<Record<AgentCliId, AgentCliConnectionDraft>>;
  checkResultsByAgentId: Partial<Record<AgentCliId, AgentCliConnectionCheck>>;
  loadingMessage: string;
  errorMessage: string | null;
  isLoading: boolean;
  savingAgentIds: Partial<Record<AgentCliId, boolean>>;
  checkingAgentIds: Partial<Record<AgentCliId, boolean>>;
}

export interface AgentCliSettingsViewModel {
  connectionCount: number;
  hasConnections: boolean;
}

export interface AgentCliSettingsWorkbenchState extends AgentCliSettingsViewState, AgentCliSettingsViewModel {}
