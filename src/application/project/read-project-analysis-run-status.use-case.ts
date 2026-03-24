import type { ProjectAnalysisRunStatus } from '@/domain/project/project-analysis-model';
import type { Result } from '@/shared/contracts/result';

import type { ProjectAnalysisRunStatusPort } from '@/application/project/project.ports';

export interface ReadProjectAnalysisRunStatusUseCase {
  execute(input: { rootPath: string }): Result<ProjectAnalysisRunStatus>;
}

export function createReadProjectAnalysisRunStatusUseCase(dependencies: {
  analysisRunStatusStore: ProjectAnalysisRunStatusPort;
}): ReadProjectAnalysisRunStatusUseCase {
  return {
    execute(input) {
      return dependencies.analysisRunStatusStore.readAnalysisRunStatus(input);
    },
  };
}
