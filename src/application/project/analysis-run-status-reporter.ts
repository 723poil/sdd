import type { ProjectAnalysisRunStatusPort } from '@/application/project/project.ports';

export interface AnalysisPersistenceStatusCopy {
  failureStageMessage: string;
  savingProgressMessage: string;
  savingStageMessage: string;
  successProgressMessage: string;
  successStageMessage: string;
  stepIndex: number;
}

export function reportAnalysisPersistenceStarted(
  analysisRunStatusStore: ProjectAnalysisRunStatusPort,
  input: Pick<
    AnalysisPersistenceStatusCopy,
    'savingProgressMessage' | 'savingStageMessage' | 'stepIndex'
  > & {
    rootPath: string;
  },
): void {
  analysisRunStatusStore.updateAnalysisRunStatus({
    rootPath: input.rootPath,
    stageMessage: input.savingStageMessage,
    progressMessage: input.savingProgressMessage,
    stepIndex: input.stepIndex,
  });
}

export function reportAnalysisPersistenceFailed(
  analysisRunStatusStore: ProjectAnalysisRunStatusPort,
  input: Pick<AnalysisPersistenceStatusCopy, 'failureStageMessage' | 'stepIndex'> & {
    errorMessage: string;
    rootPath: string;
  },
): void {
  analysisRunStatusStore.updateAnalysisRunStatus({
    rootPath: input.rootPath,
    status: 'failed',
    stageMessage: input.failureStageMessage,
    progressMessage: null,
    stepIndex: input.stepIndex,
    completedAt: new Date().toISOString(),
    lastError: input.errorMessage,
  });
}

export function reportAnalysisPersistenceSucceeded(
  analysisRunStatusStore: ProjectAnalysisRunStatusPort,
  input: Pick<AnalysisPersistenceStatusCopy, 'stepIndex' | 'successProgressMessage' | 'successStageMessage'> & {
    rootPath: string;
  },
): void {
  analysisRunStatusStore.updateAnalysisRunStatus({
    rootPath: input.rootPath,
    status: 'succeeded',
    stageMessage: input.successStageMessage,
    progressMessage: input.successProgressMessage,
    stepIndex: input.stepIndex,
    completedAt: new Date().toISOString(),
    lastError: null,
  });
}

export function reportTransientReferenceAnalysisSucceeded(
  analysisRunStatusStore: ProjectAnalysisRunStatusPort,
  rootPath: string,
): void {
  analysisRunStatusStore.updateAnalysisRunStatus({
    rootPath,
    status: 'succeeded',
    stageMessage: '참조 분석 완료',
    progressMessage: '쓰기 권한이 없어 결과를 저장하지 않고 현재 화면에만 표시했습니다.',
    stepIndex: 3,
    completedAt: new Date().toISOString(),
    lastError: null,
  });
}
