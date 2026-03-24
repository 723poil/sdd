import type {
  ProjectAnalysis,
  ProjectAnalysisDocumentLayoutMap,
  ProjectAnalysisRunStatus,
} from '@/domain/project/project-analysis-model';
import type { ProjectInspection, RecentProject } from '@/domain/project/project-model';
import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
import type {
  ProjectSessionMessage,
  ProjectSessionMeta,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';
import type { Result } from '@/shared/contracts/result';

export const projectIpcChannels = {
  selectDirectory: 'project/select-directory',
  inspect: 'project/inspect',
  readAnalysis: 'project/read-analysis',
  saveAnalysisDocumentLayouts: 'project/save-analysis-document-layouts',
  readSpecs: 'project/read-specs',
  createSpec: 'project/create-spec',
  readAnalysisRunStatus: 'project/read-analysis-run-status',
  analyze: 'project/analyze',
  cancelAnalysis: 'project/cancel-analysis',
  listSessions: 'project/list-sessions',
  createSession: 'project/create-session',
  readSessionMessages: 'project/read-session-messages',
  sendSessionMessage: 'project/send-session-message',
  listRecentProjects: 'project/list-recent-projects',
  activate: 'project/activate',
  reorderRecentProjects: 'project/reorder-recent-projects',
} as const;

export interface SelectProjectDirectoryOutput {
  didSelect: boolean;
  rootPath: string | null;
}

export interface InspectProjectInput {
  rootPath: string;
}

export interface ReadProjectAnalysisInput {
  rootPath: string;
}

export interface AnalyzeProjectInput {
  rootPath: string;
}

export interface SaveProjectAnalysisDocumentLayoutsInput {
  rootPath: string;
  documentLayouts: ProjectAnalysisDocumentLayoutMap;
}

export interface CancelProjectAnalysisInput {
  rootPath: string;
}

export interface ReadProjectSpecsInput {
  rootPath: string;
}

export interface CreateProjectSpecInput {
  rootPath: string;
  title?: string | null;
}

export interface ReadProjectAnalysisRunStatusInput {
  rootPath: string;
}

export interface ListProjectSessionsInput {
  rootPath: string;
}

export interface CreateProjectSessionInput {
  rootPath: string;
  specId?: string | null;
  title?: string;
}

export interface ReadProjectSessionMessagesInput {
  rootPath: string;
  sessionId: string;
}

export interface SendProjectSessionMessageInput {
  rootPath: string;
  sessionId: string;
  text: string;
}

export interface ActivateProjectInput {
  rootPath: string;
}

export interface ReorderRecentProjectsInput {
  rootPaths: string[];
}

export interface ActivateProjectOutput {
  inspection: ProjectInspection;
  recentProjects: RecentProject[];
}

export interface AnalyzeProjectOutput {
  analysis: ProjectAnalysis;
  inspection: ProjectInspection;
}

export interface SendProjectSessionMessageOutput {
  message: ProjectSessionMessage;
  session: ProjectSessionMeta;
}

export interface CreateProjectSpecOutput {
  inspection: ProjectInspection;
  spec: ProjectSpecDocument;
}

export interface RendererProjectApi {
  selectDirectory(): Promise<Result<SelectProjectDirectoryOutput>>;
  inspect(input: InspectProjectInput): Promise<Result<ProjectInspection>>;
  listRecentProjects(): Promise<Result<RecentProject[]>>;
  activate(input: ActivateProjectInput): Promise<Result<ActivateProjectOutput>>;
  reorderRecentProjects(input: ReorderRecentProjectsInput): Promise<Result<RecentProject[]>>;
  readAnalysis(input: ReadProjectAnalysisInput): Promise<Result<ProjectAnalysis | null>>;
  saveAnalysisDocumentLayouts(
    input: SaveProjectAnalysisDocumentLayoutsInput,
  ): Promise<Result<ProjectAnalysisDocumentLayoutMap>>;
  readSpecs(input: ReadProjectSpecsInput): Promise<Result<ProjectSpecDocument[]>>;
  createSpec(input: CreateProjectSpecInput): Promise<Result<CreateProjectSpecOutput>>;
  readAnalysisRunStatus(
    input: ReadProjectAnalysisRunStatusInput,
  ): Promise<Result<ProjectAnalysisRunStatus>>;
  analyze(input: AnalyzeProjectInput): Promise<Result<AnalyzeProjectOutput>>;
  cancelAnalysis(input: CancelProjectAnalysisInput): Promise<Result<ProjectAnalysisRunStatus>>;
  listSessions(input: ListProjectSessionsInput): Promise<Result<ProjectSessionSummary[]>>;
  createSession(input: CreateProjectSessionInput): Promise<Result<ProjectSessionMeta>>;
  readSessionMessages(
    input: ReadProjectSessionMessagesInput,
  ): Promise<Result<ProjectSessionMessage[]>>;
  sendSessionMessage(
    input: SendProjectSessionMessageInput,
  ): Promise<Result<SendProjectSessionMessageOutput>>;
}
