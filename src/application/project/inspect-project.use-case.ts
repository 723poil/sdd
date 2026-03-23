import type { ProjectInspectorPort, ProjectStoragePort } from '@/application/project/project.ports';
import type { ProjectInspection } from '@/domain/project/project-model';
import { ok, type Result } from '@/shared/contracts/result';

export interface InspectProjectUseCase {
  execute(input: { rootPath: string }): Promise<Result<ProjectInspection>>;
}

export function createInspectProjectUseCase(dependencies: {
  projectInspector: ProjectInspectorPort;
  projectStorage: ProjectStoragePort;
}): InspectProjectUseCase {
  return {
    async execute(input) {
      const directoryResult = await dependencies.projectInspector.inspectDirectory(input);
      if (!directoryResult.ok) {
        return directoryResult;
      }

      const directoryStatus = directoryResult.value;
      let projectMeta = null;

      if (directoryStatus.hasSddDirectory) {
        const projectMetaResult = await dependencies.projectStorage.readProjectMeta({
          rootPath: directoryStatus.rootPath,
        });
        if (!projectMetaResult.ok) {
          return projectMetaResult;
        }

        projectMeta = projectMetaResult.value;
      }

      return ok({
        ...directoryStatus,
        initializationState: projectMeta ? 'ready' : 'missing',
        projectMeta,
      });
    },
  };
}
