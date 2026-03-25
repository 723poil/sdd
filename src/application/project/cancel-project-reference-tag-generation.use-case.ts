import type { Result } from '@/shared/contracts/result';

import type { ProjectReferenceTagGeneratorPort } from '@/application/project/project.ports';

export interface CancelProjectReferenceTagGenerationUseCase {
  execute(input: { rootPath: string }): Result<void>;
}

export function createCancelProjectReferenceTagGenerationUseCase(dependencies: {
  projectReferenceTagGenerator: ProjectReferenceTagGeneratorPort;
}): CancelProjectReferenceTagGenerationUseCase {
  return {
    execute(input) {
      return dependencies.projectReferenceTagGenerator.cancelReferenceTagGeneration(input);
    },
  };
}
