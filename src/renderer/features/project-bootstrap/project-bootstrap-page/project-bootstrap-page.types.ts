import type { ProjectAnalysis } from '@/domain/project/project-analysis-model';
import type { ProjectInspection, RecentProject } from '@/domain/project/project-model';
import type {
  ProjectSessionMessage,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';

export type StatusBadgeTone = 'positive' | 'warning' | 'neutral';

export interface StatusBadgeModel {
  label: string;
  tone: StatusBadgeTone;
}

export interface ProjectBootstrapWorkbenchState {
  selectedPath: string | null;
  inspection: ProjectInspection | null;
  analysis: ProjectAnalysis | null;
  sessions: ProjectSessionSummary[];
  selectedSessionId: string | null;
  sessionMessages: ProjectSessionMessage[];
  draftMessage: string;
  recentProjects: RecentProject[];
  draggingProjectRootPath: string | null;
  dropTargetRootPath: string | null;
  isSelecting: boolean;
  isInitializing: boolean;
  isAnalyzing: boolean;
  isCreatingSession: boolean;
  isSendingMessage: boolean;
  isLeftSidebarOpen: boolean;
  isRightSidebarOpen: boolean;
  message: string;
  errorMessage: string | null;
}

export interface ProjectBootstrapWorkbenchViewModel {
  analysisStatus: StatusBadgeModel;
  canAnalyze: boolean;
  canInitialize: boolean;
  projectEntries: RecentProject[];
  selectedSession: ProjectSessionSummary | null;
  storageStatus: StatusBadgeModel;
  workbenchClassName: string;
}
