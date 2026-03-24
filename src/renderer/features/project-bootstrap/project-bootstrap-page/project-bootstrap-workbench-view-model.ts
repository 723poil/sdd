import type { ProjectBootstrapWorkbenchState, ProjectBootstrapWorkbenchViewModel } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

import {
  getAnalysisStatus,
  getStorageStatus,
  resolveSelectedSession,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.utils';

export function createProjectBootstrapWorkbenchViewModel(
  state: ProjectBootstrapWorkbenchState,
): ProjectBootstrapWorkbenchViewModel {
  const canInitialize =
    state.inspection !== null && state.inspection.initializationState !== 'ready' && state.inspection.isWritable;
  const canAnalyze =
    state.inspection !== null && state.inspection.initializationState === 'ready' && state.inspection.isWritable;
  const selectedSession = resolveSelectedSession(state.sessions, state.selectedSessionId);

  return {
    analysisStatus: getAnalysisStatus({
      inspection: state.inspection,
      isAnalyzing: state.isAnalyzing,
    }),
    canAnalyze,
    canInitialize,
    projectEntries: state.recentProjects,
    selectedSession,
    storageStatus: getStorageStatus(state.inspection),
    workbenchClassName: [
      'workbench',
      !state.isLeftSidebarOpen ? 'workbench--left-collapsed' : '',
      !state.isRightSidebarOpen ? 'workbench--right-collapsed' : '',
    ]
      .filter(Boolean)
      .join(' '),
  };
}
