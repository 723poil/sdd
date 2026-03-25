import type { AgentCliModelReasoningEffort } from '@/domain/app-settings/agent-cli-connection-model';
import type {
  ProjectSessionMessage,
  ProjectSessionMeta,
} from '@/domain/project/project-session-model';
import { createProjectError } from '@/domain/project/project-errors';
import type { Result } from '@/shared/contracts/result';
import { err, ok } from '@/shared/contracts/result';

import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';
import type {
  ProjectInspectorPort,
  ProjectSpecChatPort,
  ProjectSessionPort,
  ProjectStoragePort,
} from '@/application/project/project.ports';

export interface SendProjectSessionMessageOutput {
  assistantErrorMessage: string | null;
  messages: ProjectSessionMessage[];
  session: ProjectSessionMeta;
}

export interface SendProjectSessionMessageUseCase {
  execute(input: {
    model: string;
    modelReasoningEffort: AgentCliModelReasoningEffort;
    rootPath: string;
    sessionId: string;
    text: string;
  }): Promise<Result<SendProjectSessionMessageOutput>>;
}

export function createSendProjectSessionMessageUseCase(dependencies: {
  projectInspector: ProjectInspectorPort;
  projectSpecChat: ProjectSpecChatPort;
  projectSessionStore: ProjectSessionPort;
  projectStorage: ProjectStoragePort;
}): SendProjectSessionMessageUseCase {
  return {
    async execute(input) {
      const storageResult = await ensureProjectStorageReady(dependencies, {
        notWritableMessage: '메시지를 저장하려면 프로젝트 경로에 쓰기 권한이 필요합니다.',
        rootPath: input.rootPath,
      });
      if (!storageResult.ok) {
        return storageResult;
      }

      const trimmedText = input.text.trim();
      if (trimmedText.length === 0) {
        return err(
          createProjectError('INVALID_PROJECT_STORAGE', '빈 메시지는 저장할 수 없습니다.'),
        );
      }

      const result = await dependencies.projectSessionStore.appendSessionMessage({
        rootPath: input.rootPath,
        sessionId: input.sessionId,
        role: 'user',
        text: trimmedText,
      });
      if (!result.ok) {
        return result;
      }

      const userMessage = result.value.message;
      const userSession = result.value.session;
      const partialSuccess = (assistantErrorMessage: string) =>
        ok({
          assistantErrorMessage,
          messages: [userMessage],
          session: userSession,
        });

      if (!userSession.specId) {
        return partialSuccess(
          '메시지는 저장했지만 이 세션은 아직 명세와 연결되지 않아 응답을 만들 수 없습니다.',
        );
      }

      const specsResult = await dependencies.projectStorage.readProjectSpecs({
        rootPath: input.rootPath,
      });
      if (!specsResult.ok) {
        return partialSuccess(
          `메시지는 저장했지만 현재 명세 문서를 읽지 못했습니다. ${specsResult.error.message}`,
        );
      }

      const selectedSpec =
        specsResult.value.find((spec) => spec.meta.id === userSession.specId) ?? null;
      if (!selectedSpec) {
        return partialSuccess(
          '메시지는 저장했지만 이 세션과 연결된 명세 문서를 찾지 못해 응답을 만들 수 없습니다.',
        );
      }

      const sessionMessagesResult = await dependencies.projectSessionStore.readSessionMessages({
        rootPath: input.rootPath,
        sessionId: input.sessionId,
      });
      if (!sessionMessagesResult.ok) {
        return partialSuccess(
          `메시지는 저장했지만 대화 이력을 읽지 못했습니다. ${sessionMessagesResult.error.message}`,
        );
      }

      const replyResult = await dependencies.projectSpecChat.generateReply({
        model: input.model,
        modelReasoningEffort: input.modelReasoningEffort,
        projectName: storageResult.value.projectMeta.projectName,
        rootPath: input.rootPath,
        sessionMessages: sessionMessagesResult.value,
        spec: selectedSpec,
      });
      if (!replyResult.ok) {
        return partialSuccess(replyResult.error.message);
      }

      const assistantText = replyResult.value.trim();
      if (assistantText.length === 0) {
        return partialSuccess(
          '메시지는 저장했지만 에이전트 응답이 비어 있어 대화 로그에 추가하지 않았습니다.',
        );
      }

      const assistantAppendResult = await dependencies.projectSessionStore.appendSessionMessage({
        rootPath: input.rootPath,
        sessionId: input.sessionId,
        role: 'assistant',
        text: assistantText,
      });
      if (!assistantAppendResult.ok) {
        return partialSuccess(
          `메시지는 저장했지만 에이전트 응답을 기록하지 못했습니다. ${assistantAppendResult.error.message}`,
        );
      }

      return ok({
        assistantErrorMessage: null,
        messages: [userMessage, assistantAppendResult.value.message],
        session: assistantAppendResult.value.session,
      });
    },
  };
}
