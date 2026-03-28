import type { AgentCliSettingsPort } from '@/application/app-settings/app-settings.ports';
import {
  createAgentCliConnectionSettings,
  createDefaultAgentCliConnectionSettings,
  findAgentCliConnectionDefinition,
  type AgentCliConnectionDefinition,
  type AgentCliConnectionSettings,
  type AgentCliId,
  type AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

import { readCodexCliConfigDefaults } from '@/infrastructure/app-settings/fs-app-settings-store';
import { resolveAgentCliExecutablePath } from '@/infrastructure/agent-cli/resolve-agent-cli-executable-path';

export interface ResolvedCliAgentRuntimeSettings {
  connectionSettings: AgentCliConnectionSettings;
  definition: AgentCliConnectionDefinition;
  executablePath: string;
}

export async function resolveCliAgentRuntimeSettings(input: {
  agentCliSettingsStore: AgentCliSettingsPort;
  agentId: AgentCliId;
  overrides?: {
    model?: string | null;
    modelReasoningEffort?: AgentCliModelReasoningEffort | null;
  };
}): Promise<Result<ResolvedCliAgentRuntimeSettings>> {
  const definition = findAgentCliConnectionDefinition(input.agentId);
  if (!definition) {
    return err(createProjectError('AGENT_CLI_NOT_CONFIGURED', 'CLI 에이전트 정의를 찾지 못했습니다.'));
  }

  const connectionSettingsResult = await input.agentCliSettingsStore.listAgentCliConnections();
  if (!connectionSettingsResult.ok) {
    return err(
      createProjectError(
        'AGENT_CLI_NOT_CONFIGURED',
        '앱 전역 CLI 설정을 읽지 못했습니다.',
        connectionSettingsResult.error.message,
      ),
    );
  }

  const defaultOverrides =
    input.agentId === 'codex'
      ? await readCodexCliConfigDefaults()
      : {
          model: null,
          modelReasoningEffort: null,
        };
  const storedSettings =
    connectionSettingsResult.value.find((connection) => connection.agentId === input.agentId) ??
    createDefaultAgentCliConnectionSettings(input.agentId, {
      model: defaultOverrides.model,
      modelReasoningEffort: defaultOverrides.modelReasoningEffort,
    });
  const connectionSettings = createAgentCliConnectionSettings({
    agentId: storedSettings.agentId,
    authMode: storedSettings.authMode,
    commandMode: storedSettings.commandMode,
    executablePath: storedSettings.executablePath,
    model: input.overrides?.model ?? storedSettings.model,
    modelReasoningEffort:
      input.overrides?.modelReasoningEffort ?? storedSettings.modelReasoningEffort,
    updatedAt: storedSettings.updatedAt,
  });

  const requestedExecutablePath =
    connectionSettings.commandMode === 'custom'
      ? connectionSettings.executablePath
      : definition.defaultExecutableName;
  if (!requestedExecutablePath) {
    return err(
      createProjectError(
        'AGENT_CLI_NOT_CONFIGURED',
        `${definition.displayName} 실행 경로가 비어 있습니다. 앱 설정을 다시 확인해 주세요.`,
      ),
    );
  }

  const resolvedExecutablePath = await resolveAgentCliExecutablePath({
    agentId: input.agentId,
    executablePath: requestedExecutablePath,
  });
  if (!resolvedExecutablePath) {
    return err(
      createProjectError(
        'AGENT_CLI_NOT_AVAILABLE',
        `${definition.displayName} 실행 파일을 찾지 못했습니다. 앱 설정에서 경로나 PATH를 확인해 주세요.`,
        requestedExecutablePath,
      ),
    );
  }

  return ok({
    connectionSettings,
    definition,
    executablePath: resolvedExecutablePath,
  });
}
