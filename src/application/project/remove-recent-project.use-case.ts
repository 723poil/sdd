import type { RecentProject } from '@/domain/project/project-model';
import type { Result } from '@/shared/contracts/result';

import type { RecentProjectsStorePort } from '@/application/project/project.ports';

export interface RemoveRecentProjectUseCase {
  execute(input: { rootPath: string }): Promise<Result<RecentProject[]>>;
}

export function createRemoveRecentProjectUseCase(dependencies: {
  recentProjectsStore: RecentProjectsStorePort;
}): RemoveRecentProjectUseCase {
  return {
    async execute(input) {
      return dependencies.recentProjectsStore.removeRecentProject(input);
    },
  };
}
