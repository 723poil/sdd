import type { ProjectAnalysisRunStatusPort } from '@/application/project/project.ports';
import {
  createIdleProjectAnalysisRunStatus,
  type ProjectAnalysisRunStatus,
} from '@/domain/project/project-analysis-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok } from '@/shared/contracts/result';

export function createInMemoryProjectAnalysisRunStatusStore(): ProjectAnalysisRunStatusPort {
  const statusMap = new Map<string, ProjectAnalysisRunStatus>();
  const controllerMap = new Map<string, AbortController>();

  return {
    readAnalysisRunStatus(input) {
      return ok(getCurrentStatus(statusMap, input.rootPath));
    },

    beginAnalysisRun(input) {
      const currentStatus = getCurrentStatus(statusMap, input.rootPath);
      if (currentStatus.status === 'running' || currentStatus.status === 'cancelling') {
        return err(
          createProjectError(
            'PROJECT_ANALYSIS_ALREADY_RUNNING',
            '이 프로젝트의 분석이 이미 실행 중입니다.',
          ),
        );
      }

      const nextStatus: ProjectAnalysisRunStatus = {
        rootPath: input.rootPath,
        status: 'running',
        stepIndex: input.stepIndex,
        stepTotal: input.stepTotal,
        stageMessage: input.stageMessage,
        progressMessage: input.progressMessage ?? null,
        startedAt: input.startedAt,
        updatedAt: input.startedAt,
        completedAt: null,
        lastError: null,
      };
      const controller = new AbortController();
      statusMap.set(input.rootPath, nextStatus);
      controllerMap.set(input.rootPath, controller);

      return ok({
        signal: controller.signal,
        status: nextStatus,
      });
    },

    cancelAnalysisRun(input) {
      const currentStatus = getCurrentStatus(statusMap, input.rootPath);
      if (currentStatus.status !== 'running' && currentStatus.status !== 'cancelling') {
        return ok(currentStatus);
      }

      if (currentStatus.status === 'cancelling') {
        return ok(currentStatus);
      }

      controllerMap.get(input.rootPath)?.abort();

      const nextStatus: ProjectAnalysisRunStatus = {
        ...currentStatus,
        status: 'cancelling',
        stageMessage: '분석 취소 중',
        progressMessage: 'Codex 실행을 종료하고 있습니다.',
        updatedAt: new Date().toISOString(),
        completedAt: null,
        lastError: null,
      };
      statusMap.set(input.rootPath, nextStatus);

      return ok(nextStatus);
    },

    updateAnalysisRunStatus(input) {
      const currentStatus = getCurrentStatus(statusMap, input.rootPath);
      const updatedAt = input.updatedAt ?? new Date().toISOString();
      const nextStatus: ProjectAnalysisRunStatus = {
        ...currentStatus,
        status: input.status ?? currentStatus.status,
        stepIndex: input.stepIndex ?? currentStatus.stepIndex,
        stepTotal: input.stepTotal ?? currentStatus.stepTotal,
        stageMessage: input.stageMessage ?? currentStatus.stageMessage,
        progressMessage:
          typeof input.progressMessage === 'undefined'
            ? currentStatus.progressMessage
            : input.progressMessage,
        updatedAt,
        completedAt:
          typeof input.completedAt === 'undefined' ? currentStatus.completedAt : input.completedAt,
        lastError:
          typeof input.lastError === 'undefined' ? currentStatus.lastError : input.lastError,
      };
      statusMap.set(input.rootPath, nextStatus);
      if (nextStatus.status !== 'running' && nextStatus.status !== 'cancelling') {
        controllerMap.delete(input.rootPath);
      }

      return ok(nextStatus);
    },
  };
}

function getCurrentStatus(
  statusMap: Map<string, ProjectAnalysisRunStatus>,
  rootPath: string,
): ProjectAnalysisRunStatus {
  return statusMap.get(rootPath) ?? createIdleProjectAnalysisRunStatus(rootPath);
}
