import type { ProjectSpecApplyVersionResult } from '@/domain/project/project-spec-model';
import type { Result } from '@/shared/contracts/result';

import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';
import type {
  ProjectInspectorPort,
  ProjectStoragePort,
} from '@/application/project/project.ports';

export interface ApplyProjectSpecVersionUseCase {
  execute(input: {
    rootPath: string;
    revision: number;
    specId: string;
    versionId: string;
  }): Promise<Result<ProjectSpecApplyVersionResult>>;
}

export function createApplyProjectSpecVersionUseCase(dependencies: {
  projectInspector: ProjectInspectorPort;
  projectStorage: ProjectStoragePort;
}): ApplyProjectSpecVersionUseCase {
  return {
    async execute(input) {
      const storageResult = await ensureProjectStorageReady(dependencies, {
        notWritableMessage: '이전 버전을 적용하려면 프로젝트 경로에 쓰기 권한이 필요합니다.',
        rootPath: input.rootPath,
      });
      if (!storageResult.ok) {
        return storageResult;
      }

      return dependencies.projectStorage.applyProjectSpecVersion({
        rootPath: storageResult.value.projectMeta.rootPath,
        revision: input.revision,
        specId: input.specId,
        versionId: input.versionId,
      });
    },
  };
}
