import type { ProjectBootstrapWorkbenchState, ProjectBootstrapWorkbenchViewModel } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

import {
  createProjectSessionStateKey,
  getAnalysisStatus,
  getVisibleSessionMessageRunStatus,
  getVisibleAnalysisRunStatus,
  getStorageStatus,
  resolveSelectedSpec,
  resolveSelectedSession,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.utils';
import {
  buildWorkbenchProgressTasks,
  getActiveWorkbenchProgressTask,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/workbench-progress-task.utils';

export function createProjectBootstrapWorkbenchViewModel(
  state: ProjectBootstrapWorkbenchState,
): ProjectBootstrapWorkbenchViewModel {
  const selectedAnalysisRunStatus =
    state.selectedPath !== null
      ? state.analysisRunStatusesByRootPath[state.selectedPath] ?? null
      : null;
  const selectedReferenceTagGenerationStatus =
    state.selectedPath !== null
      ? state.referenceTagGenerationStatusesByRootPath[state.selectedPath] ?? null
      : null;
  const visibleAnalysisRunStatus = getVisibleAnalysisRunStatus(selectedAnalysisRunStatus);
  const progressTasks = buildWorkbenchProgressTasks({
    analysisRunStatusesByRootPath: state.analysisRunStatusesByRootPath,
    inspection: state.inspection,
    recentProjects: state.recentProjects,
    requestProgressTasks: state.requestProgressTasks,
  });
  const activeProgressTask = getActiveWorkbenchProgressTask(
    progressTasks,
    state.selectedProgressTaskId,
  );
  const isAnalyzing =
    visibleAnalysisRunStatus?.status === 'running' ||
    visibleAnalysisRunStatus?.status === 'cancelling';
  const isCancellingAnalysis = visibleAnalysisRunStatus?.status === 'cancelling';
  const isGeneratingReferenceTags =
    selectedReferenceTagGenerationStatus === 'running' ||
    selectedReferenceTagGenerationStatus === 'cancelling';
  const isCancellingReferenceTags = selectedReferenceTagGenerationStatus === 'cancelling';
  const canAnalyzeProject =
    state.inspection !== null &&
    state.inspection.initializationState === 'ready' &&
    state.inspection.isWritable &&
    !isAnalyzing;
  const canAnalyzeReferences = state.inspection !== null && state.inspection.isReadable && !isAnalyzing;
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
  const selectedSessionStateKey =
    state.selectedPath !== null && selectedSession
      ? createProjectSessionStateKey({
          rootPath: state.selectedPath,
          sessionId: selectedSession.id,
        })
      : null;
  const selectedSessionMessageRunStatus =
    selectedSessionStateKey !== null
      ? getVisibleSessionMessageRunStatus(
          state.sessionMessageRunStatusesBySessionKey[selectedSessionStateKey] ?? null,
        )
      : null;
  const isSendingMessage =
    selectedSessionMessageRunStatus?.status === 'running' ||
    selectedSessionMessageRunStatus?.status === 'cancelling';
  const isCancellingMessage = selectedSessionMessageRunStatus?.status === 'cancelling';
  const canCancelMessage =
    selectedSessionMessageRunStatus !== null &&
    (selectedSessionMessageRunStatus.status === 'running' ||
      selectedSessionMessageRunStatus.status === 'cancelling');

  return {
    activeProgressTask,
    analysisStatus: getAnalysisStatus({
      inspection: state.inspection,
      analysisRunStatus: visibleAnalysisRunStatus,
    }),
    analysisRunStatus: visibleAnalysisRunStatus,
    canAnalyzeProject,
    canAnalyzeReferences,
    canCancelAnalysis,
    isCancellingReferenceTags,
    isCancellingAnalysis,
    isCancellingMessage,
    isGeneratingReferenceTags,
    isAnalyzing,
    isSendingMessage,
    canCancelMessage,
    projectEntries: state.recentProjects,
    progressTasks,
    selectedSession,
    selectedSessionMessageRunStatus,
    selectedSpec,
    sessionMessages:
      selectedSessionStateKey !== null
        ? state.sessionMessagesBySessionKey[selectedSessionStateKey] ?? []
        : [],
    draftMessage:
      selectedSessionStateKey !== null
        ? state.draftMessagesBySessionKey[selectedSessionStateKey] ?? ''
        : '',
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
