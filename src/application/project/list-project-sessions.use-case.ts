import type { ProjectSessionSummary } from '@/domain/project/project-session-model';
import type { Result } from '@/shared/contracts/result';

import type { ProjectSessionPort } from '@/application/project/project.ports';

export interface ListProjectSessionsUseCase {
  execute(input: { rootPath: string }): Promise<Result<ProjectSessionSummary[]>>;
}

export function createListProjectSessionsUseCase(dependencies: {
  projectSessionStore: ProjectSessionPort;
}): ListProjectSessionsUseCase {
  return {
    async execute(input) {
      return dependencies.projectSessionStore.listSessions(input);
    },
  };
}
