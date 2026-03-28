import type { AgentCliSettingsPort } from '@/application/app-settings/app-settings.ports';
import {
  createDefaultAgentCliConnectionSettings,
  type AgentCliConnectionSettings,
  type AgentCliId,
} from '@/domain/app-settings/agent-cli-connection-model';
import { ok } from '@/shared/contracts/result';

import {
  readCodexCliConfigDefaults,
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

      const codexDefaults = await readCodexCliConfigDefaults();
      const connections = [...settingsDocumentResult.value.agentCliConnections];

      if (!connections.some((connection) => connection.agentId === 'codex')) {
        connections.push(
          createDefaultAgentCliConnectionSettings('codex', {
            model: codexDefaults.model,
            modelReasoningEffort: codexDefaults.modelReasoningEffort,
          }),
        );
      }

      return ok(connections);
    },

    async readSelectedAgentCli() {
      const settingsDocumentResult = await readAppSettingsDocument();
      if (!settingsDocumentResult.ok) {
        return settingsDocumentResult;
      }

      return ok(settingsDocumentResult.value.selectedAgentId);
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
        selectedAgentId: settingsDocumentResult.value.selectedAgentId,
        recentProjects: settingsDocumentResult.value.recentProjects,
        agentCliConnections: nextAgentCliConnections,
      });

      return ok(input);
    },

    async saveSelectedAgentCli(input: { agentId: AgentCliId }) {
      const settingsDocumentResult = await readAppSettingsDocument();
      if (!settingsDocumentResult.ok) {
        return settingsDocumentResult;
      }

      await writeAppSettingsDocument({
        selectedAgentId: input.agentId,
        recentProjects: settingsDocumentResult.value.recentProjects,
        agentCliConnections: settingsDocumentResult.value.agentCliConnections,
      });

      return ok(input.agentId);
    },
  };
}
