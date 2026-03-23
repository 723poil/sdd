import type { ProjectAnalysis } from '@/domain/project/project-analysis-model';
import type { ProjectInspection, RecentProject } from '@/domain/project/project-model';
import type {
  ProjectSessionMessage,
  ProjectSessionMeta,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';
import type { Result } from '@/shared/contracts/result';

export const projectIpcChannels = {
  selectDirectory: 'project/select-directory',
  inspect: 'project/inspect',
  initializeStorage: 'project/initialize-storage',
  readAnalysis: 'project/read-analysis',
  analyze: 'project/analyze',
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

export interface InitializeProjectStorageInput {
  rootPath: string;
}

export interface ReadProjectAnalysisInput {
  rootPath: string;
}

export interface AnalyzeProjectInput {
  rootPath: string;
}

export interface ListProjectSessionsInput {
  rootPath: string;
}

export interface CreateProjectSessionInput {
  rootPath: string;
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

export interface InitializeProjectStorageOutput {
  inspection: ProjectInspection;
  createdSddDirectory: boolean;
  initializedAt: string;
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

export interface RendererSddApi {
  project: {
    selectDirectory(): Promise<Result<SelectProjectDirectoryOutput>>;
    inspect(input: InspectProjectInput): Promise<Result<ProjectInspection>>;
    listRecentProjects(): Promise<Result<RecentProject[]>>;
    activate(input: ActivateProjectInput): Promise<Result<ActivateProjectOutput>>;
    reorderRecentProjects(input: ReorderRecentProjectsInput): Promise<Result<RecentProject[]>>;
    readAnalysis(input: ReadProjectAnalysisInput): Promise<Result<ProjectAnalysis | null>>;
    analyze(input: AnalyzeProjectInput): Promise<Result<AnalyzeProjectOutput>>;
    listSessions(input: ListProjectSessionsInput): Promise<Result<ProjectSessionSummary[]>>;
    createSession(input: CreateProjectSessionInput): Promise<Result<ProjectSessionMeta>>;
    readSessionMessages(
      input: ReadProjectSessionMessagesInput,
    ): Promise<Result<ProjectSessionMessage[]>>;
    sendSessionMessage(
      input: SendProjectSessionMessageInput,
    ): Promise<Result<SendProjectSessionMessageOutput>>;
    initializeStorage(
      input: InitializeProjectStorageInput,
    ): Promise<Result<InitializeProjectStorageOutput>>;
  };
}
