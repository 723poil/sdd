import type { AgentCliSettingsPort } from '@/application/app-settings/app-settings.ports';
import {
  createDefaultAgentCliConnectionSettings,
  findAgentCliConnectionDefinition,
  type AgentCliConnectionSettings,
} from '@/domain/app-settings/agent-cli-connection-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

export interface CodexRuntimeSettings {
  connectionSettings: AgentCliConnectionSettings;
  executablePath: string;
}

export async function resolveCodexRuntimeSettings(input: {
  agentCliSettingsStore: AgentCliSettingsPort;
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

  const codexSettings =
    connectionSettingsResult.value.find((connection) => connection.agentId === 'codex') ??
    createDefaultAgentCliConnectionSettings('codex');

  if (codexSettings.commandMode === 'custom') {
    if (!codexSettings.executablePath) {
      return err(
        createProjectError(
          'AGENT_CLI_NOT_CONFIGURED',
          '직접 지정된 Codex 실행 경로가 비어 있습니다. 앱 설정에서 Codex CLI를 다시 확인해 주세요.',
        ),
      );
    }

    return ok({
      connectionSettings: codexSettings,
      executablePath: codexSettings.executablePath,
    });
  }

  return ok({
    connectionSettings: codexSettings,
    executablePath: definition.defaultExecutableName,
  });
}
