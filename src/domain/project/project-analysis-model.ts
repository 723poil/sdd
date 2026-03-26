import {
  ANALYSIS_CONTEXT_SCHEMA_VERSION,
  ANALYSIS_FILE_INDEX_SCHEMA_VERSION,
  LEGACY_ANALYSIS_FILE_INDEX_SCHEMA_VERSION,
  LEGACY_ANALYSIS_CONTEXT_SCHEMA_VERSION,
  PREVIOUS_ANALYSIS_CONTEXT_SCHEMA_VERSION,
} from '@/domain/project/project-model';
import type { ProjectReferenceTagDocument } from '@/domain/project/project-reference-tag-model';

export const PROJECT_ANALYSIS_DOCUMENT_IDS = [
  'overview',
  'purpose',
  'structure',
  'layers',
  'connectivity',
] as const;

export type ProjectAnalysisDocumentId = (typeof PROJECT_ANALYSIS_DOCUMENT_IDS)[number];

export interface ProjectAnalysisDocumentSummary {
  id: ProjectAnalysisDocumentId;
  summary: string;
}

export interface ProjectAnalysisDocument extends ProjectAnalysisDocumentSummary {
  title: string;
  markdown: string;
}

export interface ProjectAnalysisDocumentLayout {
  x: number;
  y: number;
}

export type ProjectAnalysisDocumentLayoutMap = Partial<
  Record<ProjectAnalysisDocumentId, ProjectAnalysisDocumentLayout>
>;

export interface ProjectAnalysisLayerSummary {
  name: string;
  responsibility: string;
  directories: string[];
  dependsOn: string[];
}

export interface ProjectAnalysisDirectorySummary {
  path: string;
  role: string;
  layer: string | null;
}

export interface ProjectAnalysisConnection {
  from: string;
  to: string;
  relationship: string;
  reason: string;
}

export interface ProjectAnalysisDocumentLink {
  from: ProjectAnalysisDocumentId;
  to: ProjectAnalysisDocumentId;
  label: string;
  reason: string;
}

export interface ProjectAnalysisFileReference {
  from: string;
  to: string;
  relationship: string;
  reason: string;
}

export interface ProjectAnalysisFileReferenceTarget {
  path: string;
  relationship: string;
  reason: string;
}

export const PROJECT_ANALYSIS_CLASSIFICATION_STATUSES = [
  'confirmed',
  'inferred',
  'fallback',
] as const;

export type ProjectAnalysisClassificationStatus =
  (typeof PROJECT_ANALYSIS_CLASSIFICATION_STATUSES)[number];

export interface ProjectAnalysisFileClassificationMeta {
  confidence: number;
  reasons: string[];
  status: ProjectAnalysisClassificationStatus;
}

export interface ProjectAnalysisFileClassification {
  category: ProjectAnalysisFileClassificationMeta;
  layer: ProjectAnalysisFileClassificationMeta | null;
}

export interface ProjectAnalysisFileGrouping {
  area: string | null;
  cluster: string | null;
}

export interface ProjectAnalysisUnresolvedFileReferenceTarget {
  candidatePaths: string[];
  confidence: number;
  language: string;
  reason: string;
  relationship: string;
  resolutionKind: string;
  specifier: string;
}

export interface ProjectAnalysisUnresolvedFileReference extends ProjectAnalysisUnresolvedFileReferenceTarget {
  from: string;
}

export interface ProjectAnalysisReferenceScanLimit {
  kind: 'depth' | 'directory' | 'file';
  limit: number;
  message: string;
  reached: boolean;
}

export interface ProjectAnalysisStructureDiscoveryPackageRoot {
  confidence: number;
  packageName: string | null;
  path: string;
  reason: string;
  sourceRoots: string[];
}

export interface ProjectAnalysisStructureDiscoverySourceRoot {
  confidence: number;
  kind: string;
  packageRoot: string | null;
  path: string;
  reason: string;
}

export interface ProjectAnalysisStructureDiscoveryFeatureCluster {
  confidence: number;
  path: string;
  reason: string;
  sourceRoot: string;
}

export interface ProjectAnalysisStructureDiscovery {
  aliasConfigPaths: string[];
  featureClusters: ProjectAnalysisStructureDiscoveryFeatureCluster[];
  notes: string[];
  packageRoots: ProjectAnalysisStructureDiscoveryPackageRoot[];
  sourceRoots: ProjectAnalysisStructureDiscoverySourceRoot[];
}

export interface ProjectAnalysisReferenceAnalysis {
  scanLimits: ProjectAnalysisReferenceScanLimit[];
  structureDiscovery: ProjectAnalysisStructureDiscovery;
  unresolvedFileReferences: ProjectAnalysisUnresolvedFileReference[];
}

export interface ProjectAnalysisFileIndexEntry {
  path: string;
  role: string;
  layer: string | null;
  category: string;
  summary: string;
  grouping?: ProjectAnalysisFileGrouping;
  classification?: ProjectAnalysisFileClassification;
  references?: ProjectAnalysisFileReferenceTarget[];
  unresolvedReferences?: ProjectAnalysisUnresolvedFileReferenceTarget[];
}

export interface ProjectAnalysisFileIndexDocument {
  schemaVersion: typeof ANALYSIS_FILE_INDEX_SCHEMA_VERSION;
  generatedAt: string;
  entries: ProjectAnalysisFileIndexEntry[];
}

interface LegacyProjectAnalysisFileIndexDocument {
  schemaVersion: typeof LEGACY_ANALYSIS_FILE_INDEX_SCHEMA_VERSION;
  generatedAt: string;
  entries: ProjectAnalysisFileIndexEntry[];
}

export interface ProjectAnalysisContext {
  schemaVersion: typeof ANALYSIS_CONTEXT_SCHEMA_VERSION;
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
  documentSummaries: ProjectAnalysisDocumentSummary[];
  documentLayouts: ProjectAnalysisDocumentLayoutMap;
  layers: ProjectAnalysisLayerSummary[];
  directorySummaries: ProjectAnalysisDirectorySummary[];
  connections: ProjectAnalysisConnection[];
  documentLinks: ProjectAnalysisDocumentLink[];
  fileReferences: ProjectAnalysisFileReference[];
  referenceAnalysis: ProjectAnalysisReferenceAnalysis;
}

interface PreviousProjectAnalysisContext {
  schemaVersion: typeof PREVIOUS_ANALYSIS_CONTEXT_SCHEMA_VERSION;
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
  documentSummaries: ProjectAnalysisDocumentSummary[];
  documentLayouts: ProjectAnalysisDocumentLayoutMap;
  layers: ProjectAnalysisLayerSummary[];
  directorySummaries: ProjectAnalysisDirectorySummary[];
  connections: ProjectAnalysisConnection[];
  documentLinks: ProjectAnalysisDocumentLink[];
  fileReferences: ProjectAnalysisFileReference[];
}

interface LegacyProjectAnalysisContext {
  schemaVersion: typeof LEGACY_ANALYSIS_CONTEXT_SCHEMA_VERSION;
  files: string[];
  directories: string[];
  detectedFrameworks: string[];
  entrypoints: string[];
  keyConfigs: string[];
  modules: string[];
  unknowns: string[];
  confidence: number;
}

export interface ProjectAnalysis {
  context: ProjectAnalysisContext;
  documents: ProjectAnalysisDocument[];
  fileIndex: ProjectAnalysisFileIndexEntry[];
  summaryMarkdown: string;
  referenceTags?: ProjectReferenceTagDocument;
}

export interface ProjectAnalysisDraft extends ProjectAnalysis {
  detectedStack: string[];
}

export const PROJECT_ANALYSIS_MODES = ['full', 'references'] as const;
export type ProjectAnalysisMode = (typeof PROJECT_ANALYSIS_MODES)[number];

export const PROJECT_ANALYSIS_RUN_STATES = [
  'idle',
  'running',
  'cancelling',
  'cancelled',
  'succeeded',
  'failed',
] as const;
export type ProjectAnalysisRunState = (typeof PROJECT_ANALYSIS_RUN_STATES)[number];

export interface ProjectAnalysisRunStatus {
  rootPath: string;
  status: ProjectAnalysisRunState;
  stepIndex: number;
  stepTotal: number;
  stageMessage: string;
  progressMessage: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
}

export function createIdleProjectAnalysisRunStatus(rootPath: string): ProjectAnalysisRunStatus {
  return {
    rootPath,
    status: 'idle',
    stepIndex: 0,
    stepTotal: 4,
    stageMessage: '대기 중',
    progressMessage: null,
    startedAt: null,
    updatedAt: null,
    completedAt: null,
    lastError: null,
  };
}

export function isProjectAnalysisContext(value: unknown): value is ProjectAnalysisContext {
  return normalizeProjectAnalysisContext(value) !== null;
}

export function normalizeProjectAnalysisContext(value: unknown): ProjectAnalysisContext | null {
  if (isCurrentProjectAnalysisContext(value)) {
    return {
      ...value,
      files: [...value.files],
      directories: [...value.directories],
      detectedFrameworks: [...value.detectedFrameworks],
      entrypoints: [...value.entrypoints],
      keyConfigs: [...value.keyConfigs],
      modules: [...value.modules],
      unknowns: [...value.unknowns],
      documentSummaries: value.documentSummaries.map((summary) => ({ ...summary })),
      documentLayouts: cloneProjectAnalysisDocumentLayoutMap(value.documentLayouts),
      layers: value.layers.map((layer) => ({
        ...layer,
        dependsOn: [...layer.dependsOn],
        directories: [...layer.directories],
      })),
      directorySummaries: value.directorySummaries.map((directory) => ({ ...directory })),
      connections: value.connections.map((connection) => ({ ...connection })),
      documentLinks: (value.documentLinks ?? []).map((documentLink) => ({ ...documentLink })),
      fileReferences: (value.fileReferences ?? []).map((fileReference) => ({ ...fileReference })),
      referenceAnalysis: cloneProjectAnalysisReferenceAnalysis(value.referenceAnalysis),
    };
  }

  if (isPreviousProjectAnalysisContext(value)) {
    return {
      schemaVersion: ANALYSIS_CONTEXT_SCHEMA_VERSION,
      files: [...value.files],
      directories: [...value.directories],
      detectedFrameworks: [...value.detectedFrameworks],
      entrypoints: [...value.entrypoints],
      keyConfigs: [...value.keyConfigs],
      modules: [...value.modules],
      unknowns: [...value.unknowns],
      confidence: value.confidence,
      projectPurpose: value.projectPurpose,
      architectureSummary: value.architectureSummary,
      documentSummaries: value.documentSummaries.map((summary) => ({ ...summary })),
      documentLayouts: cloneProjectAnalysisDocumentLayoutMap(value.documentLayouts),
      layers: value.layers.map((layer) => ({
        ...layer,
        dependsOn: [...layer.dependsOn],
        directories: [...layer.directories],
      })),
      directorySummaries: value.directorySummaries.map((directory) => ({ ...directory })),
      connections: value.connections.map((connection) => ({ ...connection })),
      documentLinks: value.documentLinks.map((documentLink) => ({ ...documentLink })),
      fileReferences: value.fileReferences.map((fileReference) => ({ ...fileReference })),
      referenceAnalysis: createEmptyProjectAnalysisReferenceAnalysis(),
    };
  }

  if (isLegacyProjectAnalysisContext(value)) {
    return {
      schemaVersion: ANALYSIS_CONTEXT_SCHEMA_VERSION,
      files: [...value.files],
      directories: [...value.directories],
      detectedFrameworks: [...value.detectedFrameworks],
      entrypoints: [...value.entrypoints],
      keyConfigs: [...value.keyConfigs],
      modules: [...value.modules],
      unknowns: [...value.unknowns],
      confidence: value.confidence,
      projectPurpose: '',
      architectureSummary: '',
      documentSummaries: [],
      documentLayouts: {},
      layers: [],
      directorySummaries: [],
      connections: [],
      documentLinks: [],
      fileReferences: [],
      referenceAnalysis: createEmptyProjectAnalysisReferenceAnalysis(),
    };
  }

  return null;
}

export function isProjectAnalysisFileIndexDocument(
  value: unknown,
): value is ProjectAnalysisFileIndexDocument {
  return normalizeProjectAnalysisFileIndexDocument(value) !== null;
}

export function normalizeProjectAnalysisFileIndexDocument(
  value: unknown,
): ProjectAnalysisFileIndexDocument | null {
  if (isCurrentProjectAnalysisFileIndexDocument(value)) {
    return {
      ...value,
      entries: value.entries.map((entry) => cloneProjectAnalysisFileIndexEntry(entry)),
    };
  }

  if (isLegacyProjectAnalysisFileIndexDocument(value)) {
    return {
      schemaVersion: ANALYSIS_FILE_INDEX_SCHEMA_VERSION,
      generatedAt: value.generatedAt,
      entries: value.entries.map((entry) => cloneProjectAnalysisFileIndexEntry(entry)),
    };
  }

  return null;
}

export function createEmptyProjectAnalysisReferenceAnalysis(): ProjectAnalysisReferenceAnalysis {
  return {
    scanLimits: [],
    structureDiscovery: {
      aliasConfigPaths: [],
      featureClusters: [],
      notes: [],
      packageRoots: [],
      sourceRoots: [],
    },
    unresolvedFileReferences: [],
  };
}

function isCurrentProjectAnalysisFileIndexDocument(
  value: unknown,
): value is ProjectAnalysisFileIndexDocument {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.schemaVersion === ANALYSIS_FILE_INDEX_SCHEMA_VERSION &&
    typeof candidate.generatedAt === 'string' &&
    Array.isArray(candidate.entries) &&
    candidate.entries.every((entry) => isProjectAnalysisFileIndexEntry(entry))
  );
}

function isLegacyProjectAnalysisFileIndexDocument(
  value: unknown,
): value is LegacyProjectAnalysisFileIndexDocument {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.schemaVersion === LEGACY_ANALYSIS_FILE_INDEX_SCHEMA_VERSION &&
    typeof candidate.generatedAt === 'string' &&
    Array.isArray(candidate.entries) &&
    candidate.entries.every((entry) => isProjectAnalysisFileIndexEntry(entry))
  );
}

export function createProjectAnalysisDocument(input: {
  id: ProjectAnalysisDocumentId;
  summary: string;
  markdown: string;
}): ProjectAnalysisDocument {
  return {
    id: input.id,
    title: getProjectAnalysisDocumentTitle(input.id),
    summary: input.summary,
    markdown: input.markdown,
  };
}

export function getProjectAnalysisDocumentTitle(id: ProjectAnalysisDocumentId): string {
  switch (id) {
    case 'overview':
      return '프로젝트 개요';
    case 'purpose':
      return '목적과 사용자 가치';
    case 'structure':
      return '구조와 주요 모듈';
    case 'layers':
      return '계층과 책임';
    case 'connectivity':
      return '연결성과 데이터 흐름';
  }
}

export function orderProjectAnalysisDocuments<T extends { id: ProjectAnalysisDocumentId }>(
  documents: T[],
): T[] {
  const orderMap = new Map(PROJECT_ANALYSIS_DOCUMENT_IDS.map((id, index) => [id, index]));

  return [...documents].sort((left, right) => {
    const leftOrder = orderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = orderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER;

    return leftOrder - rightOrder;
  });
}

function isCurrentProjectAnalysisContext(value: unknown): value is ProjectAnalysisContext {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.schemaVersion === ANALYSIS_CONTEXT_SCHEMA_VERSION &&
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
    isProjectAnalysisDocumentSummaryArray(candidate.documentSummaries) &&
    (typeof candidate.documentLayouts === 'undefined' ||
      isProjectAnalysisDocumentLayoutMap(candidate.documentLayouts)) &&
    isProjectAnalysisLayerSummaryArray(candidate.layers) &&
    isProjectAnalysisDirectorySummaryArray(candidate.directorySummaries) &&
    isProjectAnalysisConnectionArray(candidate.connections) &&
    (typeof candidate.documentLinks === 'undefined' ||
      isProjectAnalysisDocumentLinkArray(candidate.documentLinks)) &&
    (typeof candidate.fileReferences === 'undefined' ||
      isProjectAnalysisFileReferenceArray(candidate.fileReferences)) &&
    isProjectAnalysisReferenceAnalysis(candidate.referenceAnalysis)
  );
}

function isPreviousProjectAnalysisContext(value: unknown): value is PreviousProjectAnalysisContext {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.schemaVersion === PREVIOUS_ANALYSIS_CONTEXT_SCHEMA_VERSION &&
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
    isProjectAnalysisDocumentSummaryArray(candidate.documentSummaries) &&
    (typeof candidate.documentLayouts === 'undefined' ||
      isProjectAnalysisDocumentLayoutMap(candidate.documentLayouts)) &&
    isProjectAnalysisLayerSummaryArray(candidate.layers) &&
    isProjectAnalysisDirectorySummaryArray(candidate.directorySummaries) &&
    isProjectAnalysisConnectionArray(candidate.connections) &&
    (typeof candidate.documentLinks === 'undefined' ||
      isProjectAnalysisDocumentLinkArray(candidate.documentLinks)) &&
    (typeof candidate.fileReferences === 'undefined' ||
      isProjectAnalysisFileReferenceArray(candidate.fileReferences))
  );
}

function isLegacyProjectAnalysisContext(value: unknown): value is LegacyProjectAnalysisContext {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.schemaVersion === LEGACY_ANALYSIS_CONTEXT_SCHEMA_VERSION &&
    isStringArray(candidate.files) &&
    isStringArray(candidate.directories) &&
    isStringArray(candidate.detectedFrameworks) &&
    isStringArray(candidate.entrypoints) &&
    isStringArray(candidate.keyConfigs) &&
    isStringArray(candidate.modules) &&
    isStringArray(candidate.unknowns) &&
    typeof candidate.confidence === 'number'
  );
}

function isProjectAnalysisDocumentSummaryArray(
  value: unknown,
): value is ProjectAnalysisDocumentSummary[] {
  return (
    Array.isArray(value) && value.every((summary) => isProjectAnalysisDocumentSummary(summary))
  );
}

function isProjectAnalysisDocumentSummary(value: unknown): value is ProjectAnalysisDocumentSummary {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    PROJECT_ANALYSIS_DOCUMENT_IDS.includes(candidate.id as ProjectAnalysisDocumentId) &&
    typeof candidate.summary === 'string'
  );
}

function isProjectAnalysisDocumentLayoutMap(
  value: unknown,
): value is ProjectAnalysisDocumentLayoutMap {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return Object.entries(value).every(([documentId, layout]) => {
    return (
      PROJECT_ANALYSIS_DOCUMENT_IDS.includes(documentId as ProjectAnalysisDocumentId) &&
      isProjectAnalysisDocumentLayout(layout)
    );
  });
}

function isProjectAnalysisDocumentLayout(value: unknown): value is ProjectAnalysisDocumentLayout {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.x === 'number' &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === 'number' &&
    Number.isFinite(candidate.y)
  );
}

function isProjectAnalysisLayerSummaryArray(
  value: unknown,
): value is ProjectAnalysisLayerSummary[] {
  return Array.isArray(value) && value.every((layer) => isProjectAnalysisLayerSummary(layer));
}

function isProjectAnalysisLayerSummary(value: unknown): value is ProjectAnalysisLayerSummary {
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

function isProjectAnalysisDirectorySummaryArray(
  value: unknown,
): value is ProjectAnalysisDirectorySummary[] {
  return (
    Array.isArray(value) && value.every((directory) => isProjectAnalysisDirectorySummary(directory))
  );
}

function isProjectAnalysisDirectorySummary(
  value: unknown,
): value is ProjectAnalysisDirectorySummary {
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

function isProjectAnalysisConnectionArray(value: unknown): value is ProjectAnalysisConnection[] {
  return (
    Array.isArray(value) && value.every((connection) => isProjectAnalysisConnection(connection))
  );
}

function isProjectAnalysisConnection(value: unknown): value is ProjectAnalysisConnection {
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

function isProjectAnalysisDocumentLinkArray(
  value: unknown,
): value is ProjectAnalysisDocumentLink[] {
  return (
    Array.isArray(value) &&
    value.every((documentLink) => isProjectAnalysisDocumentLink(documentLink))
  );
}

function isProjectAnalysisDocumentLink(value: unknown): value is ProjectAnalysisDocumentLink {
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

function isProjectAnalysisFileReferenceArray(
  value: unknown,
): value is ProjectAnalysisFileReference[] {
  return (
    Array.isArray(value) &&
    value.every((fileReference) => isProjectAnalysisFileReference(fileReference))
  );
}

function isProjectAnalysisFileReference(value: unknown): value is ProjectAnalysisFileReference {
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

function isProjectAnalysisFileIndexEntry(value: unknown): value is ProjectAnalysisFileIndexEntry {
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
    (typeof candidate.grouping === 'undefined' ||
      isProjectAnalysisFileGrouping(candidate.grouping)) &&
    (typeof candidate.classification === 'undefined' ||
      isProjectAnalysisFileClassification(candidate.classification)) &&
    (typeof candidate.references === 'undefined' ||
      isProjectAnalysisFileReferenceTargetArray(candidate.references)) &&
    (typeof candidate.unresolvedReferences === 'undefined' ||
      isProjectAnalysisUnresolvedFileReferenceTargetArray(candidate.unresolvedReferences))
  );
}

function isProjectAnalysisFileGrouping(value: unknown): value is ProjectAnalysisFileGrouping {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    (typeof candidate.area === 'string' || candidate.area === null) &&
    (typeof candidate.cluster === 'string' || candidate.cluster === null)
  );
}

function isProjectAnalysisFileClassification(
  value: unknown,
): value is ProjectAnalysisFileClassification {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    isProjectAnalysisFileClassificationMeta(candidate.category) &&
    (candidate.layer === null || isProjectAnalysisFileClassificationMeta(candidate.layer))
  );
}

function isProjectAnalysisFileClassificationMeta(
  value: unknown,
): value is ProjectAnalysisFileClassificationMeta {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.confidence === 'number' &&
    isStringArray(candidate.reasons) &&
    typeof candidate.status === 'string' &&
    PROJECT_ANALYSIS_CLASSIFICATION_STATUSES.includes(
      candidate.status as ProjectAnalysisClassificationStatus,
    )
  );
}

function isProjectAnalysisFileReferenceTargetArray(
  value: unknown,
): value is ProjectAnalysisFileReferenceTarget[] {
  return (
    Array.isArray(value) &&
    value.every((referenceTarget) => isProjectAnalysisFileReferenceTarget(referenceTarget))
  );
}

function isProjectAnalysisFileReferenceTarget(
  value: unknown,
): value is ProjectAnalysisFileReferenceTarget {
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

function isProjectAnalysisUnresolvedFileReferenceTargetArray(
  value: unknown,
): value is ProjectAnalysisUnresolvedFileReferenceTarget[] {
  return (
    Array.isArray(value) &&
    value.every((referenceTarget) =>
      isProjectAnalysisUnresolvedFileReferenceTarget(referenceTarget),
    )
  );
}

function isProjectAnalysisUnresolvedFileReferenceTarget(
  value: unknown,
): value is ProjectAnalysisUnresolvedFileReferenceTarget {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    isStringArray(candidate.candidatePaths) &&
    typeof candidate.confidence === 'number' &&
    typeof candidate.language === 'string' &&
    typeof candidate.reason === 'string' &&
    typeof candidate.relationship === 'string' &&
    typeof candidate.resolutionKind === 'string' &&
    typeof candidate.specifier === 'string'
  );
}

function isProjectAnalysisReferenceAnalysis(
  value: unknown,
): value is ProjectAnalysisReferenceAnalysis {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    isProjectAnalysisReferenceScanLimitArray(candidate.scanLimits) &&
    isProjectAnalysisStructureDiscovery(candidate.structureDiscovery) &&
    isProjectAnalysisUnresolvedFileReferenceArray(candidate.unresolvedFileReferences)
  );
}

function isProjectAnalysisReferenceScanLimitArray(
  value: unknown,
): value is ProjectAnalysisReferenceScanLimit[] {
  return (
    Array.isArray(value) &&
    value.every((scanLimit) => isProjectAnalysisReferenceScanLimit(scanLimit))
  );
}

function isProjectAnalysisReferenceScanLimit(
  value: unknown,
): value is ProjectAnalysisReferenceScanLimit {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.kind === 'string' &&
    (candidate.kind === 'depth' || candidate.kind === 'directory' || candidate.kind === 'file') &&
    typeof candidate.limit === 'number' &&
    typeof candidate.message === 'string' &&
    typeof candidate.reached === 'boolean'
  );
}

function isProjectAnalysisStructureDiscovery(
  value: unknown,
): value is ProjectAnalysisStructureDiscovery {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    isStringArray(candidate.aliasConfigPaths) &&
    Array.isArray(candidate.featureClusters) &&
    candidate.featureClusters.every((cluster) =>
      isProjectAnalysisStructureDiscoveryFeatureCluster(cluster),
    ) &&
    isStringArray(candidate.notes) &&
    Array.isArray(candidate.packageRoots) &&
    candidate.packageRoots.every((packageRoot) =>
      isProjectAnalysisStructureDiscoveryPackageRoot(packageRoot),
    ) &&
    Array.isArray(candidate.sourceRoots) &&
    candidate.sourceRoots.every((sourceRoot) =>
      isProjectAnalysisStructureDiscoverySourceRoot(sourceRoot),
    )
  );
}

function isProjectAnalysisStructureDiscoveryPackageRoot(
  value: unknown,
): value is ProjectAnalysisStructureDiscoveryPackageRoot {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.confidence === 'number' &&
    (typeof candidate.packageName === 'string' || candidate.packageName === null) &&
    typeof candidate.path === 'string' &&
    typeof candidate.reason === 'string' &&
    isStringArray(candidate.sourceRoots)
  );
}

function isProjectAnalysisStructureDiscoverySourceRoot(
  value: unknown,
): value is ProjectAnalysisStructureDiscoverySourceRoot {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.confidence === 'number' &&
    typeof candidate.kind === 'string' &&
    (typeof candidate.packageRoot === 'string' || candidate.packageRoot === null) &&
    typeof candidate.path === 'string' &&
    typeof candidate.reason === 'string'
  );
}

function isProjectAnalysisStructureDiscoveryFeatureCluster(
  value: unknown,
): value is ProjectAnalysisStructureDiscoveryFeatureCluster {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.confidence === 'number' &&
    typeof candidate.path === 'string' &&
    typeof candidate.reason === 'string' &&
    typeof candidate.sourceRoot === 'string'
  );
}

function isProjectAnalysisUnresolvedFileReferenceArray(
  value: unknown,
): value is ProjectAnalysisUnresolvedFileReference[] {
  return (
    Array.isArray(value) &&
    value.every((reference) => isProjectAnalysisUnresolvedFileReference(reference))
  );
}

function isProjectAnalysisUnresolvedFileReference(
  value: unknown,
): value is ProjectAnalysisUnresolvedFileReference {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.from === 'string' && isProjectAnalysisUnresolvedFileReferenceTarget(candidate)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function cloneProjectAnalysisReferenceAnalysis(
  value: ProjectAnalysisReferenceAnalysis,
): ProjectAnalysisReferenceAnalysis {
  return {
    scanLimits: value.scanLimits.map((scanLimit) => ({ ...scanLimit })),
    structureDiscovery: {
      aliasConfigPaths: [...value.structureDiscovery.aliasConfigPaths],
      featureClusters: value.structureDiscovery.featureClusters.map((cluster) => ({ ...cluster })),
      notes: [...value.structureDiscovery.notes],
      packageRoots: value.structureDiscovery.packageRoots.map((packageRoot) => ({
        ...packageRoot,
        sourceRoots: [...packageRoot.sourceRoots],
      })),
      sourceRoots: value.structureDiscovery.sourceRoots.map((sourceRoot) => ({ ...sourceRoot })),
    },
    unresolvedFileReferences: value.unresolvedFileReferences.map((reference) => ({
      ...reference,
      candidatePaths: [...reference.candidatePaths],
    })),
  };
}

function cloneProjectAnalysisFileIndexEntry(
  entry: ProjectAnalysisFileIndexEntry,
): ProjectAnalysisFileIndexEntry {
  return {
    ...entry,
    ...(entry.grouping ? { grouping: { ...entry.grouping } } : {}),
    ...(entry.classification
      ? {
          classification: {
            category: {
              ...entry.classification.category,
              reasons: [...entry.classification.category.reasons],
            },
            layer: entry.classification.layer
              ? {
                  ...entry.classification.layer,
                  reasons: [...entry.classification.layer.reasons],
                }
              : null,
          },
        }
      : {}),
    ...(entry.references
      ? { references: entry.references.map((reference) => ({ ...reference })) }
      : {}),
    ...(entry.unresolvedReferences
      ? {
          unresolvedReferences: entry.unresolvedReferences.map((reference) => ({
            ...reference,
            candidatePaths: [...reference.candidatePaths],
          })),
        }
      : {}),
  };
}

function cloneProjectAnalysisDocumentLayoutMap(
  value: ProjectAnalysisDocumentLayoutMap | undefined,
): ProjectAnalysisDocumentLayoutMap {
  if (!value) {
    return {};
  }

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
