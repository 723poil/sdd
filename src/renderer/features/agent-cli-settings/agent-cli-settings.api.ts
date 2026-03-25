import type {
  AgentCliConnectionDraft,
  AgentCliConnectionDraftMap,
} from '@/renderer/features/agent-cli-settings/types';
import { getRendererSddApi } from '@/renderer/renderer-sdd-api';
import type {
  AgentCliConnectionRecord,
  AgentCliId,
} from '@/domain/app-settings/agent-cli-connection-model';

export function getAgentCliSettingsApi() {
  const sddApi = getRendererSddApi();
  return sddApi?.settings ?? null;
}

export function createDraftFromRecord(connection: AgentCliConnectionRecord): AgentCliConnectionDraft {
  return {
    agentId: connection.definition.agentId,
    commandMode: connection.settings.commandMode,
    executablePath: connection.settings.executablePath ?? '',
    authMode: connection.settings.authMode,
    model: connection.settings.model,
    modelReasoningEffort: connection.settings.modelReasoningEffort,
  };
}

export function buildDraftsByAgentId(
  connections: AgentCliConnectionRecord[],
): AgentCliConnectionDraftMap {
  return connections.reduce<AgentCliConnectionDraftMap>((accumulator, connection) => {
    accumulator[connection.definition.agentId] = createDraftFromRecord(connection);
    return accumulator;
  }, {});
}

export function patchDraftByAgentId(
  current: AgentCliConnectionDraftMap,
  agentId: AgentCliId,
  patch: Partial<AgentCliConnectionDraft>,
): AgentCliConnectionDraftMap {
  const existing = current[agentId];
  if (!existing) {
    return current;
  }

  return {
    ...current,
    [agentId]: {
      ...existing,
      ...patch,
    },
  };
}
