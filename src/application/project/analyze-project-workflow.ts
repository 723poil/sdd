import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';
import type {
  ProjectAnalysisRunStatusPort,
  ProjectAnalyzerPort,
  ProjectInspectorPort,
  ProjectStoragePort,
} from '@/application/project/project.ports';
import { mergeReferenceAnalysisDraft } from '@/application/project/project-analysis-draft-merger';
import { createProjectError } from '@/domain/project/project-errors';
import type {
  ProjectAnalysis,
  ProjectAnalysisDraft,
  ProjectAnalysisMode,
} from '@/domain/project/project-analysis-model';
import type { ProjectInspection } from '@/domain/project/project-model';
import { err, ok, type Result } from '@/shared/contracts/result';

export interface AnalyzeProjectOutput {
  analysis: ProjectAnalysis;
  inspection: ProjectInspection;
}

export interface AnalyzeProjectWorkflowDependencies {
  analysisRunStatusStore: ProjectAnalysisRunStatusPort;
  projectAnalyzer: ProjectAnalyzerPort;
  projectInspector: ProjectInspectorPort;
  projectStorage: ProjectStoragePort;
}

export interface AnalyzeProjectWorkflowInput {
  mode: ProjectAnalysisMode;
  rootPath: string;
}

export async function executeAnalyzeProjectWorkflow(
  dependencies: AnalyzeProjectWorkflowDependencies,
  input: AnalyzeProjectWorkflowInput,
): Promise<Result<AnalyzeProjectOutput>> {
  if (input.mode === 'references') {
    return executeReferenceOnlyAnalysis(dependencies, input);
  }

  return executeFullAnalysis(dependencies, input);
}

async function executeFullAnalysis(
  dependencies: AnalyzeProjectWorkflowDependencies,
  input: AnalyzeProjectWorkflowInput,
): Promise<Result<AnalyzeProjectOutput>> {
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
    return err(createProjectError('PROJECT_ANALYSIS_CANCELLED', '분석이 취소되었습니다.'));
  }

  return persistAnalysisDraft({
    analysisDraft: analysisDraftResult.value,
    analysisRunStatusStore: dependencies.analysisRunStatusStore,
    inspection: storageResult.value.inspection,
    projectStorage: dependencies.projectStorage,
    rootPath: input.rootPath,
    failureStageMessage: '분석 결과 저장 실패',
    savingProgressMessage: '.sdd/analysis 문서와 인덱스를 기록하고 있습니다.',
    savingStageMessage: '분석 결과 저장 중',
    successProgressMessage: '구조화된 분석 결과가 프로젝트에 저장되었습니다.',
    successStageMessage: '분석 완료',
    stepIndex: 4,
  });
}

async function executeReferenceOnlyAnalysis(
  dependencies: AnalyzeProjectWorkflowDependencies,
  input: AnalyzeProjectWorkflowInput,
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

  return persistAnalysisDraft({
    analysisDraft,
    analysisRunStatusStore: dependencies.analysisRunStatusStore,
    inspection: storageResult.value.inspection,
    projectStorage: dependencies.projectStorage,
    rootPath: input.rootPath,
    failureStageMessage: '참조 분석 저장 실패',
    savingProgressMessage: '참조 구조와 파일 인덱스를 .sdd/analysis에 기록하고 있습니다.',
    savingStageMessage: '참조 분석 결과 저장 중',
    successProgressMessage: '참조 구조가 프로젝트에 저장되었습니다.',
    successStageMessage: '참조 분석 완료',
    stepIndex: 3,
  });
}

async function persistAnalysisDraft(input: {
  analysisDraft: ProjectAnalysisDraft;
  analysisRunStatusStore: ProjectAnalysisRunStatusPort;
  inspection: ProjectInspection;
  projectStorage: ProjectStoragePort;
  rootPath: string;
  failureStageMessage: string;
  savingProgressMessage: string;
  savingStageMessage: string;
  successProgressMessage: string;
  successStageMessage: string;
  stepIndex: number;
}): Promise<Result<AnalyzeProjectOutput>> {
  input.analysisRunStatusStore.updateAnalysisRunStatus({
    rootPath: input.rootPath,
    stageMessage: input.savingStageMessage,
    progressMessage: input.savingProgressMessage,
    stepIndex: input.stepIndex,
  });

  const writeResult = await input.projectStorage.writeProjectAnalysis({
    rootPath: input.rootPath,
    analysis: input.analysisDraft,
  });
  if (!writeResult.ok) {
    input.analysisRunStatusStore.updateAnalysisRunStatus({
      rootPath: input.rootPath,
      status: 'failed',
      stageMessage: input.failureStageMessage,
      progressMessage: null,
      stepIndex: input.stepIndex,
      completedAt: new Date().toISOString(),
      lastError: writeResult.error.message,
    });
    return writeResult;
  }

  input.analysisRunStatusStore.updateAnalysisRunStatus({
    rootPath: input.rootPath,
    status: 'succeeded',
    stageMessage: input.successStageMessage,
    progressMessage: input.successProgressMessage,
    stepIndex: input.stepIndex,
    completedAt: new Date().toISOString(),
    lastError: null,
  });

  return ok({
    analysis: writeResult.value.analysis,
    inspection: {
      ...input.inspection,
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

  return statusResult.value.status === 'cancelling' || statusResult.value.status === 'cancelled';
}
