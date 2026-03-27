import type {
  ProjectAnalysis,
  ProjectAnalysisConnection,
  ProjectAnalysisDirectorySummary,
  ProjectAnalysisDocumentId,
  ProjectAnalysisFileIndexEntry,
  ProjectAnalysisLayerSummary,
  ProjectAnalysisRunStatus as ProjectAnalysisRunStatusModel,
} from '@/domain/project/project-analysis-model';
import type { ProjectInspection, RecentProject } from '@/domain/project/project-model';
import type {
  ProjectSessionMessage,
  ProjectSessionMessageRunStatus as ProjectSessionMessageRunStatusModel,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';
import type { AgentCliModelReasoningEffort } from '@/domain/app-settings/agent-cli-connection-model';
import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
import type { ProjectSessionDraftAttachment } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-session-attachment-draft';

export const WORKSPACE_PAGE_IDS = ['analysis', 'specs', 'references'] as const;
export type WorkspacePageId = (typeof WORKSPACE_PAGE_IDS)[number];

export type StatusBadgeTone = 'positive' | 'warning' | 'neutral';
export type WorkbenchProgressTaskStatus = Exclude<ProjectAnalysisRunStatusModel['status'], 'idle'>;
export type ReferenceTagGenerationStatus = 'running' | 'cancelling';

export type WorkbenchProgressTaskKind =
  | 'analysis'
  | 'project-activation'
  | 'spec-create'
  | 'spec-save'
  | 'session-create'
  | 'message-send'
  | 'reference-tags-save'
  | 'reference-tags-generate'
  | 'settings-save'
  | 'recent-projects-reorder';

export interface StatusBadgeModel {
  label: string;
  tone: StatusBadgeTone;
}

export type ProjectAnalysisRunStatus = ProjectAnalysisRunStatusModel;

export type ProjectAnalysisDocument = ProjectAnalysis['documents'][number];
export type ProjectAnalysisListEntry =
  | string
  | ProjectAnalysisLayerSummary
  | ProjectAnalysisConnection
  | ProjectAnalysisFileIndexEntry
  | ProjectAnalysisDirectorySummary;
export type SelectedProjectAnalysisDocumentId = ProjectAnalysisDocumentId | null;
export type StructuredProjectAnalysis = ProjectAnalysis;
export type SelectedProjectSpecId = string | null;

export interface WorkbenchProgressTask {
  id: string;
  kind: WorkbenchProgressTaskKind;
  title: string;
  detail: string;
  projectName: string | null;
  rootPath: string | null;
  sessionId: string | null;
  status: WorkbenchProgressTaskStatus;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  stepIndex: number | null;
  stepTotal: number | null;
  progressPercent: number | null;
  isCancellable: boolean;
}

export interface ProjectBootstrapWorkbenchState {
  selectedPath: string | null;
  activeWorkspacePage: WorkspacePageId;
  inspection: ProjectInspection | null;
  analysis: StructuredProjectAnalysis | null;
  specs: ProjectSpecDocument[];
  analysisRunStatusesByRootPath: Record<string, ProjectAnalysisRunStatus>;
  referenceTagGenerationStatusesByRootPath: Record<string, ReferenceTagGenerationStatus>;
  requestProgressTasks: WorkbenchProgressTask[];
  selectedProgressTaskId: string | null;
  sessions: ProjectSessionSummary[];
  selectedSessionId: string | null;
  selectedAnalysisDocumentId: SelectedProjectAnalysisDocumentId;
  selectedSpecId: SelectedProjectSpecId;
  specConflictBySpecId: Record<string, boolean>;
  sessionMessagesBySessionKey: Record<string, ProjectSessionMessage[]>;
  draftMessagesBySessionKey: Record<string, string>;
  draftAttachmentsBySessionKey: Record<string, ProjectSessionDraftAttachment[]>;
  draftAttachmentErrorsBySessionKey: Record<string, string[]>;
  sessionMessageRunStatusesBySessionKey: Record<string, ProjectSessionMessageRunStatusModel>;
  recentProjects: RecentProject[];
  editingProjectRootPath: string | null;
  editingProjectNameDraft: string;
  expandedProjectRootPaths: string[];
  draggingProjectRootPath: string | null;
  dropTargetRootPath: string | null;
  composerDragSessionKey: string | null;
  isSelecting: boolean;
  isCreatingSpec: boolean;
  isSavingSpec: boolean;
  isUpdatingSpecMeta: boolean;
  isCreatingSession: boolean;
  isSavingReferenceTags: boolean;
  isSavingChatRuntimeSettings: boolean;
  isLeftSidebarOpen: boolean;
  isRightSidebarOpen: boolean;
  chatModel: string;
  chatReasoningEffort: AgentCliModelReasoningEffort;
  message: string;
  errorMessage: string | null;
}

export interface ProjectBootstrapWorkbenchViewModel {
  activeProgressTask: WorkbenchProgressTask | null;
  analysisStatus: StatusBadgeModel;
  analysisRunStatus: ProjectAnalysisRunStatus | null;
  canAnalyzeProject: boolean;
  canAnalyzeReferences: boolean;
  canCancelAnalysis: boolean;
  projectEntries: RecentProject[];
  selectedSession: ProjectSessionSummary | null;
  selectedSessionMessageRunStatus: ProjectSessionMessageRunStatusModel | null;
  selectedSpec: ProjectSpecDocument | null;
  sessionMessages: ProjectSessionMessage[];
  draftMessage: string;
  draftAttachments: ProjectSessionDraftAttachment[];
  draftAttachmentErrors: string[];
  isComposerDragActive: boolean;
  storageStatus: StatusBadgeModel;
  isAnalyzing: boolean;
  isCancellingAnalysis: boolean;
  isCancellingMessage: boolean;
  isGeneratingReferenceTags: boolean;
  isCancellingReferenceTags: boolean;
  isSendingMessage: boolean;
  canCancelMessage: boolean;
  progressTasks: WorkbenchProgressTask[];
  workbenchClassName: string;
}

export type ProjectSessionMessageRunStatus = ProjectSessionMessageRunStatusModel;
