import type { AgentCliSettingsPort } from '@/application/app-settings/app-settings.ports';
import {
  createAgentCliConnectionSettings,
  createDefaultAgentCliConnectionSettings,
  findAgentCliConnectionDefinition,
  type AgentCliModelReasoningEffort,
  type AgentCliConnectionSettings,
} from '@/domain/app-settings/agent-cli-connection-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

import { resolveAgentCliExecutablePath } from '@/infrastructure/agent-cli/resolve-agent-cli-executable-path';

export interface CodexRuntimeSettings {
  connectionSettings: AgentCliConnectionSettings;
  executablePath: string;
}

export async function resolveCodexRuntimeSettings(input: {
  agentCliSettingsStore: AgentCliSettingsPort;
  overrides?: {
    model?: string | null;
    modelReasoningEffort?: AgentCliModelReasoningEffort | null;
  };
}): Promise<Result<CodexRuntimeSettings>> {
  const definition = findAgentCliConnectionDefinition('codex');
  if (!definition) {
    return err(createProjectError('AGENT_CLI_NOT_CONFIGURED', 'Codex CLI 정의를 찾지 못했습니다.'));
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

  const storedCodexSettings =
    connectionSettingsResult.value.find((connection) => connection.agentId === 'codex') ??
    createDefaultAgentCliConnectionSettings('codex', input.overrides);
  const codexSettings = createAgentCliConnectionSettings({
    agentId: storedCodexSettings.agentId,
    authMode: storedCodexSettings.authMode,
    commandMode: storedCodexSettings.commandMode,
    executablePath: storedCodexSettings.executablePath,
    model: input.overrides?.model ?? storedCodexSettings.model,
    modelReasoningEffort:
      input.overrides?.modelReasoningEffort ?? storedCodexSettings.modelReasoningEffort,
    updatedAt: storedCodexSettings.updatedAt,
  });

  if (codexSettings.commandMode === 'custom') {
    if (!codexSettings.executablePath) {
      return err(
        createProjectError(
          'AGENT_CLI_NOT_CONFIGURED',
          '직접 지정된 Codex 실행 경로가 비어 있습니다. 앱 설정에서 Codex CLI를 다시 확인해 주세요.',
        ),
      );
    }

    const resolvedCustomExecutablePath = await resolveAgentCliExecutablePath({
      executablePath: codexSettings.executablePath,
    });
    if (!resolvedCustomExecutablePath) {
      return err(
        createProjectError(
          'AGENT_CLI_NOT_AVAILABLE',
          '선택한 Codex CLI 실행 파일을 찾지 못했습니다. 앱 설정에서 경로나 PATH를 확인해 주세요.',
          codexSettings.executablePath,
        ),
      );
    }

    return ok({
      connectionSettings: codexSettings,
      executablePath: resolvedCustomExecutablePath,
    });
  }

  const resolvedSystemExecutablePath = await resolveAgentCliExecutablePath({
    executablePath: definition.defaultExecutableName,
  });
  if (!resolvedSystemExecutablePath) {
    return err(
      createProjectError(
        'AGENT_CLI_NOT_AVAILABLE',
        'Codex CLI 실행 파일을 찾지 못했습니다. PATH 또는 기본 설치 위치를 확인해 주세요.',
        definition.defaultExecutableName,
      ),
    );
  }

  return ok({
    connectionSettings: codexSettings,
    executablePath: resolvedSystemExecutablePath,
  });
}
