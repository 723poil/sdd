import type {
  AgentCliConnectionCheck,
  AgentCliConnectionSettings,
  AgentCliId,
} from '@/domain/app-settings/agent-cli-connection-model';
import type { Result } from '@/shared/contracts/result';

export interface AgentCliSettingsPort {
  listAgentCliConnections(): Promise<Result<AgentCliConnectionSettings[]>>;
  saveAgentCliConnection(
    input: AgentCliConnectionSettings,
  ): Promise<Result<AgentCliConnectionSettings>>;
}

export interface AgentCliRuntimePort {
  checkAgentCliConnection(input: {
    agentId: AgentCliId;
    executablePath: string | null;
  }): Promise<Result<AgentCliConnectionCheck>>;
}
