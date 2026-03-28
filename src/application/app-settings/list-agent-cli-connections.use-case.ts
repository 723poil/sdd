import type {
  AgentCliSettingsSnapshot,
} from '@/domain/app-settings/agent-cli-connection-model';
import {
  createDefaultAgentCliConnectionSettings,
  listAgentCliConnectionDefinitions,
} from '@/domain/app-settings/agent-cli-connection-model';
import type { Result } from '@/shared/contracts/result';
import { ok } from '@/shared/contracts/result';

import type { AgentCliSettingsPort } from '@/application/app-settings/app-settings.ports';

interface ListAgentCliConnectionsUseCase {
  execute(): Promise<Result<AgentCliSettingsSnapshot>>;
}

export function createListAgentCliConnectionsUseCase(dependencies: {
  agentCliSettingsStore: AgentCliSettingsPort;
}): ListAgentCliConnectionsUseCase {
  return {
    async execute() {
      const storedConnectionsResult =
        await dependencies.agentCliSettingsStore.listAgentCliConnections();
      if (!storedConnectionsResult.ok) {
        return storedConnectionsResult;
      }
      const selectedAgentResult = await dependencies.agentCliSettingsStore.readSelectedAgentCli();
      if (!selectedAgentResult.ok) {
        return selectedAgentResult;
      }

      const storedConnectionMap = new Map(
        storedConnectionsResult.value.map((connection) => [connection.agentId, connection]),
      );
      const connectionRecords = listAgentCliConnectionDefinitions().map((definition) => ({
        definition,
        settings:
          storedConnectionMap.get(definition.agentId) ??
          createDefaultAgentCliConnectionSettings(definition.agentId),
      }));

      return ok({
        selectedAgentId: selectedAgentResult.value,
        connections: connectionRecords,
      });
    },
  };
}
