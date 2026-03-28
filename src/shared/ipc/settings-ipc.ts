import type {
  AgentCliAuthMode,
  AgentCliCommandMode,
  AgentCliConnectionCheck,
  AgentCliConnectionRecord,
  AgentCliId,
  AgentCliModelReasoningEffort,
  AgentCliSettingsSnapshot,
} from '@/domain/app-settings/agent-cli-connection-model';
import type { Result } from '@/shared/contracts/result';

export const settingsIpcChannels = {
  listAgentCliConnections: 'settings/list-agent-cli-connections',
  saveAgentCliConnection: 'settings/save-agent-cli-connection',
  checkAgentCliConnection: 'settings/check-agent-cli-connection',
  readSelectedAgentId: 'settings/read-selected-agent-id',
  saveSelectedAgentId: 'settings/save-selected-agent-id',
} as const;

export interface SaveAgentCliConnectionInput {
  agentId: AgentCliId;
  commandMode: AgentCliCommandMode;
  executablePath: string | null;
  authMode: AgentCliAuthMode;
  model?: string | null;
  modelReasoningEffort?: AgentCliModelReasoningEffort | null;
}

export interface CheckAgentCliConnectionInput {
  agentId: AgentCliId;
  commandMode: AgentCliCommandMode;
  executablePath: string | null;
  authMode: AgentCliAuthMode;
}

export interface RendererSettingsApi {
  listAgentCliConnections(): Promise<Result<AgentCliSettingsSnapshot>>;
  saveAgentCliConnection(
    input: SaveAgentCliConnectionInput,
  ): Promise<Result<AgentCliConnectionRecord>>;
  checkAgentCliConnection(
    input: CheckAgentCliConnectionInput,
  ): Promise<Result<AgentCliConnectionCheck>>;
  readSelectedAgentId(): Promise<Result<AgentCliId>>;
  saveSelectedAgentId(input: { agentId: AgentCliId }): Promise<Result<AgentCliId>>;
}
