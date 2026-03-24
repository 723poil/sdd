import type { ProjectBootstrapWorkbenchState, ProjectBootstrapWorkbenchViewModel } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

import {
  getAnalysisStatus,
  getVisibleAnalysisRunStatus,
  getStorageStatus,
  resolveSelectedSpec,
  resolveSelectedSession,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.utils';

export function createProjectBootstrapWorkbenchViewModel(
  state: ProjectBootstrapWorkbenchState,
): ProjectBootstrapWorkbenchViewModel {
  const selectedAnalysisRunStatus =
    state.selectedPath !== null
      ? state.analysisRunStatusesByRootPath[state.selectedPath] ?? null
      : null;
  const visibleAnalysisRunStatus = getVisibleAnalysisRunStatus(selectedAnalysisRunStatus);
  const isAnalyzing =
    visibleAnalysisRunStatus?.status === 'running' ||
    visibleAnalysisRunStatus?.status === 'cancelling';
  const isCancellingAnalysis = visibleAnalysisRunStatus?.status === 'cancelling';
  const canAnalyze =
    state.inspection !== null &&
    state.inspection.initializationState === 'ready' &&
    state.inspection.isWritable &&
    !isAnalyzing;
  const canCancelAnalysis =
    visibleAnalysisRunStatus !== null &&
    (visibleAnalysisRunStatus.status === 'running' ||
      visibleAnalysisRunStatus.status === 'cancelling') &&
    visibleAnalysisRunStatus.stepIndex < visibleAnalysisRunStatus.stepTotal;
  const selectedSpec = resolveSelectedSpec(state.specs, state.selectedSpecId);
  const selectedSession = resolveSelectedSession(
    selectedSpec
      ? state.sessions.filter((session) => session.specId === selectedSpec.meta.id)
      : [],
    state.selectedSessionId,
  );

  return {
    analysisStatus: getAnalysisStatus({
      inspection: state.inspection,
      analysisRunStatus: visibleAnalysisRunStatus,
    }),
    analysisRunStatus: visibleAnalysisRunStatus,
    canAnalyze,
    canCancelAnalysis,
    isCancellingAnalysis,
    isAnalyzing,
    projectEntries: state.recentProjects,
    selectedSession,
    selectedSpec,
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
