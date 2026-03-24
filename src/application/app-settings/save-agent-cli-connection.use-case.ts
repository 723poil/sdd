import type { AgentCliConnectionRecord } from '@/domain/app-settings/agent-cli-connection-model';
import {
  createAgentCliConnectionSettings,
  findAgentCliConnectionDefinition,
  type AgentCliAuthMode,
  type AgentCliCommandMode,
  type AgentCliId,
} from '@/domain/app-settings/agent-cli-connection-model';
import { err, type Result } from '@/shared/contracts/result';

import type { AgentCliSettingsPort } from '@/application/app-settings/app-settings.ports';

interface SaveAgentCliConnectionUseCase {
  execute(input: {
    agentId: AgentCliId;
    commandMode: AgentCliCommandMode;
    executablePath: string | null;
    authMode: AgentCliAuthMode;
  }): Promise<Result<AgentCliConnectionRecord>>;
}

export function createSaveAgentCliConnectionUseCase(dependencies: {
  agentCliSettingsStore: AgentCliSettingsPort;
}): SaveAgentCliConnectionUseCase {
  return {
    async execute(input) {
      const definition = findAgentCliConnectionDefinition(input.agentId);
      if (!definition) {
        return err({
          code: 'UNSUPPORTED_AGENT_CLI',
          message: '아직 지원하지 않는 CLI 에이전트입니다.',
        });
      }

      if (
        input.commandMode === 'custom' &&
        (typeof input.executablePath !== 'string' || input.executablePath.trim().length === 0)
      ) {
        return err({
          code: 'INVALID_AGENT_CLI_EXECUTABLE',
          message: '직접 지정 모드에서는 실행 경로를 입력해야 합니다.',
        });
      }

      if (!definition.supportedAuthModes.includes(input.authMode)) {
        return err({
          code: 'INVALID_AGENT_CLI_AUTH_MODE',
          message: '이 에이전트에서 지원하지 않는 인증 방식입니다.',
        });
      }

      const settings = createAgentCliConnectionSettings({
        agentId: input.agentId,
        commandMode: input.commandMode,
        executablePath: input.executablePath,
        authMode: input.authMode,
        updatedAt: new Date().toISOString(),
      });
      const saveResult = await dependencies.agentCliSettingsStore.saveAgentCliConnection(settings);
      if (!saveResult.ok) {
        return saveResult;
      }

      return {
        ok: true,
        value: {
          definition,
          settings: saveResult.value,
        },
      };
    },
  };
}
