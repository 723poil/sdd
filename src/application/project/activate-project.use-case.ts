import type { InspectProjectUseCase } from '@/application/project/inspect-project.use-case';
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
  recentProjectsStore: RecentProjectsStorePort;
}): ActivateProjectUseCase {
  return {
    async execute(input) {
      const inspectionResult = await dependencies.inspectProject.execute(input);
      if (!inspectionResult.ok) {
        return inspectionResult;
      }

      const inspection = inspectionResult.value;
      const rememberResult = await dependencies.recentProjectsStore.upsertRecentProject({
        rootPath: inspection.rootPath,
        projectName: inspection.projectName,
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
