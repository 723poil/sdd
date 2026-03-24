import { resolve } from 'node:path';

import type { ProjectAnalyzerPort } from '@/application/project/project.ports';
import { createProjectError } from '@/domain/project/project-errors';
import type { ProjectAnalysisDraft } from '@/domain/project/project-analysis-model';
import { err, ok } from '@/shared/contracts/result';
import { createProjectAnalysisDetection } from '@/infrastructure/analysis/project-analysis-detection';
import { createProjectAnalysisSummaryMarkdown } from '@/infrastructure/analysis/project-analysis-summary';
import {
  createEmptyProjectAnalysisScanState,
  scanProjectAnalysis,
} from '@/infrastructure/analysis/project-analysis-scanner';

export function createNodeProjectAnalyzerAdapter(): ProjectAnalyzerPort {
  return {
    async analyzeProject(input) {
      const rootPath = resolve(input.rootPath);

      try {
        const scanState = createEmptyProjectAnalysisScanState();

        await scanProjectAnalysis({
          currentPath: rootPath,
          depth: 0,
          rootPath,
          scanState,
        });

        const detection = createProjectAnalysisDetection(scanState);

        return ok({
          context: detection.context,
          detectedStack: detection.detectedStack,
          summaryMarkdown: createProjectAnalysisSummaryMarkdown({
            context: detection.context,
            packageManager: scanState.packageManager,
            projectName: input.projectName,
          }),
        } satisfies ProjectAnalysisDraft);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '프로젝트 분석 중 알 수 없는 오류가 발생했습니다.';

        return err(createProjectError('INVALID_PROJECT_STORAGE', '프로젝트 분석에 실패했습니다.', message));
      }
    },
  };
}
