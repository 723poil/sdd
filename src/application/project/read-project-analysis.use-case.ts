import type { ProjectStoragePort } from '@/application/project/project.ports';
import type { ProjectAnalysis } from '@/domain/project/project-analysis-model';
import { type Result } from '@/shared/contracts/result';

export interface ReadProjectAnalysisUseCase {
  execute(input: { rootPath: string }): Promise<Result<ProjectAnalysis | null>>;
}

export function createReadProjectAnalysisUseCase(dependencies: {
  projectStorage: ProjectStoragePort;
}): ReadProjectAnalysisUseCase {
  return {
    async execute(input) {
      return dependencies.projectStorage.readProjectAnalysis(input);
    },
  };
}
