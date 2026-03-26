import type { ProjectSessionMessageRunStatus } from '@/domain/project/project-session-model';
import type { Result } from '@/shared/contracts/result';

import type { ProjectSessionMessageRunStatusPort } from '@/application/project/project.ports';

export interface ReadProjectSessionMessageRunStatusUseCase {
  execute(input: {
    rootPath: string;
    sessionId: string;
  }): Promise<Result<ProjectSessionMessageRunStatus>> | Result<ProjectSessionMessageRunStatus>;
}

export function createReadProjectSessionMessageRunStatusUseCase(dependencies: {
  sessionMessageRunStatusStore: ProjectSessionMessageRunStatusPort;
}): ReadProjectSessionMessageRunStatusUseCase {
  return {
    execute(input) {
      return dependencies.sessionMessageRunStatusStore.readSessionMessageRunStatus(input);
    },
  };
}
