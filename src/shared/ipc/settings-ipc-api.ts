import type {
  AgentCliId,
  AgentCliConnectionCheck,
  AgentCliConnectionRecord,
  AgentCliSettingsSnapshot,
} from '@/domain/app-settings/agent-cli-connection-model';
import type {
  RendererSettingsApi,
  SaveAgentCliConnectionInput,
  CheckAgentCliConnectionInput,
} from '@/shared/ipc/settings-ipc';
import type { Result } from '@/shared/contracts/result';
import { settingsIpcChannels } from '@/shared/ipc/settings-ipc';
import {
  bindIpcInvoke1,
  bindIpcInvoke0,
  type IpcRendererInvoke,
} from '@/shared/ipc/ipc-bridge';

export function createRendererSettingsApi(
  invoke: IpcRendererInvoke['invoke'],
): RendererSettingsApi {
  return {
    listAgentCliConnections: bindIpcInvoke0<Result<AgentCliSettingsSnapshot>>(
      invoke,
      settingsIpcChannels.listAgentCliConnections,
    ),
    saveAgentCliConnection: bindIpcInvoke1<
      SaveAgentCliConnectionInput,
      Result<AgentCliConnectionRecord>
    >(
      invoke,
      settingsIpcChannels.saveAgentCliConnection,
    ),
    checkAgentCliConnection: bindIpcInvoke1<
      CheckAgentCliConnectionInput,
      Result<AgentCliConnectionCheck>
    >(invoke, settingsIpcChannels.checkAgentCliConnection),
    readSelectedAgentId: bindIpcInvoke0<Result<AgentCliId>>(
      invoke,
      settingsIpcChannels.readSelectedAgentId,
    ),
    saveSelectedAgentId: bindIpcInvoke1<{ agentId: AgentCliId }, Result<AgentCliId>>(
      invoke,
      settingsIpcChannels.saveSelectedAgentId,
    ),
  };
}
