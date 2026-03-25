import type { AgentCliModelReasoningEffort } from '@/domain/app-settings/agent-cli-connection-model';
import type {
  ProjectAnalysis,
  ProjectAnalysisDocumentLayoutMap,
  ProjectAnalysisMode,
  ProjectAnalysisRunStatus,
} from '@/domain/project/project-analysis-model';
import type { ProjectInspection, RecentProject } from '@/domain/project/project-model';
import type { ProjectReferenceTagDocument } from '@/domain/project/project-reference-tag-model';
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
  renameProject: 'project/rename-project',
  readAnalysis: 'project/read-analysis',
  saveAnalysisDocumentLayouts: 'project/save-analysis-document-layouts',
  saveReferenceTags: 'project/save-reference-tags',
  generateReferenceTags: 'project/generate-reference-tags',
  cancelReferenceTagGeneration: 'project/cancel-reference-tag-generation',
  readSpecs: 'project/read-specs',
  createSpec: 'project/create-spec',
  saveSpec: 'project/save-spec',
  readAnalysisRunStatus: 'project/read-analysis-run-status',
  analyze: 'project/analyze',
  cancelAnalysis: 'project/cancel-analysis',
  listSessions: 'project/list-sessions',
  createSession: 'project/create-session',
  readSessionMessages: 'project/read-session-messages',
  sendSessionMessage: 'project/send-session-message',
  listRecentProjects: 'project/list-recent-projects',
  removeRecentProject: 'project/remove-recent-project',
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

export interface RenameProjectInput {
  rootPath: string;
  projectName: string;
}

export interface AnalyzeProjectInput {
  mode: ProjectAnalysisMode;
  rootPath: string;
}

export interface SaveProjectAnalysisDocumentLayoutsInput {
  rootPath: string;
  documentLayouts: ProjectAnalysisDocumentLayoutMap;
}

export interface SaveProjectReferenceTagsInput {
  rootPath: string;
  referenceTags: ProjectReferenceTagDocument;
}

export interface GenerateProjectReferenceTagsInput {
  rootPath: string;
}

export interface CancelProjectReferenceTagGenerationInput {
  rootPath: string;
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

export interface SaveProjectSpecInput {
  rootPath: string;
  specId: string;
  revision: number;
  title: string;
  markdown: string;
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
  model: string;
  modelReasoningEffort: AgentCliModelReasoningEffort;
  rootPath: string;
  sessionId: string;
  text: string;
}

export interface ActivateProjectInput {
  rootPath: string;
}

export interface RemoveRecentProjectInput {
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

export interface RenameProjectOutput {
  projectMeta: ProjectInspection['projectMeta'];
  recentProjects: RecentProject[];
}

export interface SendProjectSessionMessageOutput {
  assistantErrorMessage: string | null;
  messages: ProjectSessionMessage[];
  spec: ProjectSpecDocument | null;
  session: ProjectSessionMeta;
}

export interface CreateProjectSpecOutput {
  inspection: ProjectInspection;
  spec: ProjectSpecDocument;
}

export interface RendererProjectApi {
  selectDirectory(): Promise<Result<SelectProjectDirectoryOutput>>;
  inspect(input: InspectProjectInput): Promise<Result<ProjectInspection>>;
  renameProject(input: RenameProjectInput): Promise<Result<RenameProjectOutput>>;
  listRecentProjects(): Promise<Result<RecentProject[]>>;
  removeRecentProject(input: RemoveRecentProjectInput): Promise<Result<RecentProject[]>>;
  activate(input: ActivateProjectInput): Promise<Result<ActivateProjectOutput>>;
  reorderRecentProjects(input: ReorderRecentProjectsInput): Promise<Result<RecentProject[]>>;
  readAnalysis(input: ReadProjectAnalysisInput): Promise<Result<ProjectAnalysis | null>>;
  saveAnalysisDocumentLayouts(
    input: SaveProjectAnalysisDocumentLayoutsInput,
  ): Promise<Result<ProjectAnalysisDocumentLayoutMap>>;
  saveReferenceTags(
    input: SaveProjectReferenceTagsInput,
  ): Promise<Result<ProjectReferenceTagDocument>>;
  generateReferenceTags(
    input: GenerateProjectReferenceTagsInput,
  ): Promise<Result<ProjectReferenceTagDocument>>;
  cancelReferenceTagGeneration(
    input: CancelProjectReferenceTagGenerationInput,
  ): Promise<Result<void>>;
  readSpecs(input: ReadProjectSpecsInput): Promise<Result<ProjectSpecDocument[]>>;
  createSpec(input: CreateProjectSpecInput): Promise<Result<CreateProjectSpecOutput>>;
  saveSpec(input: SaveProjectSpecInput): Promise<Result<ProjectSpecDocument>>;
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
