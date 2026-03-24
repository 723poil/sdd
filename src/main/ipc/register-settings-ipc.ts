import { ipcMain } from 'electron';

import { createCheckAgentCliConnectionUseCase } from '@/application/app-settings/check-agent-cli-connection.use-case';
import { createListAgentCliConnectionsUseCase } from '@/application/app-settings/list-agent-cli-connections.use-case';
import { createSaveAgentCliConnectionUseCase } from '@/application/app-settings/save-agent-cli-connection.use-case';
import { createFsAgentCliSettingsRepository } from '@/infrastructure/app-settings/fs-agent-cli-settings.repository';
import { createNodeAgentCliRuntimeAdapter } from '@/infrastructure/agent-cli/node-agent-cli-runtime.adapter';
import {
  type CheckAgentCliConnectionInput,
  type SaveAgentCliConnectionInput,
  settingsIpcChannels,
} from '@/shared/ipc/settings-ipc';

export function registerSettingsIpc(): void {
  const agentCliSettingsStore = createFsAgentCliSettingsRepository();
  const agentCliRuntime = createNodeAgentCliRuntimeAdapter();
  const listAgentCliConnections = createListAgentCliConnectionsUseCase({
    agentCliSettingsStore,
  });
  const saveAgentCliConnection = createSaveAgentCliConnectionUseCase({
    agentCliSettingsStore,
  });
  const checkAgentCliConnection = createCheckAgentCliConnectionUseCase({
    agentCliRuntime,
  });

  ipcMain.handle(settingsIpcChannels.listAgentCliConnections, async () => {
    return listAgentCliConnections.execute();
  });

  ipcMain.handle(
    settingsIpcChannels.saveAgentCliConnection,
    async (_event, input: SaveAgentCliConnectionInput) => {
      return saveAgentCliConnection.execute(input);
    },
  );

  ipcMain.handle(
    settingsIpcChannels.checkAgentCliConnection,
    async (_event, input: CheckAgentCliConnectionInput) => {
      return checkAgentCliConnection.execute(input);
    },
  );
}
