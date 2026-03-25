import type { ProjectReferenceTagDocument } from '@/domain/project/project-reference-tag-model';
import type { Result } from '@/shared/contracts/result';

import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';
import type { ProjectInspectorPort, ProjectStoragePort } from '@/application/project/project.ports';

export interface SaveProjectReferenceTagsUseCase {
  execute(input: {
    rootPath: string;
    referenceTags: ProjectReferenceTagDocument;
  }): Promise<Result<ProjectReferenceTagDocument>>;
}

export function createSaveProjectReferenceTagsUseCase(dependencies: {
  projectInspector: ProjectInspectorPort;
  projectStorage: ProjectStoragePort;
}): SaveProjectReferenceTagsUseCase {
  return {
    async execute(input) {
      const storageResult = await ensureProjectStorageReady(dependencies, {
        notWritableMessage: '참조 태그를 저장하려면 프로젝트 경로에 쓰기 권한이 필요합니다.',
        rootPath: input.rootPath,
      });
      if (!storageResult.ok) {
        return storageResult;
      }

      return dependencies.projectStorage.saveProjectReferenceTags({
        rootPath: storageResult.value.projectMeta.rootPath,
        referenceTags: input.referenceTags,
      });
    },
  };
}
