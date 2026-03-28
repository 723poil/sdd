import type {
  AgentCliConnectionCheck,
  AgentCliConnectionSettings,
  AgentCliId,
} from '@/domain/app-settings/agent-cli-connection-model';
import type { Result } from '@/shared/contracts/result';

export interface AgentCliSettingsPort {
  listAgentCliConnections(): Promise<Result<AgentCliConnectionSettings[]>>;
  readSelectedAgentCli(): Promise<Result<AgentCliId>>;
  saveAgentCliConnection(
    input: AgentCliConnectionSettings,
  ): Promise<Result<AgentCliConnectionSettings>>;
  saveSelectedAgentCli(input: { agentId: AgentCliId }): Promise<Result<AgentCliId>>;
}

export interface AgentCliRuntimePort {
  checkAgentCliConnection(input: {
    agentId: AgentCliId;
    executablePath: string | null;
  }): Promise<Result<AgentCliConnectionCheck>>;
}
