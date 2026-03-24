import {
  createAgentCliConnectionSettings,
  findAgentCliConnectionDefinition,
  type AgentCliAuthMode,
  type AgentCliCommandMode,
  type AgentCliConnectionCheck,
  type AgentCliId,
} from '@/domain/app-settings/agent-cli-connection-model';
import { err, type Result } from '@/shared/contracts/result';

import type { AgentCliRuntimePort } from '@/application/app-settings/app-settings.ports';

interface CheckAgentCliConnectionUseCase {
  execute(input: {
    agentId: AgentCliId;
    commandMode: AgentCliCommandMode;
    executablePath: string | null;
    authMode: AgentCliAuthMode;
  }): Promise<Result<AgentCliConnectionCheck>>;
}

export function createCheckAgentCliConnectionUseCase(dependencies: {
  agentCliRuntime: AgentCliRuntimePort;
}): CheckAgentCliConnectionUseCase {
  return {
    async execute(input) {
      const definition = findAgentCliConnectionDefinition(input.agentId);
      if (!definition) {
        return err({
          code: 'UNSUPPORTED_AGENT_CLI',
          message: '아직 지원하지 않는 CLI 에이전트입니다.',
        });
      }

      if (!definition.supportedAuthModes.includes(input.authMode)) {
        return err({
          code: 'INVALID_AGENT_CLI_AUTH_MODE',
          message: '이 에이전트에서 지원하지 않는 인증 방식입니다.',
        });
      }

      const normalizedSettings = createAgentCliConnectionSettings({
        agentId: input.agentId,
        commandMode: input.commandMode,
        executablePath: input.executablePath,
        authMode: input.authMode,
        updatedAt: null,
      });

      if (
        normalizedSettings.commandMode === 'custom' &&
        normalizedSettings.executablePath === null
      ) {
        return err({
          code: 'INVALID_AGENT_CLI_EXECUTABLE',
          message: '직접 지정 모드에서는 실행 경로를 입력해야 합니다.',
        });
      }

      return dependencies.agentCliRuntime.checkAgentCliConnection({
        agentId: normalizedSettings.agentId,
        executablePath:
          normalizedSettings.commandMode === 'custom'
            ? normalizedSettings.executablePath
            : null,
      });
    },
  };
}
