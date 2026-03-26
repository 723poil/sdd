import type {
  ProjectInspectionStoragePort,
  ProjectInspectorPort,
} from '@/application/project/project.ports';
import type { ProjectInspection } from '@/domain/project/project-model';
import { ok, type Result } from '@/shared/contracts/result';

export async function readProjectInspection(
  dependencies: {
    projectInspector: ProjectInspectorPort;
    projectStorage: ProjectInspectionStoragePort;
  },
  input: {
    rootPath: string;
  },
): Promise<Result<ProjectInspection>> {
  const directoryResult = await dependencies.projectInspector.inspectDirectory({
    rootPath: input.rootPath,
  });
  if (!directoryResult.ok) {
    return directoryResult;
  }

  const projectMetaResult = await dependencies.projectStorage.readProjectMeta({
    rootPath: directoryResult.value.rootPath,
  });
  if (!projectMetaResult.ok) {
    return projectMetaResult;
  }

  return ok({
    ...directoryResult.value,
    hasSddDirectory: projectMetaResult.value ? true : directoryResult.value.hasSddDirectory,
    initializationState: projectMetaResult.value ? 'ready' : 'missing',
    projectMeta: projectMetaResult.value,
  });
}
