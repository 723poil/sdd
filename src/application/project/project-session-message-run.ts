import type {
  ProjectSessionMessageRunControl,
  ProjectSessionMessageRunStatusPort,
} from '@/application/project/project.ports';
import { createProjectError } from '@/domain/project/project-errors';
import type { Result } from '@/shared/contracts/result';
import { err } from '@/shared/contracts/result';

export interface ProjectSessionMessageRunController {
  signal: AbortSignal;
  cancel(): Result<never>;
  fail(input: { message: string; stageMessage: string; stepIndex: number }): void;
  isCancellationRequested(): boolean;
  markReplyGenerationStarted(): void;
  markSpecApplyStarted(): void;
  succeed(): void;
}

export function beginProjectSessionMessageRun(
  sessionMessageRunStatusStore: ProjectSessionMessageRunStatusPort,
  input: {
    attachmentCount: number;
    requestAttachments: Array<{
      id: string;
      kind: 'image' | 'file';
      mimeType: string;
      name: string;
      previewUrl?: string | null;
      sizeBytes: number;
    }>;
    requestSummary: string | null;
    requestText: string | null;
    rootPath: string;
    sessionId: string;
    startedAt: string;
  },
): Result<ProjectSessionMessageRunController> {
  const runControlResult = sessionMessageRunStatusStore.beginSessionMessageRun({
    attachmentCount: input.attachmentCount,
    rootPath: input.rootPath,
    sessionId: input.sessionId,
    requestText: input.requestText,
    requestSummary: input.requestSummary,
    requestAttachments: input.requestAttachments,
    stageMessage: '메시지 저장 중',
    progressMessage:
      input.attachmentCount > 0
        ? '대화 로그와 첨부를 저장하고 있습니다.'
        : '대화 로그에 질문을 기록하고 있습니다.',
    startedAt: input.startedAt,
    stepIndex: 1,
    stepTotal: 3,
  });
  if (!runControlResult.ok) {
    return runControlResult;
  }

  return {
    ok: true,
    value: createProjectSessionMessageRunController({
      runControl: runControlResult.value,
      rootPath: input.rootPath,
      sessionId: input.sessionId,
      sessionMessageRunStatusStore,
    }),
  };
}

function createProjectSessionMessageRunController(input: {
  rootPath: string;
  runControl: ProjectSessionMessageRunControl;
  sessionId: string;
  sessionMessageRunStatusStore: ProjectSessionMessageRunStatusPort;
}): ProjectSessionMessageRunController {
  const updateRunStatus = (patch: {
    status?: 'running' | 'cancelling' | 'cancelled' | 'succeeded' | 'failed';
    stageMessage?: string;
    progressMessage?: string | null;
    requestText?: string | null;
    requestSummary?: string | null;
    attachmentCount?: number;
    requestAttachments?: Array<{
      id: string;
      kind: 'image' | 'file';
      mimeType: string;
      name: string;
      previewUrl?: string | null;
      sizeBytes: number;
    }>;
    stepIndex?: number;
    completedAt?: string | null;
    lastError?: string | null;
  }) =>
    input.sessionMessageRunStatusStore.updateSessionMessageRunStatus({
      rootPath: input.rootPath,
      sessionId: input.sessionId,
      ...patch,
    });

  return {
    signal: input.runControl.signal,
    cancel() {
      updateRunStatus({
        status: 'cancelled',
        stageMessage: '요청 취소됨',
        progressMessage: '응답 생성을 취소했습니다.',
        requestText: null,
        requestSummary: null,
        attachmentCount: 0,
        requestAttachments: [],
        completedAt: new Date().toISOString(),
        lastError: null,
      });

      return err(
        createProjectError('PROJECT_SESSION_MESSAGE_CANCELLED', '채팅 요청을 취소했습니다.'),
      );
    },
    fail({ message, stageMessage, stepIndex }) {
      updateRunStatus({
        status: 'failed',
        stageMessage,
        progressMessage: null,
        requestText: null,
        requestSummary: null,
        attachmentCount: 0,
        requestAttachments: [],
        stepIndex,
        completedAt: new Date().toISOString(),
        lastError: message,
      });
    },
    isCancellationRequested() {
      const statusResult = input.sessionMessageRunStatusStore.readSessionMessageRunStatus({
        rootPath: input.rootPath,
        sessionId: input.sessionId,
      });
      if (!statusResult.ok) {
        return false;
      }

      return (
        statusResult.value.status === 'cancelling' || statusResult.value.status === 'cancelled'
      );
    },
    markReplyGenerationStarted() {
      updateRunStatus({
        stageMessage: '응답 생성 중',
        progressMessage: 'Codex가 명세 초안을 정리하고 있습니다.',
        stepIndex: 2,
      });
    },
    markSpecApplyStarted() {
      updateRunStatus({
        stageMessage: '명세 반영 중',
        progressMessage: '응답과 명세 초안을 저장하고 있습니다.',
        stepIndex: 3,
      });
    },
    succeed() {
      updateRunStatus({
        status: 'succeeded',
        stageMessage: '응답 완료',
        progressMessage: '명세와 채팅에 응답을 반영했습니다.',
        requestText: null,
        requestSummary: null,
        attachmentCount: 0,
        requestAttachments: [],
        stepIndex: 3,
        completedAt: new Date().toISOString(),
        lastError: null,
      });
    },
  };
}
