import type {
  ProjectDirectoryStatus,
  ProjectMeta,
  RecentProject,
  ProjectStorageInitialization,
} from '@/domain/project/project-model';
import type {
  ProjectAnalysis,
  ProjectAnalysisDraft,
} from '@/domain/project/project-analysis-model';
import type {
  ProjectSessionMessage,
  ProjectSessionMessageRole,
  ProjectSessionMeta,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';
import type { Result } from '@/shared/contracts/result';

export interface ProjectDialogPort {
  openProjectDirectory(): Promise<Result<string | null>>;
}

export interface ProjectInspectorPort {
  inspectDirectory(input: { rootPath: string }): Promise<Result<ProjectDirectoryStatus>>;
}

export interface ProjectAnalyzerPort {
  analyzeProject(input: { rootPath: string; projectName: string }): Promise<Result<ProjectAnalysisDraft>>;
}

export interface ProjectSessionPort {
  listSessions(input: { rootPath: string }): Promise<Result<ProjectSessionSummary[]>>;
  createSession(input: {
    rootPath: string;
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
  initializeStorage(input: { rootPath: string }): Promise<Result<ProjectStorageInitialization>>;
  writeProjectAnalysis(input: {
    rootPath: string;
    analysis: ProjectAnalysisDraft;
  }): Promise<Result<{ analysis: ProjectAnalysis; projectMeta: ProjectMeta }>>;
}

export interface RecentProjectsStorePort {
  listRecentProjects(): Promise<Result<RecentProject[]>>;
  upsertRecentProject(input: { rootPath: string; projectName: string }): Promise<Result<void>>;
  reorderRecentProjects(input: { rootPaths: string[] }): Promise<Result<RecentProject[]>>;
}
