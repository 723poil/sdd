export const PROJECT_SCHEMA_VERSION = 1;
export const LEGACY_ANALYSIS_CONTEXT_SCHEMA_VERSION = 1;
export const PREVIOUS_ANALYSIS_CONTEXT_SCHEMA_VERSION = 2;
export const ANALYSIS_CONTEXT_SCHEMA_VERSION = 3;
export const LEGACY_ANALYSIS_FILE_INDEX_SCHEMA_VERSION = 1;
export const ANALYSIS_FILE_INDEX_SCHEMA_VERSION = 2;
export const SPEC_INDEX_SCHEMA_VERSION = 2;

export interface ProjectMeta {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  projectName: string;
  rootPath: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  lastAnalyzedAt: string | null;
  detectedStack: string[];
  defaultSpecId: string | null;
}

export interface ProjectDirectoryStatus {
  rootPath: string;
  projectName: string;
  exists: boolean;
  isDirectory: boolean;
  isReadable: boolean;
  isWritable: boolean;
  hasSddDirectory: boolean;
}

export interface ProjectInspection extends ProjectDirectoryStatus {
  initializationState: 'missing' | 'ready';
  projectMeta: ProjectMeta | null;
}

export interface ProjectStorageInitialization {
  createdSddDirectory: boolean;
  initializedAt: string;
  projectMeta: ProjectMeta;
}

export interface RecentProject {
  rootPath: string;
  projectName: string;
  lastOpenedAt: string;
  sortOrder: number;
}

export function normalizeProjectName(value: string): string {
  return value.trim();
}

export function createInitialProjectMeta(input: {
  projectName: string;
  rootPath: string;
  now: string;
}): ProjectMeta {
  const normalizedProjectName = normalizeProjectName(input.projectName);

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectName: normalizedProjectName,
    rootPath: input.rootPath,
    createdAt: input.now,
    updatedAt: input.now,
    revision: 1,
    lastAnalyzedAt: null,
    detectedStack: [],
    defaultSpecId: null,
  };
}

export function createNextProjectMetaAfterAnalysis(input: {
  current: ProjectMeta;
  detectedStack: string[];
  now: string;
}): ProjectMeta {
  return {
    ...input.current,
    updatedAt: input.now,
    revision: input.current.revision + 1,
    lastAnalyzedAt: input.now,
    detectedStack: input.detectedStack,
  };
}

export function createNextProjectMetaAfterSpecCreation(input: {
  current: ProjectMeta;
  now: string;
  specId: string;
}): ProjectMeta {
  return {
    ...input.current,
    updatedAt: input.now,
    revision: input.current.revision + 1,
    defaultSpecId: input.specId,
  };
}

export function createNextProjectMetaAfterRename(input: {
  current: ProjectMeta;
  now: string;
  projectName: string;
}): ProjectMeta {
  return {
    ...input.current,
    projectName: normalizeProjectName(input.projectName),
    updatedAt: input.now,
    revision: input.current.revision + 1,
  };
}

export function isProjectMeta(value: unknown): value is ProjectMeta {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.schemaVersion === PROJECT_SCHEMA_VERSION &&
    typeof candidate.projectName === 'string' &&
    typeof candidate.rootPath === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    typeof candidate.revision === 'number' &&
    (typeof candidate.lastAnalyzedAt === 'string' || candidate.lastAnalyzedAt === null) &&
    Array.isArray(candidate.detectedStack) &&
    candidate.detectedStack.every((item) => typeof item === 'string') &&
    (typeof candidate.defaultSpecId === 'string' || candidate.defaultSpecId === null)
  );
}
