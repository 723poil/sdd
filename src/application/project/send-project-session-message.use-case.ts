import type { AgentCliModelReasoningEffort } from '@/domain/app-settings/agent-cli-connection-model';
import type { ProjectSpecSaveResult } from '@/domain/project/project-spec-model';
import type {
  ProjectSessionMessageAttachmentUpload,
  ProjectSessionMessage,
  ProjectSessionMeta,
} from '@/domain/project/project-session-model';
import { createProjectError } from '@/domain/project/project-errors';
import {
  createProjectSessionMessagePreview,
  describeProjectSessionMessageAttachmentValidationIssue,
  validateProjectSessionMessageAttachmentSelection,
} from '@/domain/project/project-session-model';
import type { Result } from '@/shared/contracts/result';
import { err, ok } from '@/shared/contracts/result';

import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';
import type {
  ProjectInspectorPort,
  ProjectSpecChatPort,
  ProjectSessionPort,
  ProjectSessionMessageStoragePort,
} from '@/application/project/project.ports';
import { beginProjectSessionMessageRun } from '@/application/project/project-session-message-run';

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
    attachments: ProjectSessionMessageAttachmentUpload[];
  }): Promise<Result<SendProjectSessionMessageOutput>>;
}

export function createSendProjectSessionMessageUseCase(dependencies: {
  projectInspector: ProjectInspectorPort;
  projectSpecChat: ProjectSpecChatPort;
  projectSessionStore: ProjectSessionPort;
  sessionMessageRunStatusStore: Parameters<typeof beginProjectSessionMessageRun>[0];
  projectStorage: ProjectSessionMessageStoragePort;
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
      const attachmentValidationResult = validateProjectSessionMessageAttachmentSelection({
        candidates: input.attachments.map((attachment) => ({
          mimeType: attachment.mimeType,
          name: attachment.name,
          sizeBytes: attachment.sizeBytes,
          source: attachment.source,
        })),
      });
      if (attachmentValidationResult.rejected.length > 0) {
        return err(
          createProjectError(
            'INVALID_PROJECT_SESSION_ATTACHMENT',
            attachmentValidationResult.rejected
              .map((issue) => describeProjectSessionMessageAttachmentValidationIssue(issue))
              .join('\n'),
          ),
        );
      }

      if (
        input.attachments.some((attachment) => attachment.sizeBytes !== attachment.bytes.byteLength)
      ) {
        return err(
          createProjectError(
            'INVALID_PROJECT_SESSION_ATTACHMENT',
            '첨부 파일 크기 정보를 확인하지 못했습니다. 다시 선택해 주세요.',
          ),
        );
      }

      if (trimmedText.length === 0 && input.attachments.length === 0) {
        return err(
          createProjectError('INVALID_PROJECT_STORAGE', '빈 메시지는 저장할 수 없습니다.'),
        );
      }

      const requestSummary = createProjectSessionMessagePreview({
        attachments: input.attachments,
        text: trimmedText,
      });
      const startedAt = new Date().toISOString();
      const runControlResult = beginProjectSessionMessageRun(
        dependencies.sessionMessageRunStatusStore,
        {
          attachmentCount: input.attachments.length,
          requestAttachments: input.attachments.map((attachment, index) => ({
            id: `pending-attachment-${index + 1}`,
            kind: attachment.kind,
            mimeType: attachment.mimeType,
            name: attachment.name,
            sizeBytes: attachment.sizeBytes,
          })),
          requestText: trimmedText.length > 0 ? trimmedText : null,
          requestSummary,
          rootPath: input.rootPath,
          sessionId: input.sessionId,
          startedAt,
        },
      );
      if (!runControlResult.ok) {
        return runControlResult;
      }

      const runControl = runControlResult.value;
      const failRunStatus = (stageMessage: string, message: string, stepIndex: number) => {
        runControl.fail({
          message,
          stageMessage,
          stepIndex,
        });
      };

      const result = await dependencies.projectSessionStore.appendSessionMessage({
        attachments: input.attachments,
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

      if (runControl.isCancellationRequested()) {
        return runControl.cancel();
      }

      runControl.markReplyGenerationStarted();

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
          return runControl.cancel();
        }

        return partialSuccess(replyResult.error.message, null, {
          stageMessage: '응답 생성 실패',
          stepIndex: 2,
        });
      }

      if (runControl.isCancellationRequested()) {
        return runControl.cancel();
      }

      runControl.markSpecApplyStarted();

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
        attachments: [],
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

      runControl.succeed();

      return ok({
        assistantErrorMessage: null,
        messages: [userMessage, assistantAppendResult.value.message],
        specSave: saveSpecResult.value,
        session: assistantAppendResult.value.session,
      });
    },
  };
}
