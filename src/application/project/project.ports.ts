import type {
  ProjectDirectoryStatus,
  ProjectMeta,
  RecentProject,
  ProjectStorageInitialization,
} from '@/domain/project/project-model';
import type {
  ProjectAnalysis,
  ProjectAnalysisDraft,
  ProjectAnalysisDocumentLayoutMap,
  ProjectAnalysisMode,
  ProjectAnalysisRunState,
  ProjectAnalysisRunStatus,
} from '@/domain/project/project-analysis-model';
import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
import type { ProjectReferenceTagDocument } from '@/domain/project/project-reference-tag-model';
import type {
  ProjectSessionMessage,
  ProjectSessionMessageRole,
  ProjectSessionMeta,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';
import type { Result } from '@/shared/contracts/result';

export interface ProjectAnalysisRunControl {
  signal: AbortSignal;
  status: ProjectAnalysisRunStatus;
}

export interface ProjectDialogPort {
  openProjectDirectory(): Promise<Result<string | null>>;
}

export interface ProjectInspectorPort {
  inspectDirectory(input: { rootPath: string }): Promise<Result<ProjectDirectoryStatus>>;
}

export interface ProjectAnalyzerPort {
  analyzeProject(input: {
    mode: ProjectAnalysisMode;
    rootPath: string;
    projectName: string;
  }): Promise<Result<ProjectAnalysisDraft>>;
}

export interface ProjectReferenceTagGeneratorPort {
  generateReferenceTags(input: {
    analysis: ProjectAnalysis;
    projectName: string;
    rootPath: string;
  }): Promise<Result<ProjectReferenceTagDocument>>;
  cancelReferenceTagGeneration(input: { rootPath: string }): Result<void>;
}

export interface ProjectAnalysisRunStatusPort {
  readAnalysisRunStatus(input: { rootPath: string }): Result<ProjectAnalysisRunStatus>;
  beginAnalysisRun(input: {
    rootPath: string;
    stageMessage: string;
    progressMessage?: string | null;
    startedAt: string;
    stepIndex: number;
    stepTotal: number;
  }): Result<ProjectAnalysisRunControl>;
  cancelAnalysisRun(input: { rootPath: string }): Result<ProjectAnalysisRunStatus>;
  updateAnalysisRunStatus(input: {
    rootPath: string;
    status?: ProjectAnalysisRunState;
    stageMessage?: string;
    progressMessage?: string | null;
    stepIndex?: number;
    stepTotal?: number;
    updatedAt?: string;
    completedAt?: string | null;
    lastError?: string | null;
  }): Result<ProjectAnalysisRunStatus>;
}

export interface ProjectSessionPort {
  listSessions(input: { rootPath: string }): Promise<Result<ProjectSessionSummary[]>>;
  createSession(input: {
    rootPath: string;
    specId: string | null;
    title: string;
  }): Promise<Result<ProjectSessionMeta>>;
  readSessionMessages(input: {
    rootPath: string;
    sessionId: string;
  }): Promise<Result<ProjectSessionMessage[]>>;
  appendSessionMessage(input: {
    rootPath: string;
    sessionId: string;
    role: ProjectSessionMessageRole;
    text: string;
  }): Promise<Result<{ message: ProjectSessionMessage; session: ProjectSessionMeta }>>;
}

export interface ProjectStoragePort {
  readProjectMeta(input: { rootPath: string }): Promise<Result<ProjectMeta | null>>;
  readProjectAnalysis(input: { rootPath: string }): Promise<Result<ProjectAnalysis | null>>;
  readProjectSpecs(input: { rootPath: string }): Promise<Result<ProjectSpecDocument[]>>;
  createProjectSpec(input: {
    rootPath: string;
    title?: string | null;
  }): Promise<Result<{ projectMeta: ProjectMeta; spec: ProjectSpecDocument }>>;
  initializeStorage(input: { rootPath: string }): Promise<Result<ProjectStorageInitialization>>;
  writeProjectAnalysis(input: {
    rootPath: string;
    analysis: ProjectAnalysisDraft;
  }): Promise<Result<{ analysis: ProjectAnalysis; projectMeta: ProjectMeta }>>;
  saveProjectAnalysisDocumentLayouts(input: {
    rootPath: string;
    documentLayouts: ProjectAnalysisDocumentLayoutMap;
  }): Promise<Result<ProjectAnalysisDocumentLayoutMap>>;
  saveProjectReferenceTags(input: {
    rootPath: string;
    referenceTags: ProjectReferenceTagDocument;
  }): Promise<Result<ProjectReferenceTagDocument>>;
}

export interface RecentProjectsStorePort {
  listRecentProjects(): Promise<Result<RecentProject[]>>;
  upsertRecentProject(input: { rootPath: string; projectName: string }): Promise<Result<void>>;
  reorderRecentProjects(input: { rootPaths: string[] }): Promise<Result<RecentProject[]>>;
}
