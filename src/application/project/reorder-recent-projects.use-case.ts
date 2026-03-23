import type { RecentProject } from '@/domain/project/project-model';
import type { Result } from '@/shared/contracts/result';

import type { RecentProjectsStorePort } from '@/application/project/project.ports';

export interface ReorderRecentProjectsUseCase {
  execute(input: { rootPaths: string[] }): Promise<Result<RecentProject[]>>;
}

export function createReorderRecentProjectsUseCase(dependencies: {
  recentProjectsStore: RecentProjectsStorePort;
}): ReorderRecentProjectsUseCase {
  return {
    async execute(input) {
      return dependencies.recentProjectsStore.reorderRecentProjects(input);
    },
  };
}
