import type {
  AgentCliAuthMode,
  AgentCliCommandMode,
  AgentCliConnectionCheck,
  AgentCliConnectionRecord,
  AgentCliId,
  AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';
import type { Result } from '@/shared/contracts/result';

export const settingsIpcChannels = {
  listAgentCliConnections: 'settings/list-agent-cli-connections',
  saveAgentCliConnection: 'settings/save-agent-cli-connection',
  checkAgentCliConnection: 'settings/check-agent-cli-connection',
} as const;

export interface SaveAgentCliConnectionInput {
  agentId: AgentCliId;
  commandMode: AgentCliCommandMode;
  executablePath: string | null;
  authMode: AgentCliAuthMode;
  model: string;
  modelReasoningEffort: AgentCliModelReasoningEffort;
}

export interface CheckAgentCliConnectionInput {
  agentId: AgentCliId;
  commandMode: AgentCliCommandMode;
  executablePath: string | null;
  authMode: AgentCliAuthMode;
}

export interface RendererSettingsApi {
  listAgentCliConnections(): Promise<Result<AgentCliConnectionRecord[]>>;
  saveAgentCliConnection(
    input: SaveAgentCliConnectionInput,
  ): Promise<Result<AgentCliConnectionRecord>>;
  checkAgentCliConnection(
    input: CheckAgentCliConnectionInput,
  ): Promise<Result<AgentCliConnectionCheck>>;
}
