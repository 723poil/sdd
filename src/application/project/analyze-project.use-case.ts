import type {
  ProjectAnalyzerPort,
  ProjectInspectorPort,
  ProjectStoragePort,
} from '@/application/project/project.ports';
import type { ProjectAnalysis } from '@/domain/project/project-analysis-model';
import type { ProjectInspection } from '@/domain/project/project-model';
import { ok, type Result } from '@/shared/contracts/result';

import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';

export interface AnalyzeProjectOutput {
  analysis: ProjectAnalysis;
  inspection: ProjectInspection;
}

export interface AnalyzeProjectUseCase {
  execute(input: { rootPath: string }): Promise<Result<AnalyzeProjectOutput>>;
}

export function createAnalyzeProjectUseCase(dependencies: {
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

      const writeResult = await dependencies.projectStorage.writeProjectAnalysis({
        rootPath: input.rootPath,
        analysis: analysisDraftResult.value,
      });
      if (!writeResult.ok) {
        return writeResult;
      }

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
