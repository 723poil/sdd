import type {
  ProjectInspectorPort,
  ProjectStorageBootstrapPort,
} from '@/application/project/project.ports';
import { createProjectError } from '@/domain/project/project-errors';
import type {
  ProjectInspection,
  ProjectMeta,
  ProjectStorageInitialization,
} from '@/domain/project/project-model';
import { err, ok, type Result } from '@/shared/contracts/result';

export interface EnsureProjectStorageReadyOutput {
  initialization: ProjectStorageInitialization | null;
  inspection: ProjectInspection;
  projectMeta: ProjectMeta;
}

export async function ensureProjectStorageReady(
  dependencies: {
    projectInspector: ProjectInspectorPort;
    projectStorage: ProjectStorageBootstrapPort;
  },
  input: {
    notWritableMessage: string;
    rootPath: string;
  },
): Promise<Result<EnsureProjectStorageReadyOutput>> {
  const directoryResult = await dependencies.projectInspector.inspectDirectory({
    rootPath: input.rootPath,
  });
  if (!directoryResult.ok) {
    return directoryResult;
  }

  if (!directoryResult.value.isWritable) {
    return err(createProjectError('PROJECT_NOT_WRITABLE', input.notWritableMessage));
  }

  const projectMetaResult = await dependencies.projectStorage.readProjectMeta({
    rootPath: directoryResult.value.rootPath,
  });
  if (!projectMetaResult.ok) {
    return projectMetaResult;
  }

  if (projectMetaResult.value) {
    const inspection: ProjectInspection = {
      ...directoryResult.value,
      hasSddDirectory: true,
      initializationState: 'ready',
      projectMeta: projectMetaResult.value,
    };

    return ok({
      initialization: null,
      inspection,
      projectMeta: projectMetaResult.value,
    });
  }

  const initializationResult = await dependencies.projectStorage.initializeStorage({
    rootPath: directoryResult.value.rootPath,
  });
  if (!initializationResult.ok) {
    return initializationResult;
  }

  const inspection: ProjectInspection = {
    ...directoryResult.value,
    hasSddDirectory: true,
    initializationState: 'ready',
    projectMeta: initializationResult.value.projectMeta,
  };

  return ok({
    initialization: initializationResult.value,
    inspection,
    projectMeta: initializationResult.value.projectMeta,
  });
}
