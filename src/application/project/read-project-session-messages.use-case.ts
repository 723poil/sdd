import type { ProjectSessionMessage } from '@/domain/project/project-session-model';
import type { Result } from '@/shared/contracts/result';

import type { ProjectSessionPort } from '@/application/project/project.ports';

export interface ReadProjectSessionMessagesUseCase {
  execute(input: { rootPath: string; sessionId: string }): Promise<Result<ProjectSessionMessage[]>>;
}

export function createReadProjectSessionMessagesUseCase(dependencies: {
  projectSessionStore: ProjectSessionPort;
}): ReadProjectSessionMessagesUseCase {
  return {
    async execute(input) {
      return dependencies.projectSessionStore.readSessionMessages(input);
    },
  };
}
