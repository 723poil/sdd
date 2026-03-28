import type { AgentCliConnectionRecord } from '@/domain/app-settings/agent-cli-connection-model';
import {
  AGENT_CLI_MODEL_REASONING_EFFORTS,
  createAgentCliConnectionSettings,
  findAgentCliConnectionDefinition,
  type AgentCliAuthMode,
  type AgentCliCommandMode,
  type AgentCliId,
  type AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';
import { err, type Result } from '@/shared/contracts/result';

import type { AgentCliSettingsPort } from '@/application/app-settings/app-settings.ports';

interface SaveAgentCliConnectionUseCase {
  execute(input: {
    agentId: AgentCliId;
    commandMode: AgentCliCommandMode;
    executablePath: string | null;
    authMode: AgentCliAuthMode;
    model?: string | null;
    modelReasoningEffort?: AgentCliModelReasoningEffort | null;
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

      if (definition.capabilities.modelSelection && (input.model ?? '').trim().length === 0) {
        return err({
          code: 'INVALID_AGENT_CLI_MODEL',
          message: '모델을 선택해야 합니다.',
        });
      }

      if (
        definition.capabilities.reasoningEffort &&
        !AGENT_CLI_MODEL_REASONING_EFFORTS.includes(
          (input.modelReasoningEffort ?? definition.defaultModelReasoningEffort),
        )
      ) {
        return err({
          code: 'INVALID_AGENT_CLI_REASONING_EFFORT',
          message: '지원하지 않는 추론 강도입니다.',
        });
      }

      const settings = createAgentCliConnectionSettings({
        agentId: input.agentId,
        commandMode: input.commandMode,
        executablePath: input.executablePath,
        authMode: input.authMode,
        ...(typeof input.model !== 'undefined' ? { model: input.model } : {}),
        ...(typeof input.modelReasoningEffort !== 'undefined'
          ? { modelReasoningEffort: input.modelReasoningEffort }
          : {}),
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
