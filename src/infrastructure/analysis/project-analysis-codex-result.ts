import { ANALYSIS_CONTEXT_SCHEMA_VERSION } from '@/domain/project/project-model';
import {
  createProjectAnalysisDocument,
  orderProjectAnalysisDocuments,
  PROJECT_ANALYSIS_DOCUMENT_IDS,
  type ProjectAnalysisDraft,
  type ProjectAnalysisDocumentId,
  type ProjectAnalysisFileIndexEntry,
  type ProjectAnalysisFileReference,
} from '@/domain/project/project-analysis-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

interface ParsedCodexProjectAnalysisPayload {
  detectedStack: string[];
  context: {
    files: string[];
    directories: string[];
    detectedFrameworks: string[];
    entrypoints: string[];
    keyConfigs: string[];
    modules: string[];
    unknowns: string[];
    confidence: number;
    projectPurpose: string;
    architectureSummary: string;
    layers: Array<{
      name: string;
      responsibility: string;
      directories: string[];
      dependsOn: string[];
    }>;
    directorySummaries: Array<{
      path: string;
      role: string;
      layer: string | null;
    }>;
    connections: Array<{
      from: string;
      to: string;
      relationship: string;
      reason: string;
    }>;
    documentLinks: Array<{
      from: ProjectAnalysisDocumentId;
      to: ProjectAnalysisDocumentId;
      label: string;
      reason: string;
    }>;
  };
  documents: Array<{
    id: ProjectAnalysisDocumentId;
    summary: string;
    markdown: string;
  }>;
  fileIndex: Array<
    Omit<ProjectAnalysisFileIndexEntry, 'references'> & {
      references: Array<{
        path: string;
        relationship: string;
        reason: string;
      }>;
    }
  >;
}

export function parseProjectAnalysisCodexResult(raw: string): Result<ProjectAnalysisDraft> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return err(
      createProjectError(
        'PROJECT_ANALYSIS_FAILED',
        '에이전트 분석 결과를 JSON으로 파싱하지 못했습니다.',
      ),
    );
  }

  const payload = normalizeParsedPayload(parsed);
  if (!payload) {
    return err(
      createProjectError(
        'PROJECT_ANALYSIS_FAILED',
        '에이전트 분석 결과가 현재 분석 계약을 만족하지 않습니다.',
      ),
    );
  }

  const orderedDocuments = orderProjectAnalysisDocuments(payload.documents);
  const documentSummaryMap = new Map(
    orderedDocuments.map((document) => [document.id, document.summary]),
  );
  const overviewDocument = orderedDocuments.find((document) => document.id === 'overview');
  if (!overviewDocument) {
    return err(
      createProjectError(
        'PROJECT_ANALYSIS_FAILED',
        '에이전트 분석 결과에 overview 문서가 없습니다.',
      ),
    );
  }

  return ok({
    detectedStack: payload.detectedStack,
    context: {
      schemaVersion: ANALYSIS_CONTEXT_SCHEMA_VERSION,
      files: payload.context.files,
      directories: payload.context.directories,
      detectedFrameworks: payload.context.detectedFrameworks,
      entrypoints: payload.context.entrypoints,
      keyConfigs: payload.context.keyConfigs,
      modules: payload.context.modules,
      unknowns: payload.context.unknowns,
      confidence: payload.context.confidence,
      projectPurpose: payload.context.projectPurpose,
      architectureSummary: payload.context.architectureSummary,
      documentSummaries: PROJECT_ANALYSIS_DOCUMENT_IDS.filter((id) =>
        documentSummaryMap.has(id),
      ).map((id) => ({
        id,
        summary: documentSummaryMap.get(id) ?? '',
      })),
      documentLayouts: {},
      layers: payload.context.layers,
      directorySummaries: payload.context.directorySummaries,
      connections: payload.context.connections,
      documentLinks: payload.context.documentLinks,
      fileReferences: collectFileReferences(payload.fileIndex),
    },
    documents: orderedDocuments.map((document) =>
      createProjectAnalysisDocument({
        id: document.id,
        summary: document.summary,
        markdown: document.markdown,
      }),
    ),
    fileIndex: payload.fileIndex,
    summaryMarkdown: overviewDocument.markdown,
  });
}

function normalizeParsedPayload(value: unknown): ParsedCodexProjectAnalysisPayload | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    !isStringArray(candidate.detectedStack) ||
    !isParsedContext(candidate.context) ||
    !isParsedDocumentArray(candidate.documents) ||
    !isParsedFileIndexArray(candidate.fileIndex)
  ) {
    return null;
  }

  const documentIds = new Set(candidate.documents.map((document) => document.id));
  if (documentIds.size !== PROJECT_ANALYSIS_DOCUMENT_IDS.length) {
    return null;
  }

  for (const documentId of PROJECT_ANALYSIS_DOCUMENT_IDS) {
    if (!documentIds.has(documentId)) {
      return null;
    }
  }

  return {
    detectedStack: [...candidate.detectedStack],
    context: {
      ...candidate.context,
      files: [...candidate.context.files],
      directories: [...candidate.context.directories],
      detectedFrameworks: [...candidate.context.detectedFrameworks],
      entrypoints: [...candidate.context.entrypoints],
      keyConfigs: [...candidate.context.keyConfigs],
      modules: [...candidate.context.modules],
      unknowns: [...candidate.context.unknowns],
      layers: candidate.context.layers.map((layer) => ({
        ...layer,
        directories: [...layer.directories],
        dependsOn: [...layer.dependsOn],
      })),
      directorySummaries: candidate.context.directorySummaries.map((directory) => ({
        ...directory,
      })),
      connections: candidate.context.connections.map((connection) => ({ ...connection })),
      documentLinks: candidate.context.documentLinks.map((documentLink) => ({ ...documentLink })),
    },
    documents: candidate.documents.map((document) => ({ ...document })),
    fileIndex: candidate.fileIndex.map((entry) => ({
      ...entry,
      references: entry.references.map((reference) => ({ ...reference })),
    })),
  };
}

function isParsedContext(value: unknown): value is ParsedCodexProjectAnalysisPayload['context'] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    isStringArray(candidate.files) &&
    isStringArray(candidate.directories) &&
    isStringArray(candidate.detectedFrameworks) &&
    isStringArray(candidate.entrypoints) &&
    isStringArray(candidate.keyConfigs) &&
    isStringArray(candidate.modules) &&
    isStringArray(candidate.unknowns) &&
    typeof candidate.confidence === 'number' &&
    typeof candidate.projectPurpose === 'string' &&
    typeof candidate.architectureSummary === 'string' &&
    Array.isArray(candidate.layers) &&
    candidate.layers.every((layer) => isParsedLayer(layer)) &&
    Array.isArray(candidate.directorySummaries) &&
    candidate.directorySummaries.every((directory) => isParsedDirectorySummary(directory)) &&
    Array.isArray(candidate.connections) &&
    candidate.connections.every((connection) => isParsedConnection(connection)) &&
    Array.isArray(candidate.documentLinks) &&
    candidate.documentLinks.every((documentLink) => isParsedDocumentLink(documentLink))
  );
}

function isParsedLayer(
  value: unknown,
): value is ParsedCodexProjectAnalysisPayload['context']['layers'][number] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.name === 'string' &&
    typeof candidate.responsibility === 'string' &&
    isStringArray(candidate.directories) &&
    isStringArray(candidate.dependsOn)
  );
}

function isParsedDirectorySummary(
  value: unknown,
): value is ParsedCodexProjectAnalysisPayload['context']['directorySummaries'][number] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.path === 'string' &&
    typeof candidate.role === 'string' &&
    (typeof candidate.layer === 'string' || candidate.layer === null)
  );
}

function isParsedConnection(
  value: unknown,
): value is ParsedCodexProjectAnalysisPayload['context']['connections'][number] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.from === 'string' &&
    typeof candidate.to === 'string' &&
    typeof candidate.relationship === 'string' &&
    typeof candidate.reason === 'string'
  );
}

function isParsedDocumentLink(
  value: unknown,
): value is ParsedCodexProjectAnalysisPayload['context']['documentLinks'][number] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.from === 'string' &&
    PROJECT_ANALYSIS_DOCUMENT_IDS.includes(candidate.from as ProjectAnalysisDocumentId) &&
    typeof candidate.to === 'string' &&
    PROJECT_ANALYSIS_DOCUMENT_IDS.includes(candidate.to as ProjectAnalysisDocumentId) &&
    typeof candidate.label === 'string' &&
    typeof candidate.reason === 'string'
  );
}

function isParsedDocumentArray(
  value: unknown,
): value is ParsedCodexProjectAnalysisPayload['documents'] {
  return Array.isArray(value) && value.every((document) => isParsedDocument(document));
}

function isParsedDocument(
  value: unknown,
): value is ParsedCodexProjectAnalysisPayload['documents'][number] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    PROJECT_ANALYSIS_DOCUMENT_IDS.includes(candidate.id as ProjectAnalysisDocumentId) &&
    typeof candidate.summary === 'string' &&
    typeof candidate.markdown === 'string'
  );
}

function isParsedFileIndexArray(
  value: unknown,
): value is ParsedCodexProjectAnalysisPayload['fileIndex'] {
  return Array.isArray(value) && value.every((entry) => isParsedFileIndexEntry(entry));
}

function isParsedFileIndexEntry(
  value: unknown,
): value is ParsedCodexProjectAnalysisPayload['fileIndex'][number] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.path === 'string' &&
    typeof candidate.role === 'string' &&
    (typeof candidate.layer === 'string' || candidate.layer === null) &&
    typeof candidate.category === 'string' &&
    typeof candidate.summary === 'string' &&
    Array.isArray(candidate.references) &&
    candidate.references.every((reference) => isParsedFileReferenceTarget(reference))
  );
}

function isParsedFileReferenceTarget(
  value: unknown,
): value is NonNullable<ParsedCodexProjectAnalysisPayload['fileIndex'][number]['references']>[number] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.path === 'string' &&
    typeof candidate.relationship === 'string' &&
    typeof candidate.reason === 'string'
  );
}

function collectFileReferences(fileIndex: ProjectAnalysisFileIndexEntry[]): ProjectAnalysisFileReference[] {
  const references: ProjectAnalysisFileReference[] = [];

  for (const entry of fileIndex) {
    for (const reference of entry.references ?? []) {
      references.push({
        from: entry.path,
        to: reference.path,
        relationship: reference.relationship,
        reason: reference.reason,
      });
    }
  }

  return references;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
