import type { ProjectSpecVersionDiff } from '@/domain/project/project-spec-model';
import type { Result } from '@/shared/contracts/result';

import type { ProjectStoragePort } from '@/application/project/project.ports';

export interface ReadProjectSpecVersionDiffUseCase {
  execute(input: {
    currentMarkdown?: string | null;
    currentTitle?: string | null;
    rootPath: string;
    specId: string;
    versionId: string;
  }): Promise<Result<ProjectSpecVersionDiff>>;
}

export function createReadProjectSpecVersionDiffUseCase(dependencies: {
  projectStorage: ProjectStoragePort;
}): ReadProjectSpecVersionDiffUseCase {
  return {
    async execute(input) {
      return dependencies.projectStorage.readProjectSpecVersionDiff(input);
    },
  };
}
