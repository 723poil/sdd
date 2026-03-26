import type { ProjectSpecDeleteVersionResult } from '@/domain/project/project-spec-model';
import type { Result } from '@/shared/contracts/result';

import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';
import type {
  ProjectInspectorPort,
  ProjectStoragePort,
} from '@/application/project/project.ports';

export interface DeleteProjectSpecVersionUseCase {
  execute(input: {
    rootPath: string;
    revision: number;
    specId: string;
    versionId: string;
  }): Promise<Result<ProjectSpecDeleteVersionResult>>;
}

export function createDeleteProjectSpecVersionUseCase(dependencies: {
  projectInspector: ProjectInspectorPort;
  projectStorage: ProjectStoragePort;
}): DeleteProjectSpecVersionUseCase {
  return {
    async execute(input) {
      const storageResult = await ensureProjectStorageReady(dependencies, {
        notWritableMessage: '이전 버전을 삭제하려면 프로젝트 경로에 쓰기 권한이 필요합니다.',
        rootPath: input.rootPath,
      });
      if (!storageResult.ok) {
        return storageResult;
      }

      return dependencies.projectStorage.deleteProjectSpecVersion({
        rootPath: storageResult.value.projectMeta.rootPath,
        revision: input.revision,
        specId: input.specId,
        versionId: input.versionId,
      });
    },
  };
}
