import type { AgentCliSettingsPort } from '@/application/app-settings/app-settings.ports';
import type { AgentCliConnectionSettings } from '@/domain/app-settings/agent-cli-connection-model';
import { ok } from '@/shared/contracts/result';

import {
  readAppSettingsDocument,
  writeAppSettingsDocument,
} from '@/infrastructure/app-settings/fs-app-settings-store';

export function createFsAgentCliSettingsRepository(): AgentCliSettingsPort {
  return {
    async listAgentCliConnections() {
      const settingsDocumentResult = await readAppSettingsDocument();
      if (!settingsDocumentResult.ok) {
        return settingsDocumentResult;
      }

      return ok(settingsDocumentResult.value.agentCliConnections);
    },

    async saveAgentCliConnection(input: AgentCliConnectionSettings) {
      const settingsDocumentResult = await readAppSettingsDocument();
      if (!settingsDocumentResult.ok) {
        return settingsDocumentResult;
      }

      const nextAgentCliConnections = [
        ...settingsDocumentResult.value.agentCliConnections.filter(
          (connection) => connection.agentId !== input.agentId,
        ),
        input,
      ];

      await writeAppSettingsDocument({
        recentProjects: settingsDocumentResult.value.recentProjects,
        agentCliConnections: nextAgentCliConnections,
      });

      return ok(input);
    },
  };
}
