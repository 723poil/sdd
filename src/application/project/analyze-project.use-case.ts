import type { Result } from '@/shared/contracts/result';

import {
  executeAnalyzeProjectWorkflow,
  type AnalyzeProjectOutput,
  type AnalyzeProjectWorkflowDependencies,
  type AnalyzeProjectWorkflowInput,
} from '@/application/project/analyze-project-workflow';

export interface AnalyzeProjectUseCase {
  execute(input: AnalyzeProjectWorkflowInput): Promise<Result<AnalyzeProjectOutput>>;
}

export function createAnalyzeProjectUseCase(
  dependencies: AnalyzeProjectWorkflowDependencies,
): AnalyzeProjectUseCase {
  return {
    async execute(input) {
      return executeAnalyzeProjectWorkflow(dependencies, input);
    },
  };
}
