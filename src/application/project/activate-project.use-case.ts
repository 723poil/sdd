import type { InspectProjectUseCase } from '@/application/project/inspect-project.use-case';
import type { InitializeProjectStorageUseCase } from '@/application/project/initialize-project-storage.use-case';
import type { RecentProjectsStorePort } from '@/application/project/project.ports';
import type { ProjectInspection, RecentProject } from '@/domain/project/project-model';
import { ok, type Result } from '@/shared/contracts/result';

export interface ActivateProjectOutput {
  inspection: ProjectInspection;
  recentProjects: RecentProject[];
}

export interface ActivateProjectUseCase {
  execute(input: { rootPath: string }): Promise<Result<ActivateProjectOutput>>;
}

export function createActivateProjectUseCase(dependencies: {
  inspectProject: InspectProjectUseCase;
  initializeProjectStorage: InitializeProjectStorageUseCase;
  recentProjectsStore: RecentProjectsStorePort;
}): ActivateProjectUseCase {
  return {
    async execute(input) {
      const inspectionResult = await dependencies.inspectProject.execute(input);
      if (!inspectionResult.ok) {
        return inspectionResult;
      }

      let inspection = inspectionResult.value;
      if (inspection.initializationState === 'missing' && inspection.isWritable) {
        const initializationResult = await dependencies.initializeProjectStorage.execute({
          rootPath: inspection.rootPath,
        });
        if (!initializationResult.ok) {
          return initializationResult;
        }

        inspection = initializationResult.value.inspection;
      }

      const existingRecentProjectsResult =
        await dependencies.recentProjectsStore.listRecentProjects();
      if (!existingRecentProjectsResult.ok) {
        return existingRecentProjectsResult;
      }

      const rememberedProjectName =
        existingRecentProjectsResult.value.find(
          (project) => project.rootPath === inspection.rootPath,
        )?.projectName ?? inspection.projectName;
      inspection = {
        ...inspection,
        projectName: rememberedProjectName,
      };

      const rememberResult = await dependencies.recentProjectsStore.upsertRecentProject({
        rootPath: inspection.rootPath,
        projectName: rememberedProjectName,
      });
      if (!rememberResult.ok) {
        return rememberResult;
      }

      const recentProjectsResult = await dependencies.recentProjectsStore.listRecentProjects();
      if (!recentProjectsResult.ok) {
        return recentProjectsResult;
      }

      return ok({
        inspection,
        recentProjects: recentProjectsResult.value,
      });
    },
  };
}
