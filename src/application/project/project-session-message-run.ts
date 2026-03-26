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
    requestText: string;
    rootPath: string;
    sessionId: string;
    startedAt: string;
  },
): Result<ProjectSessionMessageRunController> {
  const runControlResult = sessionMessageRunStatusStore.beginSessionMessageRun({
    rootPath: input.rootPath,
    sessionId: input.sessionId,
    requestText: input.requestText,
    stageMessage: '메시지 저장 중',
    progressMessage: '대화 로그에 질문을 기록하고 있습니다.',
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
        stepIndex: 3,
        completedAt: new Date().toISOString(),
        lastError: null,
      });
    },
  };
}
