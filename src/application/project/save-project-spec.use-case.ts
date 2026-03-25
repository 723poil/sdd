import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
import type { Result } from '@/shared/contracts/result';

import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';
import type {
  ProjectInspectorPort,
  ProjectStoragePort,
} from '@/application/project/project.ports';

export interface SaveProjectSpecUseCase {
  execute(input: {
    rootPath: string;
    specId: string;
    revision: number;
    title: string;
    markdown: string;
  }): Promise<Result<ProjectSpecDocument>>;
}

export function createSaveProjectSpecUseCase(dependencies: {
  projectInspector: ProjectInspectorPort;
  projectStorage: ProjectStoragePort;
}): SaveProjectSpecUseCase {
  return {
    async execute(input) {
      const storageResult = await ensureProjectStorageReady(dependencies, {
        notWritableMessage: '명세를 저장하려면 프로젝트 경로에 쓰기 권한이 필요합니다.',
        rootPath: input.rootPath,
      });
      if (!storageResult.ok) {
        return storageResult;
      }

      return dependencies.projectStorage.saveProjectSpec({
        markdown: input.markdown,
        revision: input.revision,
        rootPath: storageResult.value.projectMeta.rootPath,
        specId: input.specId,
        title: input.title,
      });
    },
  };
}
