import type {
  ProjectAnalysisRunStatusPort,
  ProjectAnalyzerPort,
  ProjectInspectorPort,
  ProjectStoragePort,
} from '@/application/project/project.ports';
import type { ProjectAnalysis, ProjectAnalysisMode } from '@/domain/project/project-analysis-model';
import type { ProjectInspection } from '@/domain/project/project-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';
import { mergeReferenceAnalysisDraft } from '@/application/project/project-analysis-draft-merger';

export interface AnalyzeProjectOutput {
  analysis: ProjectAnalysis;
  inspection: ProjectInspection;
}

export interface AnalyzeProjectUseCase {
  execute(input: { mode: ProjectAnalysisMode; rootPath: string }): Promise<Result<AnalyzeProjectOutput>>;
}

export function createAnalyzeProjectUseCase(dependencies: {
  analysisRunStatusStore: ProjectAnalysisRunStatusPort;
  projectAnalyzer: ProjectAnalyzerPort;
  projectInspector: ProjectInspectorPort;
  projectStorage: ProjectStoragePort;
}): AnalyzeProjectUseCase {
  return {
    async execute(input) {
      if (input.mode === 'references') {
        return executeReferenceOnlyAnalysis(dependencies, input);
      }

      const storageResult = await ensureProjectStorageReady(dependencies, {
        notWritableMessage: '분석 결과를 저장하려면 프로젝트 경로에 쓰기 권한이 필요합니다.',
        rootPath: input.rootPath,
      });
      if (!storageResult.ok) {
        return storageResult;
      }

      const analysisDraftResult = await dependencies.projectAnalyzer.analyzeProject({
        mode: input.mode,
        projectName: storageResult.value.projectMeta.projectName,
        rootPath: storageResult.value.projectMeta.rootPath,
      });
      if (!analysisDraftResult.ok) {
        return analysisDraftResult;
      }

      if (isAnalysisCancellationRequested(dependencies, input.rootPath)) {
        return err(
          createProjectError('PROJECT_ANALYSIS_CANCELLED', '분석이 취소되었습니다.'),
        );
      }

      const analysisDraft = analysisDraftResult.value;

      dependencies.analysisRunStatusStore.updateAnalysisRunStatus({
        rootPath: input.rootPath,
        stageMessage: '분석 결과 저장 중',
        progressMessage: '.sdd/analysis 문서와 인덱스를 기록하고 있습니다.',
        stepIndex: 4,
      });

      const writeResult = await dependencies.projectStorage.writeProjectAnalysis({
        rootPath: input.rootPath,
        analysis: analysisDraft,
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
        stageMessage: '분석 완료',
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

async function executeReferenceOnlyAnalysis(
  dependencies: {
    analysisRunStatusStore: ProjectAnalysisRunStatusPort;
    projectAnalyzer: ProjectAnalyzerPort;
    projectInspector: ProjectInspectorPort;
    projectStorage: ProjectStoragePort;
  },
  input: { mode: ProjectAnalysisMode; rootPath: string },
): Promise<Result<AnalyzeProjectOutput>> {
  const inspectionResult = await readProjectInspection(dependencies, {
    rootPath: input.rootPath,
  });
  if (!inspectionResult.ok) {
    return inspectionResult;
  }

  const inspection = inspectionResult.value;
  const analysisDraftResult = await dependencies.projectAnalyzer.analyzeProject({
    mode: 'references',
    projectName: inspection.projectMeta?.projectName ?? inspection.projectName,
    rootPath: inspection.rootPath,
  });
  if (!analysisDraftResult.ok) {
    return analysisDraftResult;
  }

  if (isAnalysisCancellationRequested(dependencies, input.rootPath)) {
    return err(createProjectError('PROJECT_ANALYSIS_CANCELLED', '분석이 취소되었습니다.'));
  }

  const existingAnalysisResult = await dependencies.projectStorage.readProjectAnalysis({
    rootPath: input.rootPath,
  });
  if (!existingAnalysisResult.ok) {
    return existingAnalysisResult;
  }

  const analysisDraft = mergeReferenceAnalysisDraft({
    existingAnalysis: existingAnalysisResult.value,
    referenceDraft: analysisDraftResult.value,
  });

  if (!inspection.isWritable) {
    dependencies.analysisRunStatusStore.updateAnalysisRunStatus({
      rootPath: input.rootPath,
      status: 'succeeded',
      stageMessage: '참조 분석 완료',
      progressMessage: '쓰기 권한이 없어 결과를 저장하지 않고 현재 화면에만 표시했습니다.',
      stepIndex: 3,
      completedAt: new Date().toISOString(),
      lastError: null,
    });

    return ok({
      analysis: analysisDraft,
      inspection,
    });
  }

  dependencies.analysisRunStatusStore.updateAnalysisRunStatus({
    rootPath: input.rootPath,
    stageMessage: '참조 분석 결과 저장 중',
    progressMessage: '참조 구조와 파일 인덱스를 .sdd/analysis에 기록하고 있습니다.',
    stepIndex: 3,
  });

  const storageResult = await ensureProjectStorageReady(dependencies, {
    notWritableMessage: '분석 결과를 저장하려면 프로젝트 경로에 쓰기 권한이 필요합니다.',
    rootPath: input.rootPath,
  });
  if (!storageResult.ok) {
    dependencies.analysisRunStatusStore.updateAnalysisRunStatus({
      rootPath: input.rootPath,
      status: 'failed',
      stageMessage: '참조 분석 저장 실패',
      progressMessage: null,
      stepIndex: 3,
      completedAt: new Date().toISOString(),
      lastError: storageResult.error.message,
    });
    return storageResult;
  }

  const writeResult = await dependencies.projectStorage.writeProjectAnalysis({
    rootPath: input.rootPath,
    analysis: analysisDraft,
  });
  if (!writeResult.ok) {
    dependencies.analysisRunStatusStore.updateAnalysisRunStatus({
      rootPath: input.rootPath,
      status: 'failed',
      stageMessage: '참조 분석 저장 실패',
      progressMessage: null,
      stepIndex: 3,
      completedAt: new Date().toISOString(),
      lastError: writeResult.error.message,
    });
    return writeResult;
  }

  dependencies.analysisRunStatusStore.updateAnalysisRunStatus({
    rootPath: input.rootPath,
    status: 'succeeded',
    stageMessage: '참조 분석 완료',
    progressMessage: '참조 구조가 프로젝트에 저장되었습니다.',
    stepIndex: 3,
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
}

async function readProjectInspection(
  dependencies: {
    projectInspector: ProjectInspectorPort;
    projectStorage: ProjectStoragePort;
  },
  input: {
    rootPath: string;
  },
): Promise<Result<ProjectInspection>> {
  const directoryResult = await dependencies.projectInspector.inspectDirectory({
    rootPath: input.rootPath,
  });
  if (!directoryResult.ok) {
    return directoryResult;
  }

  const projectMetaResult = await dependencies.projectStorage.readProjectMeta({
    rootPath: directoryResult.value.rootPath,
  });
  if (!projectMetaResult.ok) {
    return projectMetaResult;
  }

  return ok({
    ...directoryResult.value,
    hasSddDirectory: projectMetaResult.value ? true : directoryResult.value.hasSddDirectory,
    initializationState: projectMetaResult.value ? 'ready' : 'missing',
    projectMeta: projectMetaResult.value,
  });
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
