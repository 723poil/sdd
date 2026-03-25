import {
  createProjectAnalysisDocument,
  isProjectAnalysisFileIndexDocument,
  normalizeProjectAnalysisContext,
  orderProjectAnalysisDocuments,
  PROJECT_ANALYSIS_DOCUMENT_IDS,
  type ProjectAnalysis,
  type ProjectAnalysisDocument,
  type ProjectAnalysisFileIndexDocument,
} from '@/domain/project/project-analysis-model';
import {
  createEmptyProjectReferenceTagDocument,
  normalizeProjectReferenceTagDocument,
  type ProjectReferenceTagDocument,
} from '@/domain/project/project-reference-tag-model';
import type { ProjectSpecIndex } from '@/domain/project/project-spec-model';
import { createProjectError } from '@/domain/project/project-errors';
import {
  ANALYSIS_CONTEXT_SCHEMA_VERSION,
  ANALYSIS_FILE_INDEX_SCHEMA_VERSION,
  SPEC_INDEX_SCHEMA_VERSION,
  isProjectMeta,
  type ProjectMeta,
} from '@/domain/project/project-model';
import {
  PROJECT_SESSION_INDEX_SCHEMA_VERSION,
  type ProjectSessionIndex,
} from '@/domain/project/project-session-model';
import { err, ok, type Result } from '@/shared/contracts/result';

import {
  getProjectAnalysisDocumentPath,
  getProjectStoragePaths,
} from '@/infrastructure/sdd/fs-project-storage-paths';
import { pathExists, readJsonFile, readTextFile } from '@/infrastructure/sdd/fs-project-storage-io';

export interface InitialProjectStorageDocuments {
  analysisContext: ProjectAnalysis['context'];
  analysisFileIndex: ProjectAnalysisFileIndexDocument;
  analysisManualReferenceTags: ProjectReferenceTagDocument;
  analysisSummaryMarkdown: string;
  sessionsIndex: ProjectSessionIndex;
  specsIndex: ProjectSpecIndex;
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
  const {
    analysisContextPath,
    analysisDirectoryPath,
    analysisFileIndexPath,
    analysisManualReferenceTagsPath,
    analysisSummaryPath,
    sddDirectoryPath,
  } = getProjectStoragePaths(input.rootPath);

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

  const normalizedContext = normalizeProjectAnalysisContext(contextResult.value);
  if (!normalizedContext) {
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

  const fileIndexResult = await readProjectAnalysisFileIndexDocument({
    analysisFileIndexPath,
    fallbackPaths: normalizedContext.files,
  });
  if (!fileIndexResult.ok) {
    return err(fileIndexResult.error);
  }

  const referenceTagsResult = await readProjectReferenceTagDocument({
    analysisManualReferenceTagsPath,
    fallbackPaths: fileIndexResult.value.entries.map((entry) => entry.path),
  });
  if (!referenceTagsResult.ok) {
    return err(referenceTagsResult.error);
  }

  const documentsResult = await readProjectAnalysisDocuments({
    analysisDirectoryPath,
    context: normalizedContext,
    summaryMarkdown: summaryResult.value,
  });
  if (!documentsResult.ok) {
    return err(documentsResult.error);
  }

  return ok({
    context: normalizedContext,
    documents: documentsResult.value,
    fileIndex: fileIndexResult.value.entries,
    referenceTags: referenceTagsResult.value,
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
      projectPurpose: '',
      architectureSummary: '',
      documentSummaries: [],
      documentLayouts: {},
      layers: [],
      directorySummaries: [],
      connections: [],
      documentLinks: [],
      fileReferences: [],
    },
    analysisFileIndex: {
      schemaVersion: ANALYSIS_FILE_INDEX_SCHEMA_VERSION,
      generatedAt: input.now,
      entries: [],
    },
    analysisManualReferenceTags: createEmptyProjectReferenceTagDocument({
      now: input.now,
      revision: 1,
    }),
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
    } satisfies ProjectSpecIndex,
  };
}

async function readProjectAnalysisFileIndexDocument(input: {
  analysisFileIndexPath: string;
  fallbackPaths: string[];
}): Promise<Result<ProjectAnalysisFileIndexDocument>> {
  if (!(await pathExists(input.analysisFileIndexPath))) {
    return ok({
      schemaVersion: ANALYSIS_FILE_INDEX_SCHEMA_VERSION,
      generatedAt: new Date(0).toISOString(),
      entries: input.fallbackPaths.map((path) => ({
        path,
        role: '확인 필요',
        layer: null,
        category: 'legacy',
        summary: '이전 분석 포맷에서 가져온 경로입니다.',
        references: [],
      })),
    });
  }

  const fileIndexResult = await readJsonFile(
    input.analysisFileIndexPath,
    'analysis/file-index.json 을 읽거나 파싱할 수 없습니다.',
  );
  if (!fileIndexResult.ok) {
    return err(fileIndexResult.error);
  }

  if (!isProjectAnalysisFileIndexDocument(fileIndexResult.value)) {
    return err(
      createProjectError(
        'INVALID_PROJECT_STORAGE',
        'analysis/file-index.json 이 현재 schemaVersion 계약을 만족하지 않습니다.',
        input.analysisFileIndexPath,
      ),
    );
  }

  return ok({
    ...fileIndexResult.value,
    entries: fileIndexResult.value.entries.map((entry) => ({
      ...entry,
      references: entry.references ?? [],
    })),
  });
}

export async function readProjectReferenceTagDocument(input: {
  analysisManualReferenceTagsPath: string;
  fallbackPaths: string[];
}): Promise<Result<ProjectReferenceTagDocument>> {
  if (!(await pathExists(input.analysisManualReferenceTagsPath))) {
    return ok(
      createEmptyProjectReferenceTagDocument({
        revision: 0,
      }),
    );
  }

  const referenceTagsResult = await readJsonFile(
    input.analysisManualReferenceTagsPath,
    'analysis/manual-reference-tags.json 을 읽거나 파싱할 수 없습니다.',
  );
  if (!referenceTagsResult.ok) {
    return err(referenceTagsResult.error);
  }

  const normalizedReferenceTags = normalizeProjectReferenceTagDocument(referenceTagsResult.value);
  if (!normalizedReferenceTags) {
    return err(
      createProjectError(
        'INVALID_PROJECT_STORAGE',
        'analysis/manual-reference-tags.json 이 현재 schemaVersion 계약을 만족하지 않습니다.',
        input.analysisManualReferenceTagsPath,
      ),
    );
  }

  const visiblePaths = new Set(input.fallbackPaths);
  return ok({
    ...normalizedReferenceTags,
    assignments: normalizedReferenceTags.assignments.filter((assignment) =>
      visiblePaths.has(assignment.path),
    ),
  });
}

async function readProjectAnalysisDocuments(input: {
  analysisDirectoryPath: string;
  context: ProjectAnalysis['context'];
  summaryMarkdown: string;
}): Promise<Result<ProjectAnalysisDocument[]>> {
  const documentSummaryMap = new Map(
    input.context.documentSummaries.map((documentSummary) => [documentSummary.id, documentSummary]),
  );

  const documents: ProjectAnalysisDocument[] = [
    createProjectAnalysisDocument({
      id: 'overview',
      summary: resolveOverviewSummary({
        projectPurpose: input.context.projectPurpose,
        storedSummary: documentSummaryMap.get('overview')?.summary ?? null,
      }),
      markdown: input.summaryMarkdown,
    }),
  ];

  for (const documentId of PROJECT_ANALYSIS_DOCUMENT_IDS) {
    if (documentId === 'overview') {
      continue;
    }

    const documentPath = getProjectAnalysisDocumentPath({
      analysisDirectoryPath: input.analysisDirectoryPath,
      documentId,
    });
    if (!(await pathExists(documentPath))) {
      continue;
    }

    const documentResult = await readTextFile(
      documentPath,
      `analysis/${documentId}.md 를 읽을 수 없습니다.`,
    );
    if (!documentResult.ok) {
      return err(documentResult.error);
    }

    documents.push(
      createProjectAnalysisDocument({
        id: documentId,
        summary:
          documentSummaryMap.get(documentId)?.summary ?? '프로젝트 분석 문서를 불러왔습니다.',
        markdown: stripLegacyKeyFileReferenceSection(documentResult.value),
      }),
    );
  }

  return ok(orderProjectAnalysisDocuments(documents));
}

function resolveOverviewSummary(input: {
  projectPurpose: string;
  storedSummary: string | null;
}): string {
  if (input.storedSummary && input.storedSummary.trim().length > 0) {
    return input.storedSummary;
  }

  if (input.projectPurpose.trim().length > 0) {
    return input.projectPurpose;
  }

  return '프로젝트 전체 개요를 확인합니다.';
}

function stripLegacyKeyFileReferenceSection(markdown: string): string {
  const sanitized = markdown.replace(
    /(?:^|\n)## 핵심 파일 참조\s*\n[\s\S]*?(?=(?:\n## |\n# )|$)/u,
    '\n',
  );

  return sanitized.replace(/\n{3,}/gu, '\n\n').trimEnd();
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
    '- 전체 분석 또는 참조 분석 실행',
    '- 구조와 계층 정리',
    '- 명세 초안 생성',
    '',
  ].join('\n');
}
