import type { ProjectSessionMessageRunStatusPort } from '@/application/project/project.ports';
import {
  createIdleProjectSessionMessageRunStatus,
  type ProjectSessionMessageRunStatus,
} from '@/domain/project/project-session-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok } from '@/shared/contracts/result';

export function createInMemoryProjectSessionMessageRunStatusStore(): ProjectSessionMessageRunStatusPort {
  const statusMap = new Map<string, ProjectSessionMessageRunStatus>();
  const controllerMap = new Map<string, AbortController>();

  return {
    readSessionMessageRunStatus(input) {
      return ok(getCurrentStatus(statusMap, input.rootPath, input.sessionId));
    },

    beginSessionMessageRun(input) {
      const currentStatus = getCurrentStatus(statusMap, input.rootPath, input.sessionId);
      if (currentStatus.status === 'running' || currentStatus.status === 'cancelling') {
        return err(
          createProjectError(
            'PROJECT_SESSION_MESSAGE_ALREADY_RUNNING',
            '이 채팅은 이미 응답을 기다리고 있습니다.',
          ),
        );
      }

      const nextStatus: ProjectSessionMessageRunStatus = {
        rootPath: input.rootPath,
        sessionId: input.sessionId,
        status: 'running',
        stepIndex: input.stepIndex,
        stepTotal: input.stepTotal,
        stageMessage: input.stageMessage,
        progressMessage: input.progressMessage ?? null,
        requestText: input.requestText,
        startedAt: input.startedAt,
        updatedAt: input.startedAt,
        completedAt: null,
        lastError: null,
      };
      const controller = new AbortController();
      const key = createSessionMessageRunStatusKey(input.rootPath, input.sessionId);

      statusMap.set(key, nextStatus);
      controllerMap.set(key, controller);

      return ok({
        signal: controller.signal,
        status: nextStatus,
      });
    },

    cancelSessionMessageRun(input) {
      const currentStatus = getCurrentStatus(statusMap, input.rootPath, input.sessionId);
      if (currentStatus.status !== 'running' && currentStatus.status !== 'cancelling') {
        return ok(currentStatus);
      }

      if (currentStatus.status === 'cancelling') {
        return ok(currentStatus);
      }

      const key = createSessionMessageRunStatusKey(input.rootPath, input.sessionId);
      controllerMap.get(key)?.abort();

      const nextStatus: ProjectSessionMessageRunStatus = {
        ...currentStatus,
        status: 'cancelling',
        stageMessage: '요청 취소 중',
        progressMessage: 'Codex 응답 생성을 종료하고 있습니다.',
        updatedAt: new Date().toISOString(),
        completedAt: null,
        lastError: null,
      };
      statusMap.set(key, nextStatus);

      return ok(nextStatus);
    },

    updateSessionMessageRunStatus(input) {
      const key = createSessionMessageRunStatusKey(input.rootPath, input.sessionId);
      const currentStatus = getCurrentStatus(statusMap, input.rootPath, input.sessionId);
      const updatedAt = input.updatedAt ?? new Date().toISOString();
      const nextStatus: ProjectSessionMessageRunStatus = {
        ...currentStatus,
        status: input.status ?? currentStatus.status,
        stepIndex: input.stepIndex ?? currentStatus.stepIndex,
        stepTotal: input.stepTotal ?? currentStatus.stepTotal,
        stageMessage: input.stageMessage ?? currentStatus.stageMessage,
        progressMessage:
          typeof input.progressMessage === 'undefined'
            ? currentStatus.progressMessage
            : input.progressMessage,
        requestText:
          typeof input.requestText === 'undefined' ? currentStatus.requestText : input.requestText,
        updatedAt,
        completedAt:
          typeof input.completedAt === 'undefined' ? currentStatus.completedAt : input.completedAt,
        lastError:
          typeof input.lastError === 'undefined' ? currentStatus.lastError : input.lastError,
      };

      statusMap.set(key, nextStatus);
      if (nextStatus.status !== 'running' && nextStatus.status !== 'cancelling') {
        controllerMap.delete(key);
      }

      return ok(nextStatus);
    },
  };
}

function createSessionMessageRunStatusKey(rootPath: string, sessionId: string): string {
  return `${rootPath}::${sessionId}`;
}

function getCurrentStatus(
  statusMap: Map<string, ProjectSessionMessageRunStatus>,
  rootPath: string,
  sessionId: string,
): ProjectSessionMessageRunStatus {
  return (
    statusMap.get(createSessionMessageRunStatusKey(rootPath, sessionId)) ??
    createIdleProjectSessionMessageRunStatus({
      rootPath,
      sessionId,
    })
  );
}
