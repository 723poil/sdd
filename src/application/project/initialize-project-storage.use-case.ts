import type { ProjectInspectorPort, ProjectStoragePort } from '@/application/project/project.ports';
import { createProjectError } from '@/domain/project/project-errors';
import type { ProjectInspection, ProjectStorageInitialization } from '@/domain/project/project-model';
import { err, ok, type Result } from '@/shared/contracts/result';

export interface InitializeProjectStorageOutput extends ProjectStorageInitialization {
  inspection: ProjectInspection;
}

export interface InitializeProjectStorageUseCase {
  execute(input: { rootPath: string }): Promise<Result<InitializeProjectStorageOutput>>;
}

export function createInitializeProjectStorageUseCase(dependencies: {
  projectInspector: ProjectInspectorPort;
  projectStorage: ProjectStoragePort;
}): InitializeProjectStorageUseCase {
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
            '선택한 프로젝트 경로에 .sdd 폴더를 생성할 쓰기 권한이 없습니다.',
          ),
        );
      }

      const initializationResult = await dependencies.projectStorage.initializeStorage(input);
      if (!initializationResult.ok) {
        return initializationResult;
      }

      const refreshedDirectoryResult = await dependencies.projectInspector.inspectDirectory(input);
      if (!refreshedDirectoryResult.ok) {
        return refreshedDirectoryResult;
      }

      return ok({
        ...initializationResult.value,
        inspection: {
          ...refreshedDirectoryResult.value,
          initializationState: 'ready',
          projectMeta: initializationResult.value.projectMeta,
        },
      });
    },
  };
}
