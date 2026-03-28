import { ipcMain } from 'electron';

import { createCheckAgentCliConnectionUseCase } from '@/application/app-settings/check-agent-cli-connection.use-case';
import { createListAgentCliConnectionsUseCase } from '@/application/app-settings/list-agent-cli-connections.use-case';
import { createSaveAgentCliConnectionUseCase } from '@/application/app-settings/save-agent-cli-connection.use-case';
import type { AgentCliId } from '@/domain/app-settings/agent-cli-connection-model';
import { createFsAgentCliSettingsRepository } from '@/infrastructure/app-settings/fs-agent-cli-settings.repository';
import { createNodeAgentCliRuntimeAdapter } from '@/infrastructure/agent-cli/node-agent-cli-runtime.adapter';
import { registerIpcHandle0, registerIpcHandle1 } from '@/shared/ipc/ipc-bridge';
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

  registerIpcHandle0(
    ipcMain,
    settingsIpcChannels.listAgentCliConnections,
    () => listAgentCliConnections.execute(),
  );
  registerIpcHandle0(
    ipcMain,
    settingsIpcChannels.readSelectedAgentId,
    () => agentCliSettingsStore.readSelectedAgentCli(),
  );
  registerIpcHandle1(
    ipcMain,
    settingsIpcChannels.saveAgentCliConnection,
    (input: SaveAgentCliConnectionInput) => saveAgentCliConnection.execute(input),
  );
  registerIpcHandle1(
    ipcMain,
    settingsIpcChannels.saveSelectedAgentId,
    (input: { agentId: AgentCliId }) => agentCliSettingsStore.saveSelectedAgentCli(input),
  );
  registerIpcHandle1(
    ipcMain,
    settingsIpcChannels.checkAgentCliConnection,
    (input: CheckAgentCliConnectionInput) => checkAgentCliConnection.execute(input),
  );
}
