import type { ProjectSessionMessageRunStatus } from '@/domain/project/project-session-model';
import type { Result } from '@/shared/contracts/result';

import type { ProjectSessionMessageRunStatusPort } from '@/application/project/project.ports';

export interface CancelProjectSessionMessageUseCase {
  execute(input: {
    rootPath: string;
    sessionId: string;
  }): Promise<Result<ProjectSessionMessageRunStatus>> | Result<ProjectSessionMessageRunStatus>;
}

export function createCancelProjectSessionMessageUseCase(dependencies: {
  sessionMessageRunStatusStore: ProjectSessionMessageRunStatusPort;
}): CancelProjectSessionMessageUseCase {
  return {
    execute(input) {
      return dependencies.sessionMessageRunStatusStore.cancelSessionMessageRun(input);
    },
  };
}
