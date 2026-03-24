import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
import type { Result } from '@/shared/contracts/result';

import type { ProjectStoragePort } from '@/application/project/project.ports';

export interface ReadProjectSpecsUseCase {
  execute(input: { rootPath: string }): Promise<Result<ProjectSpecDocument[]>>;
}

export function createReadProjectSpecsUseCase(dependencies: {
  projectStorage: ProjectStoragePort;
}): ReadProjectSpecsUseCase {
  return {
    async execute(input) {
      return dependencies.projectStorage.readProjectSpecs(input);
    },
  };
}
