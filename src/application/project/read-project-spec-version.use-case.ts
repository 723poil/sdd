import type { ProjectSpecVersionDocument } from '@/domain/project/project-spec-model';
import type { Result } from '@/shared/contracts/result';

import type { ProjectStoragePort } from '@/application/project/project.ports';

export interface ReadProjectSpecVersionUseCase {
  execute(input: {
    rootPath: string;
    specId: string;
    versionId: string;
  }): Promise<Result<ProjectSpecVersionDocument>>;
}

export function createReadProjectSpecVersionUseCase(dependencies: {
  projectStorage: ProjectStoragePort;
}): ReadProjectSpecVersionUseCase {
  return {
    async execute(input) {
      return dependencies.projectStorage.readProjectSpecVersion(input);
    },
  };
}
