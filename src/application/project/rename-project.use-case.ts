import type { InspectProjectUseCase } from '@/application/project/inspect-project.use-case';
import type {
  ProjectStoragePort,
  RecentProjectsStorePort,
} from '@/application/project/project.ports';
import { createProjectError } from '@/domain/project/project-errors';
import type { ProjectMeta, RecentProject } from '@/domain/project/project-model';
import { normalizeProjectName } from '@/domain/project/project-model';
import { err, ok, type Result } from '@/shared/contracts/result';

export interface RenameProjectOutput {
  projectMeta: ProjectMeta | null;
  recentProjects: RecentProject[];
}

export interface RenameProjectUseCase {
  execute(input: { rootPath: string; projectName: string }): Promise<Result<RenameProjectOutput>>;
}

export function createRenameProjectUseCase(dependencies: {
  inspectProject: InspectProjectUseCase;
  projectStorage: ProjectStoragePort;
  recentProjectsStore: RecentProjectsStorePort;
}): RenameProjectUseCase {
  return {
    async execute(input) {
      const projectName = normalizeProjectName(input.projectName);
      if (projectName.length === 0) {
        return err(createProjectError('INVALID_PROJECT_NAME', '프로젝트 이름을 입력해 주세요.'));
      }

      const inspectionResult = await dependencies.inspectProject.execute({
        rootPath: input.rootPath,
      });

      let projectMeta: ProjectMeta | null = null;
      if (
        inspectionResult.ok &&
        inspectionResult.value.projectMeta !== null &&
        inspectionResult.value.isWritable
      ) {
        const renameProjectResult = await dependencies.projectStorage.renameProject({
          rootPath: input.rootPath,
          projectName,
        });
        if (!renameProjectResult.ok) {
          return renameProjectResult;
        }

        projectMeta = renameProjectResult.value;
      } else if (inspectionResult.ok) {
        projectMeta = inspectionResult.value.projectMeta;
      }

      const renameRecentProjectResult = await dependencies.recentProjectsStore.renameRecentProject({
        rootPath: input.rootPath,
        projectName,
      });
      if (!renameRecentProjectResult.ok) {
        return renameRecentProjectResult;
      }

      return ok({
        projectMeta,
        recentProjects: renameRecentProjectResult.value,
      });
    },
  };
}
