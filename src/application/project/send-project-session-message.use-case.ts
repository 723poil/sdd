import type { AgentCliModelReasoningEffort } from '@/domain/app-settings/agent-cli-connection-model';
import type { ProjectSpecSaveResult } from '@/domain/project/project-spec-model';
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
  ProjectSessionMessageRunStatusPort,
  ProjectStoragePort,
} from '@/application/project/project.ports';

export interface SendProjectSessionMessageOutput {
  assistantErrorMessage: string | null;
  messages: ProjectSessionMessage[];
  specSave: ProjectSpecSaveResult | null;
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
  sessionMessageRunStatusStore: ProjectSessionMessageRunStatusPort;
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

      const startedAt = new Date().toISOString();
      const runControlResult = dependencies.sessionMessageRunStatusStore.beginSessionMessageRun({
        rootPath: input.rootPath,
        sessionId: input.sessionId,
        requestText: trimmedText,
        stageMessage: '메시지 저장 중',
        progressMessage: '대화 로그에 질문을 기록하고 있습니다.',
        startedAt,
        stepIndex: 1,
        stepTotal: 3,
      });
      if (!runControlResult.ok) {
        return runControlResult;
      }

      const runControl = runControlResult.value;
      const updateRunStatus = (patch: {
        status?: 'running' | 'cancelling' | 'cancelled' | 'succeeded' | 'failed';
        stageMessage?: string;
        progressMessage?: string | null;
        requestText?: string | null;
        stepIndex?: number;
        completedAt?: string | null;
        lastError?: string | null;
      }) =>
        dependencies.sessionMessageRunStatusStore.updateSessionMessageRunStatus({
          rootPath: input.rootPath,
          sessionId: input.sessionId,
          ...patch,
        });
      const failRunStatus = (stageMessage: string, message: string, stepIndex: number) => {
        updateRunStatus({
          status: 'failed',
          stageMessage,
          progressMessage: null,
          requestText: null,
          stepIndex,
          completedAt: new Date().toISOString(),
          lastError: message,
        });
      };
      const cancelRunStatus = () => {
        updateRunStatus({
          status: 'cancelled',
          stageMessage: '요청 취소됨',
          progressMessage: '응답 생성을 취소했습니다.',
          requestText: null,
          completedAt: new Date().toISOString(),
          lastError: null,
        });

        return err(
          createProjectError('PROJECT_SESSION_MESSAGE_CANCELLED', '채팅 요청을 취소했습니다.'),
        );
      };

      const result = await dependencies.projectSessionStore.appendSessionMessage({
        rootPath: input.rootPath,
        sessionId: input.sessionId,
        role: 'user',
        text: trimmedText,
      });
      if (!result.ok) {
        failRunStatus('메시지 저장 실패', result.error.message, 1);
        return result;
      }

      const userMessage = result.value.message;
      const userSession = result.value.session;
      const partialSuccess = (
        assistantErrorMessage: string,
        specSave: ProjectSpecSaveResult | null = null,
        options: { stageMessage: string; stepIndex: number },
      ) => {
        failRunStatus(options.stageMessage, assistantErrorMessage, options.stepIndex);

        return ok({
          assistantErrorMessage,
          messages: [userMessage],
          specSave,
          session: userSession,
        });
      };

      if (isSessionMessageCancellationRequested(dependencies, input.rootPath, input.sessionId)) {
        return cancelRunStatus();
      }

      updateRunStatus({
        stageMessage: '응답 생성 중',
        progressMessage: 'Codex가 명세 초안을 정리하고 있습니다.',
        stepIndex: 2,
      });

      if (!userSession.specId) {
        return partialSuccess(
          '메시지는 저장했지만 이 세션은 아직 명세와 연결되지 않아 응답을 만들 수 없습니다.',
          null,
          {
            stageMessage: '응답 생성 실패',
            stepIndex: 2,
          },
        );
      }

      const specsResult = await dependencies.projectStorage.readProjectSpecs({
        rootPath: input.rootPath,
      });
      if (!specsResult.ok) {
        return partialSuccess(
          `메시지는 저장했지만 현재 명세 문서를 읽지 못했습니다. ${specsResult.error.message}`,
          null,
          {
            stageMessage: '응답 생성 실패',
            stepIndex: 2,
          },
        );
      }

      const selectedSpec =
        specsResult.value.find((spec) => spec.meta.id === userSession.specId) ?? null;
      if (!selectedSpec) {
        return partialSuccess(
          '메시지는 저장했지만 이 세션과 연결된 명세 문서를 찾지 못해 응답을 만들 수 없습니다.',
          null,
          {
            stageMessage: '응답 생성 실패',
            stepIndex: 2,
          },
        );
      }

      const sessionMessagesResult = await dependencies.projectSessionStore.readSessionMessages({
        rootPath: input.rootPath,
        sessionId: input.sessionId,
      });
      if (!sessionMessagesResult.ok) {
        return partialSuccess(
          `메시지는 저장했지만 대화 이력을 읽지 못했습니다. ${sessionMessagesResult.error.message}`,
          null,
          {
            stageMessage: '응답 생성 실패',
            stepIndex: 2,
          },
        );
      }

      const replyResult = await dependencies.projectSpecChat.generateReply({
        model: input.model,
        modelReasoningEffort: input.modelReasoningEffort,
        projectName: storageResult.value.projectMeta.projectName,
        rootPath: input.rootPath,
        signal: runControl.signal,
        sessionMessages: sessionMessagesResult.value,
        spec: selectedSpec,
      });
      if (!replyResult.ok) {
        if (replyResult.error.code === 'PROJECT_SESSION_MESSAGE_CANCELLED') {
          return cancelRunStatus();
        }

        return partialSuccess(replyResult.error.message, null, {
          stageMessage: '응답 생성 실패',
          stepIndex: 2,
        });
      }

      if (isSessionMessageCancellationRequested(dependencies, input.rootPath, input.sessionId)) {
        return cancelRunStatus();
      }

      updateRunStatus({
        stageMessage: '명세 반영 중',
        progressMessage: '응답과 명세 초안을 저장하고 있습니다.',
        stepIndex: 3,
      });

      const saveSpecResult = await dependencies.projectStorage.saveProjectSpec({
        markdown: replyResult.value.markdown,
        revision: selectedSpec.meta.revision,
        rootPath: input.rootPath,
        specId: selectedSpec.meta.id,
        summary: replyResult.value.summary,
        title: replyResult.value.title,
      });
      if (!saveSpecResult.ok) {
        return partialSuccess(
          `메시지는 저장했지만 명세 초안을 저장하지 못했습니다. ${saveSpecResult.error.message}`,
          null,
          {
            stageMessage: '명세 반영 실패',
            stepIndex: 3,
          },
        );
      }

      if (saveSpecResult.value.kind === 'conflict') {
        return partialSuccess(
          '메시지는 저장했지만 명세 초안 저장 중 다른 변경과 충돌했습니다. 최신 초안을 다시 확인해 주세요.',
          saveSpecResult.value,
          {
            stageMessage: '명세 반영 충돌',
            stepIndex: 3,
          },
        );
      }

      const assistantText = replyResult.value.reply.trim();
      if (assistantText.length === 0) {
        return partialSuccess(
          '메시지는 저장했지만 에이전트 응답이 비어 있어 대화 로그에 추가하지 않았습니다.',
          saveSpecResult.value,
          {
            stageMessage: '응답 기록 실패',
            stepIndex: 3,
          },
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
          saveSpecResult.value,
          {
            stageMessage: '응답 기록 실패',
            stepIndex: 3,
          },
        );
      }

      updateRunStatus({
        status: 'succeeded',
        stageMessage: '응답 완료',
        progressMessage: '명세와 채팅에 응답을 반영했습니다.',
        requestText: null,
        stepIndex: 3,
        completedAt: new Date().toISOString(),
        lastError: null,
      });

      return ok({
        assistantErrorMessage: null,
        messages: [userMessage, assistantAppendResult.value.message],
        specSave: saveSpecResult.value,
        session: assistantAppendResult.value.session,
      });
    },
  };
}

function isSessionMessageCancellationRequested(
  dependencies: { sessionMessageRunStatusStore: ProjectSessionMessageRunStatusPort },
  rootPath: string,
  sessionId: string,
): boolean {
  const statusResult = dependencies.sessionMessageRunStatusStore.readSessionMessageRunStatus({
    rootPath,
    sessionId,
  });
  if (!statusResult.ok) {
    return false;
  }

  return (
    statusResult.value.status === 'cancelling' || statusResult.value.status === 'cancelled'
  );
}
