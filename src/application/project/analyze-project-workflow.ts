import {
  reportAnalysisPersistenceFailed,
  reportAnalysisPersistenceStarted,
  reportAnalysisPersistenceSucceeded,
  reportTransientReferenceAnalysisSucceeded,
  type AnalysisPersistenceStatusCopy,
} from '@/application/project/analysis-run-status-reporter';
import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';
import type {
  ProjectAnalysisRunStatusPort,
  ProjectAnalyzerPort,
  ProjectInspectorPort,
  ProjectAnalysisStoragePort,
} from '@/application/project/project.ports';
import type { AgentCliId } from '@/domain/app-settings/agent-cli-connection-model';
import { mergeReferenceAnalysisDraft } from '@/application/project/project-analysis-draft-merger';
import { readProjectInspection } from '@/application/project/read-project-inspection';
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
  projectStorage: ProjectAnalysisStoragePort;
}

export interface AnalyzeProjectWorkflowInput {
  agentId: AgentCliId;
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
    agentId: input.agentId,
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
    agentId: input.agentId,
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
    reportTransientReferenceAnalysisSucceeded(dependencies.analysisRunStatusStore, input.rootPath);

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
    reportAnalysisPersistenceFailed(dependencies.analysisRunStatusStore, {
      errorMessage: storageResult.error.message,
      failureStageMessage: '참조 분석 저장 실패',
      rootPath: input.rootPath,
      stepIndex: 3,
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
  inspection: AnalyzeProjectOutput['inspection'];
  projectStorage: ProjectAnalysisStoragePort;
  rootPath: string;
} & AnalysisPersistenceStatusCopy): Promise<Result<AnalyzeProjectOutput>> {
  reportAnalysisPersistenceStarted(input.analysisRunStatusStore, {
    rootPath: input.rootPath,
    savingProgressMessage: input.savingProgressMessage,
    savingStageMessage: input.savingStageMessage,
    stepIndex: input.stepIndex,
  });

  const writeResult = await input.projectStorage.writeProjectAnalysis({
    rootPath: input.rootPath,
    analysis: input.analysisDraft,
  });
  if (!writeResult.ok) {
    reportAnalysisPersistenceFailed(input.analysisRunStatusStore, {
      errorMessage: writeResult.error.message,
      failureStageMessage: input.failureStageMessage,
      rootPath: input.rootPath,
      stepIndex: input.stepIndex,
    });
    return writeResult;
  }

  reportAnalysisPersistenceSucceeded(input.analysisRunStatusStore, {
    rootPath: input.rootPath,
    stepIndex: input.stepIndex,
    successProgressMessage: input.successProgressMessage,
    successStageMessage: input.successStageMessage,
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
