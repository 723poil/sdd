import type { RecentProject } from '@/domain/project/project-model';
import type { Result } from '@/shared/contracts/result';

import type { RecentProjectsStorePort } from '@/application/project/project.ports';

export interface ListRecentProjectsUseCase {
  execute(): Promise<Result<RecentProject[]>>;
}

export function createListRecentProjectsUseCase(dependencies: {
  recentProjectsStore: RecentProjectsStorePort;
}): ListRecentProjectsUseCase {
  return {
    async execute() {
      return dependencies.recentProjectsStore.listRecentProjects();
    },
  };
}
