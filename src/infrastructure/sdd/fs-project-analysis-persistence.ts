import {
  PROJECT_ANALYSIS_DOCUMENT_IDS,
  normalizeProjectAnalysisContext,
  type ProjectAnalysisDocumentLayoutMap,
  type ProjectAnalysisDraft,
} from '@/domain/project/project-analysis-model';
import {
  PROJECT_REFERENCE_TAGS_SCHEMA_VERSION,
  sanitizeProjectReferenceTagDocument,
  type ProjectReferenceTagDocument,
} from '@/domain/project/project-reference-tag-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

import { writeJsonAtomically, writeTextAtomically } from '@/infrastructure/fs/write-json-atomically';
import { readProjectReferenceTagDocument } from '@/infrastructure/sdd/fs-project-storage-documents';
import { getProjectAnalysisDocumentPath } from '@/infrastructure/sdd/fs-project-storage-paths';
import { pathExists, readJsonFile } from '@/infrastructure/sdd/fs-project-storage-io';

export async function readProjectAnalysisDocumentLayouts(input: {
  analysisContextPath: string;
}): Promise<ProjectAnalysisDocumentLayoutMap> {
  if (!(await pathExists(input.analysisContextPath))) {
    return {};
  }

  const contextResult = await readJsonFile(
    input.analysisContextPath,
    'analysis/context.json 을 읽거나 파싱할 수 없습니다.',
  );
  if (!contextResult.ok) {
    return {};
  }

  const normalizedContext = normalizeProjectAnalysisContext(contextResult.value);
  if (!normalizedContext) {
    return {};
  }

  return cloneProjectAnalysisDocumentLayouts(normalizedContext.documentLayouts);
}

export async function readProjectReferenceTags(input: {
  analysisManualReferenceTagsPath: string;
  fallbackPaths: string[];
}): Promise<ProjectReferenceTagDocument> {
  const referenceTagsResult = await readProjectReferenceTagDocument(input);
  if (!referenceTagsResult.ok) {
    return sanitizeProjectReferenceTagDocument({
      document: {
        schemaVersion: PROJECT_REFERENCE_TAGS_SCHEMA_VERSION,
        updatedAt: new Date(0).toISOString(),
        revision: 0,
        tags: [],
        assignments: [],
      },
      validFilePaths: input.fallbackPaths,
    });
  }

  return sanitizeProjectReferenceTagDocument({
    document: referenceTagsResult.value,
    validFilePaths: input.fallbackPaths,
  });
}

export async function writeProjectAnalysisDocuments(input: {
  analysis: ProjectAnalysisDraft;
  analysisDirectoryPath: string;
}): Promise<void> {
  const documentMap = new Map(input.analysis.documents.map((document) => [document.id, document]));

  for (const documentId of PROJECT_ANALYSIS_DOCUMENT_IDS) {
    if (documentId === 'overview') {
      continue;
    }

    const document = documentMap.get(documentId);
    if (!document) {
      continue;
    }

    await writeTextAtomically(
      getProjectAnalysisDocumentPath({
        analysisDirectoryPath: input.analysisDirectoryPath,
        documentId,
      }),
      document.markdown,
    );
  }
}

export async function writeProjectAnalysisDocumentLayouts(input: {
  analysisContextPath: string;
  documentLayouts: ProjectAnalysisDocumentLayoutMap;
}): Promise<Result<ProjectAnalysisDocumentLayoutMap>> {
  const contextResult = await readJsonFile(
    input.analysisContextPath,
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
        input.analysisContextPath,
      ),
    );
  }

  const nextDocumentLayouts = cloneProjectAnalysisDocumentLayouts(input.documentLayouts);

  await writeJsonAtomically(input.analysisContextPath, {
    ...normalizedContext,
    documentLayouts: nextDocumentLayouts,
  });

  return ok(nextDocumentLayouts);
}

function cloneProjectAnalysisDocumentLayouts(
  value: ProjectAnalysisDocumentLayoutMap,
): ProjectAnalysisDocumentLayoutMap {
  const next: ProjectAnalysisDocumentLayoutMap = {};

  for (const documentId of PROJECT_ANALYSIS_DOCUMENT_IDS) {
    const layout = value[documentId];
    if (!layout) {
      continue;
    }

    next[documentId] = {
      x: layout.x,
      y: layout.y,
    };
  }

  return next;
}
