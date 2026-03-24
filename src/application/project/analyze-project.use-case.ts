import type {
  ProjectAnalysisRunStatusPort,
  ProjectAnalyzerPort,
  ProjectInspectorPort,
  ProjectStoragePort,
} from '@/application/project/project.ports';
import type { ProjectAnalysis } from '@/domain/project/project-analysis-model';
import type { ProjectInspection } from '@/domain/project/project-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';

export interface AnalyzeProjectOutput {
  analysis: ProjectAnalysis;
  inspection: ProjectInspection;
}

export interface AnalyzeProjectUseCase {
  execute(input: { rootPath: string }): Promise<Result<AnalyzeProjectOutput>>;
}

export function createAnalyzeProjectUseCase(dependencies: {
  analysisRunStatusStore: ProjectAnalysisRunStatusPort;
  projectAnalyzer: ProjectAnalyzerPort;
  projectInspector: ProjectInspectorPort;
  projectStorage: ProjectStoragePort;
}): AnalyzeProjectUseCase {
  return {
    async execute(input) {
      const storageResult = await ensureProjectStorageReady(dependencies, {
        notWritableMessage: '분석 결과를 저장하려면 프로젝트 경로에 쓰기 권한이 필요합니다.',
        rootPath: input.rootPath,
      });
      if (!storageResult.ok) {
        return storageResult;
      }

      const analysisDraftResult = await dependencies.projectAnalyzer.analyzeProject({
        projectName: storageResult.value.projectMeta.projectName,
        rootPath: storageResult.value.projectMeta.rootPath,
      });
      if (!analysisDraftResult.ok) {
        return analysisDraftResult;
      }

      if (isAnalysisCancellationRequested(dependencies, input.rootPath)) {
        return err(
          createProjectError('PROJECT_ANALYSIS_CANCELLED', '에이전트 분석이 취소되었습니다.'),
        );
      }

      dependencies.analysisRunStatusStore.updateAnalysisRunStatus({
        rootPath: input.rootPath,
        stageMessage: '분석 결과 저장 중',
        progressMessage: '.sdd/analysis 문서와 인덱스를 기록하고 있습니다.',
        stepIndex: 4,
      });

      const writeResult = await dependencies.projectStorage.writeProjectAnalysis({
        rootPath: input.rootPath,
        analysis: analysisDraftResult.value,
      });
      if (!writeResult.ok) {
        dependencies.analysisRunStatusStore.updateAnalysisRunStatus({
          rootPath: input.rootPath,
          status: 'failed',
          stageMessage: '분석 결과 저장 실패',
          progressMessage: null,
          stepIndex: 4,
          completedAt: new Date().toISOString(),
          lastError: writeResult.error.message,
        });
        return writeResult;
      }

      dependencies.analysisRunStatusStore.updateAnalysisRunStatus({
        rootPath: input.rootPath,
        status: 'succeeded',
        stageMessage: '에이전트 분석 완료',
        progressMessage: '구조화된 분석 결과가 프로젝트에 저장되었습니다.',
        stepIndex: 4,
        completedAt: new Date().toISOString(),
        lastError: null,
      });

      return ok({
        analysis: writeResult.value.analysis,
        inspection: {
          ...storageResult.value.inspection,
          initializationState: 'ready',
          projectMeta: writeResult.value.projectMeta,
        },
      });
    },
  };
}

function isAnalysisCancellationRequested(
  dependencies: { analysisRunStatusStore: ProjectAnalysisRunStatusPort },
  rootPath: string,
): boolean {
  const statusResult = dependencies.analysisRunStatusStore.readAnalysisRunStatus({ rootPath });
  if (!statusResult.ok) {
    return false;
  }

  return (
    statusResult.value.status === 'cancelling' || statusResult.value.status === 'cancelled'
  );
}
