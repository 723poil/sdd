import type { ProjectAnalysisDocumentLayoutMap } from '@/domain/project/project-analysis-model';
import type { Result } from '@/shared/contracts/result';

import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';
import type {
  ProjectInspectorPort,
  ProjectStoragePort,
} from '@/application/project/project.ports';

export interface SaveProjectAnalysisDocumentLayoutsUseCase {
  execute(input: {
    rootPath: string;
    documentLayouts: ProjectAnalysisDocumentLayoutMap;
  }): Promise<Result<ProjectAnalysisDocumentLayoutMap>>;
}

export function createSaveProjectAnalysisDocumentLayoutsUseCase(dependencies: {
  projectInspector: ProjectInspectorPort;
  projectStorage: ProjectStoragePort;
}): SaveProjectAnalysisDocumentLayoutsUseCase {
  return {
    async execute(input) {
      const storageResult = await ensureProjectStorageReady(dependencies, {
        notWritableMessage: '문서 카드 위치를 저장하려면 프로젝트 경로에 쓰기 권한이 필요합니다.',
        rootPath: input.rootPath,
      });
      if (!storageResult.ok) {
        return storageResult;
      }

      return dependencies.projectStorage.saveProjectAnalysisDocumentLayouts({
        rootPath: storageResult.value.projectMeta.rootPath,
        documentLayouts: input.documentLayouts,
      });
    },
  };
}
