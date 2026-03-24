import type { ProjectAnalysisRunStatus } from '@/domain/project/project-analysis-model';
import type { Result } from '@/shared/contracts/result';

import type { ProjectAnalysisRunStatusPort } from '@/application/project/project.ports';

export interface CancelProjectAnalysisUseCase {
  execute(input: { rootPath: string }): Result<ProjectAnalysisRunStatus>;
}

export function createCancelProjectAnalysisUseCase(dependencies: {
  analysisRunStatusStore: ProjectAnalysisRunStatusPort;
}): CancelProjectAnalysisUseCase {
  return {
    execute(input) {
      return dependencies.analysisRunStatusStore.cancelAnalysisRun(input);
    },
  };
}
