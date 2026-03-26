import type { ProjectSpecVersionHistoryEntry } from '@/domain/project/project-spec-model';
import type { Result } from '@/shared/contracts/result';

import type { ProjectStoragePort } from '@/application/project/project.ports';

export interface ReadProjectSpecVersionHistoryUseCase {
  execute(input: {
    rootPath: string;
    specId: string;
  }): Promise<Result<ProjectSpecVersionHistoryEntry[]>>;
}

export function createReadProjectSpecVersionHistoryUseCase(dependencies: {
  projectStorage: ProjectStoragePort;
}): ReadProjectSpecVersionHistoryUseCase {
  return {
    async execute(input) {
      return dependencies.projectStorage.readProjectSpecVersionHistory(input);
    },
  };
}
