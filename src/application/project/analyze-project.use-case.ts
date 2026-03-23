import type {
  ProjectAnalyzerPort,
  ProjectInspectorPort,
  ProjectStoragePort,
} from '@/application/project/project.ports';
import { createProjectError } from '@/domain/project/project-errors';
import type { ProjectAnalysis } from '@/domain/project/project-analysis-model';
import type { ProjectInspection } from '@/domain/project/project-model';
import { err, ok, type Result } from '@/shared/contracts/result';

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
      const directoryResult = await dependencies.projectInspector.inspectDirectory(input);
      if (!directoryResult.ok) {
        return directoryResult;
      }

      if (!directoryResult.value.isWritable) {
        return err(
          createProjectError(
            'PROJECT_NOT_WRITABLE',
            '분석 결과를 저장하려면 프로젝트 경로에 쓰기 권한이 필요합니다.',
          ),
        );
      }

      const projectMetaResult = await dependencies.projectStorage.readProjectMeta(input);
      if (!projectMetaResult.ok) {
        return projectMetaResult;
      }

      const projectMeta = projectMetaResult.value;
      if (!projectMeta) {
        return err(
          createProjectError(
            'PROJECT_NOT_INITIALIZED',
            '먼저 작업 공간 준비를 완료해야 분석을 실행할 수 있습니다.',
          ),
        );
      }

      const analysisDraftResult = await dependencies.projectAnalyzer.analyzeProject({
        projectName: projectMeta.projectName,
        rootPath: projectMeta.rootPath,
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
          ...directoryResult.value,
          initializationState: 'ready',
          projectMeta: writeResult.value.projectMeta,
        },
      });
    },
  };
}
