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
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';
import type { AgentCliModelReasoningEffort } from '@/domain/app-settings/agent-cli-connection-model';
import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';

export const WORKSPACE_PAGE_IDS = ['analysis', 'specs', 'references'] as const;
export type WorkspacePageId = (typeof WORKSPACE_PAGE_IDS)[number];

export type StatusBadgeTone = 'positive' | 'warning' | 'neutral';

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

export interface ProjectBootstrapWorkbenchState {
  selectedPath: string | null;
  activeWorkspacePage: WorkspacePageId;
  inspection: ProjectInspection | null;
  analysis: StructuredProjectAnalysis | null;
  specs: ProjectSpecDocument[];
  analysisRunStatusesByRootPath: Record<string, ProjectAnalysisRunStatus>;
  sessions: ProjectSessionSummary[];
  selectedSessionId: string | null;
  selectedAnalysisDocumentId: SelectedProjectAnalysisDocumentId;
  selectedSpecId: SelectedProjectSpecId;
  sessionMessages: ProjectSessionMessage[];
  draftMessage: string;
  recentProjects: RecentProject[];
  expandedProjectRootPaths: string[];
  draggingProjectRootPath: string | null;
  dropTargetRootPath: string | null;
  isSelecting: boolean;
  isCreatingSpec: boolean;
  isCreatingSession: boolean;
  isSendingMessage: boolean;
  isSavingChatRuntimeSettings: boolean;
  isLeftSidebarOpen: boolean;
  isRightSidebarOpen: boolean;
  chatModel: string;
  chatReasoningEffort: AgentCliModelReasoningEffort;
  message: string;
  errorMessage: string | null;
}

export interface ProjectBootstrapWorkbenchViewModel {
  analysisStatus: StatusBadgeModel;
  analysisRunStatus: ProjectAnalysisRunStatus | null;
  canAnalyzeProject: boolean;
  canAnalyzeReferences: boolean;
  canCancelAnalysis: boolean;
  projectEntries: RecentProject[];
  selectedSession: ProjectSessionSummary | null;
  selectedSpec: ProjectSpecDocument | null;
  storageStatus: StatusBadgeModel;
  isAnalyzing: boolean;
  isCancellingAnalysis: boolean;
  workbenchClassName: string;
}
