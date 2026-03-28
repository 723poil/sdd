import type {
  AgentCliId,
  AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';
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
import type {
  ProjectSpecApplyVersionResult,
  ProjectSpecDeleteVersionResult,
  ProjectSpecDocument,
  ProjectSpecMetaUpdateResult,
  ProjectSpecRelation,
  ProjectSpecSaveResult,
  ProjectSpecStatus,
  ProjectSpecVersionDiff,
  ProjectSpecVersionDocument,
  ProjectSpecVersionHistoryEntry,
} from '@/domain/project/project-spec-model';
import type { ProjectReferenceTagDocument } from '@/domain/project/project-reference-tag-model';
import type {
  ProjectSessionMessageAttachmentUpload,
  ProjectSessionMessage,
  ProjectSessionMessagePendingAttachment,
  ProjectSessionMessageRole,
  ProjectSessionMessageRunStatus,
  ProjectSessionMeta,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';
import type { Result } from '@/shared/contracts/result';

export interface ProjectAnalysisRunControl {
  signal: AbortSignal;
  status: ProjectAnalysisRunStatus;
}

export interface ProjectSessionMessageRunControl {
  signal: AbortSignal;
  status: ProjectSessionMessageRunStatus;
}

export interface ProjectDialogPort {
  openProjectDirectory(): Promise<Result<string | null>>;
}

export interface ProjectInspectorPort {
  inspectDirectory(input: { rootPath: string }): Promise<Result<ProjectDirectoryStatus>>;
}

export interface ProjectAnalyzerPort {
  analyzeProject(input: {
    agentId: AgentCliId;
    mode: ProjectAnalysisMode;
    rootPath: string;
    projectName: string;
  }): Promise<Result<ProjectAnalysisDraft>>;
}

export interface ProjectReferenceTagGeneratorPort {
  generateReferenceTags(input: {
    agentId: AgentCliId;
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

export interface ProjectSessionMessageRunStatusPort {
  readSessionMessageRunStatus(input: {
    rootPath: string;
    sessionId: string;
  }): Result<ProjectSessionMessageRunStatus>;
  beginSessionMessageRun(input: {
    rootPath: string;
    sessionId: string;
    requestText: string | null;
    requestSummary: string | null;
    attachmentCount: number;
    requestAttachments?: ProjectSessionMessagePendingAttachment[];
    stageMessage: string;
    progressMessage?: string | null;
    startedAt: string;
    stepIndex: number;
    stepTotal: number;
  }): Result<ProjectSessionMessageRunControl>;
  cancelSessionMessageRun(input: {
    rootPath: string;
    sessionId: string;
  }): Result<ProjectSessionMessageRunStatus>;
  updateSessionMessageRunStatus(input: {
    rootPath: string;
    sessionId: string;
    status?: ProjectSessionMessageRunStatus['status'];
    stageMessage?: string;
    progressMessage?: string | null;
    requestText?: string | null;
    requestSummary?: string | null;
    attachmentCount?: number;
    requestAttachments?: ProjectSessionMessagePendingAttachment[];
    stepIndex?: number;
    stepTotal?: number;
    updatedAt?: string;
    completedAt?: string | null;
    lastError?: string | null;
  }): Result<ProjectSessionMessageRunStatus>;
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
    attachments?: ProjectSessionMessageAttachmentUpload[];
    rootPath: string;
    sessionId: string;
    role: ProjectSessionMessageRole;
    text: string;
  }): Promise<Result<{ message: ProjectSessionMessage; session: ProjectSessionMeta }>>;
}

export interface ProjectSpecChatPort {
  generateReply(input: {
    agentId: AgentCliId;
    model: string;
    modelReasoningEffort: AgentCliModelReasoningEffort;
    projectName: string;
    rootPath: string;
    signal: AbortSignal;
    sessionMessages: ProjectSessionMessage[];
    spec: ProjectSpecDocument;
  }): Promise<
    Result<{
      markdown: string;
      reply: string;
      summary: string | null;
      title: string;
    }>
  >;
}

export interface ProjectStoragePort {
  readProjectMeta(input: { rootPath: string }): Promise<Result<ProjectMeta | null>>;
  renameProject(input: {
    rootPath: string;
    projectName: string;
  }): Promise<Result<ProjectMeta | null>>;
  readProjectAnalysis(input: { rootPath: string }): Promise<Result<ProjectAnalysis | null>>;
  readProjectSpecs(input: { rootPath: string }): Promise<Result<ProjectSpecDocument[]>>;
  createProjectSpec(input: {
    rootPath: string;
    title?: string | null;
  }): Promise<Result<{ projectMeta: ProjectMeta; spec: ProjectSpecDocument }>>;
  saveProjectSpec(input: {
    rootPath: string;
    specId: string;
    revision: number;
    title: string;
    markdown: string;
    summary?: string | null;
  }): Promise<Result<ProjectSpecSaveResult>>;
  updateProjectSpecMeta(input: {
    rootPath: string;
    specId: string;
    revision: number;
    status: ProjectSpecStatus;
    relations: ProjectSpecRelation[];
  }): Promise<Result<ProjectSpecMetaUpdateResult>>;
  readProjectSpecVersionHistory(input: {
    rootPath: string;
    specId: string;
  }): Promise<Result<ProjectSpecVersionHistoryEntry[]>>;
  readProjectSpecVersion(input: {
    rootPath: string;
    specId: string;
    versionId: string;
  }): Promise<Result<ProjectSpecVersionDocument>>;
  readProjectSpecVersionDiff(input: {
    currentMarkdown?: string | null;
    currentTitle?: string | null;
    rootPath: string;
    specId: string;
    versionId: string;
  }): Promise<Result<ProjectSpecVersionDiff>>;
  applyProjectSpecVersion(input: {
    rootPath: string;
    revision: number;
    specId: string;
    versionId: string;
  }): Promise<Result<ProjectSpecApplyVersionResult>>;
  deleteProjectSpecVersion(input: {
    rootPath: string;
    revision: number;
    specId: string;
    versionId: string;
  }): Promise<Result<ProjectSpecDeleteVersionResult>>;
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

export type ProjectStorageBootstrapPort = Pick<
  ProjectStoragePort,
  'readProjectMeta' | 'initializeStorage'
>;

export type ProjectInspectionStoragePort = Pick<ProjectStoragePort, 'readProjectMeta'>;

export type ProjectAnalysisStoragePort = ProjectStorageBootstrapPort &
  Pick<ProjectStoragePort, 'readProjectAnalysis' | 'writeProjectAnalysis'>;

export type ProjectSessionMessageStoragePort = ProjectStorageBootstrapPort &
  Pick<ProjectStoragePort, 'readProjectSpecs' | 'saveProjectSpec'>;

export type ProjectReferenceTagStoragePort = ProjectStorageBootstrapPort &
  Pick<ProjectStoragePort, 'readProjectAnalysis' | 'saveProjectReferenceTags'>;

export interface RecentProjectsStorePort {
  listRecentProjects(): Promise<Result<RecentProject[]>>;
  upsertRecentProject(input: { rootPath: string; projectName: string }): Promise<Result<void>>;
  renameRecentProject(input: {
    rootPath: string;
    projectName: string;
  }): Promise<Result<RecentProject[]>>;
  removeRecentProject(input: { rootPath: string }): Promise<Result<RecentProject[]>>;
  reorderRecentProjects(input: { rootPaths: string[] }): Promise<Result<RecentProject[]>>;
}
