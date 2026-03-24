import type { ProjectAnalysis } from '@/domain/project/project-analysis-model';
import { createProjectError } from '@/domain/project/project-errors';
import { isProjectAnalysisContext } from '@/domain/project/project-analysis-model';
import {
  PROJECT_SESSION_INDEX_SCHEMA_VERSION,
  type ProjectSessionIndex,
} from '@/domain/project/project-session-model';
import {
  ANALYSIS_CONTEXT_SCHEMA_VERSION,
  SPEC_INDEX_SCHEMA_VERSION,
  isProjectMeta,
  type ProjectMeta,
} from '@/domain/project/project-model';
import { err, ok, type Result } from '@/shared/contracts/result';

import { getProjectStoragePaths } from '@/infrastructure/sdd/fs-project-storage-paths';
import { pathExists, readJsonFile, readTextFile } from '@/infrastructure/sdd/fs-project-storage-io';

export interface InitialProjectStorageDocuments {
  analysisContext: ProjectAnalysis['context'];
  analysisSummaryMarkdown: string;
  sessionsIndex: ProjectSessionIndex;
  specsIndex: {
    schemaVersion: typeof SPEC_INDEX_SCHEMA_VERSION;
    generatedAt: string;
    specs: string[];
  };
}

export async function readProjectMetaDocument(input: {
  rootPath: string;
}): Promise<Result<ProjectMeta | null>> {
  const { projectJsonPath, sddDirectoryPath } = getProjectStoragePaths(input.rootPath);

  if (!(await pathExists(sddDirectoryPath))) {
    return ok(null);
  }

  if (!(await pathExists(projectJsonPath))) {
    return ok(null);
  }

  const parsedResult = await readJsonFile(
    projectJsonPath,
    'project.json 을 읽거나 파싱할 수 없습니다.',
  );
  if (!parsedResult.ok) {
    return err(parsedResult.error);
  }

  if (!isProjectMeta(parsedResult.value)) {
    return err(
      createProjectError(
        'INVALID_PROJECT_STORAGE',
        'project.json 이 현재 schemaVersion 계약을 만족하지 않습니다.',
        projectJsonPath,
      ),
    );
  }

  return ok(parsedResult.value);
}

export async function readProjectAnalysisDocument(input: {
  rootPath: string;
}): Promise<Result<ProjectAnalysis | null>> {
  const { analysisContextPath, analysisSummaryPath, sddDirectoryPath } =
    getProjectStoragePaths(input.rootPath);

  if (!(await pathExists(sddDirectoryPath))) {
    return ok(null);
  }

  if (!(await pathExists(analysisContextPath)) || !(await pathExists(analysisSummaryPath))) {
    return ok(null);
  }

  const contextResult = await readJsonFile(
    analysisContextPath,
    'analysis/context.json 을 읽거나 파싱할 수 없습니다.',
  );
  if (!contextResult.ok) {
    return err(contextResult.error);
  }

  if (!isProjectAnalysisContext(contextResult.value)) {
    return err(
      createProjectError(
        'INVALID_PROJECT_STORAGE',
        'analysis/context.json 이 현재 schemaVersion 계약을 만족하지 않습니다.',
        analysisContextPath,
      ),
    );
  }

  const summaryResult = await readTextFile(
    analysisSummaryPath,
    'analysis/summary.md 를 읽을 수 없습니다.',
  );
  if (!summaryResult.ok) {
    return err(summaryResult.error);
  }

  return ok({
    context: contextResult.value,
    summaryMarkdown: summaryResult.value,
  });
}

export function createInitialProjectStorageDocuments(input: {
  projectName: string;
  now: string;
}): InitialProjectStorageDocuments {
  return {
    analysisContext: {
      schemaVersion: ANALYSIS_CONTEXT_SCHEMA_VERSION,
      files: [],
      directories: [],
      detectedFrameworks: [],
      entrypoints: [],
      keyConfigs: [],
      modules: [],
      unknowns: [],
      confidence: 0,
    },
    analysisSummaryMarkdown: createInitialAnalysisSummaryMarkdown(input.projectName),
    sessionsIndex: {
      schemaVersion: PROJECT_SESSION_INDEX_SCHEMA_VERSION,
      generatedAt: input.now,
      sessions: [],
    } satisfies ProjectSessionIndex,
    specsIndex: {
      schemaVersion: SPEC_INDEX_SCHEMA_VERSION,
      generatedAt: input.now,
      specs: [],
    },
  };
}

function createInitialAnalysisSummaryMarkdown(projectName: string): string {
  return [
    `# ${projectName}`,
    '',
    '## 프로젝트 개요',
    '',
    '- 아직 분석 기록이 없습니다.',
    '',
    '## 다음 단계',
    '',
    '- 기본 분석 실행',
    '- 스택 감지',
    '- 명세 초안 생성',
    '',
  ].join('\n');
}
