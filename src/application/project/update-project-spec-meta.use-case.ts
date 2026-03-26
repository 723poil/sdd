import type {
  ProjectSpecMetaUpdateResult,
  ProjectSpecRelation,
  ProjectSpecStatus,
} from '@/domain/project/project-spec-model';
import type { Result } from '@/shared/contracts/result';

import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';
import type { ProjectInspectorPort, ProjectStoragePort } from '@/application/project/project.ports';

export interface UpdateProjectSpecMetaUseCase {
  execute(input: {
    rootPath: string;
    specId: string;
    revision: number;
    status: ProjectSpecStatus;
    relations: ProjectSpecRelation[];
  }): Promise<Result<ProjectSpecMetaUpdateResult>>;
}

export function createUpdateProjectSpecMetaUseCase(dependencies: {
  projectInspector: ProjectInspectorPort;
  projectStorage: ProjectStoragePort;
}): UpdateProjectSpecMetaUseCase {
  return {
    async execute(input) {
      const storageResult = await ensureProjectStorageReady(dependencies, {
        notWritableMessage: '명세 메타데이터를 저장하려면 프로젝트 경로에 쓰기 권한이 필요합니다.',
        rootPath: input.rootPath,
      });
      if (!storageResult.ok) {
        return storageResult;
      }

      return dependencies.projectStorage.updateProjectSpecMeta({
        rootPath: storageResult.value.projectMeta.rootPath,
        specId: input.specId,
        revision: input.revision,
        status: input.status,
        relations: input.relations,
      });
    },
  };
}
