import type { ProjectInspection } from '@/domain/project/project-model';
import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
import type { Result } from '@/shared/contracts/result';
import { ok } from '@/shared/contracts/result';

import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';
import type {
  ProjectInspectorPort,
  ProjectStoragePort,
} from '@/application/project/project.ports';

export interface CreateProjectSpecOutput {
  inspection: ProjectInspection;
  spec: ProjectSpecDocument;
}

export interface CreateProjectSpecUseCase {
  execute(input: { rootPath: string; title?: string | null }): Promise<Result<CreateProjectSpecOutput>>;
}

export function createCreateProjectSpecUseCase(dependencies: {
  projectInspector: ProjectInspectorPort;
  projectStorage: ProjectStoragePort;
}): CreateProjectSpecUseCase {
  return {
    async execute(input) {
      const storageResult = await ensureProjectStorageReady(dependencies, {
        notWritableMessage: '새 명세를 만들려면 프로젝트 경로에 쓰기 권한이 필요합니다.',
        rootPath: input.rootPath,
      });
      if (!storageResult.ok) {
        return storageResult;
      }

      const createSpecResult = await dependencies.projectStorage.createProjectSpec({
        rootPath: storageResult.value.projectMeta.rootPath,
        ...(typeof input.title !== 'undefined' ? { title: input.title } : {}),
      });
      if (!createSpecResult.ok) {
        return createSpecResult;
      }

      return ok({
        inspection: {
          ...storageResult.value.inspection,
          initializationState: 'ready',
          projectMeta: createSpecResult.value.projectMeta,
        },
        spec: createSpecResult.value.spec,
      });
    },
  };
}
