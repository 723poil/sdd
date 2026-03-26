import { resolve } from 'node:path';

import type { ProjectMeta } from '@/domain/project/project-model';
import type { ProjectSpecMeta } from '@/domain/project/project-spec-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

import { readProjectMetaDocument } from '@/infrastructure/sdd/fs-project-storage-documents';
import { getProjectStoragePaths } from '@/infrastructure/sdd/fs-project-storage-paths';
import { readSpecMetaDocument } from '@/infrastructure/sdd/fs-project-spec-documents';

export interface ProjectStorageContext {
  projectJsonPath: string;
  projectMeta: ProjectMeta;
  rootPath: string;
  specsIndexPath: string;
}

export interface ProjectSpecStorageContext extends ProjectStorageContext {
  specMeta: ProjectSpecMeta;
}

export async function readRequiredProjectStorageContext(input: {
  missingProjectMessage: string;
  rootPath: string;
}): Promise<Result<ProjectStorageContext>> {
  const rootPath = resolve(input.rootPath);
  const { projectJsonPath, specsIndexPath } = getProjectStoragePaths(rootPath);
  const existingProjectMetaResult = await readProjectMetaDocument({ rootPath });
  if (!existingProjectMetaResult.ok) {
    return err(existingProjectMetaResult.error);
  }

  if (!existingProjectMetaResult.value) {
    return err(
      createProjectError(
        'PROJECT_NOT_INITIALIZED',
        input.missingProjectMessage,
        projectJsonPath,
      ),
    );
  }

  return ok({
    projectJsonPath,
    projectMeta: existingProjectMetaResult.value,
    rootPath,
    specsIndexPath,
  });
}

export async function readRequiredProjectSpecStorageContext(input: {
  missingProjectMessage: string;
  missingSpecMessage: string;
  rootPath: string;
  specId: string;
}): Promise<Result<ProjectSpecStorageContext>> {
  const projectContextResult = await readRequiredProjectStorageContext({
    missingProjectMessage: input.missingProjectMessage,
    rootPath: input.rootPath,
  });
  if (!projectContextResult.ok) {
    return err(projectContextResult.error);
  }

  const { rootPath, projectJsonPath, projectMeta, specsIndexPath } = projectContextResult.value;
  const existingSpecMetaResult = await readSpecMetaDocument({
    rootPath,
    specId: input.specId,
  });
  if (!existingSpecMetaResult.ok) {
    return err(existingSpecMetaResult.error);
  }

  if (!existingSpecMetaResult.value) {
    return err(
      createProjectError(
        'INVALID_PROJECT_STORAGE',
        input.missingSpecMessage,
        input.specId,
      ),
    );
  }

  return ok({
    projectJsonPath,
    projectMeta,
    rootPath,
    specMeta: existingSpecMetaResult.value,
    specsIndexPath,
  });
}
