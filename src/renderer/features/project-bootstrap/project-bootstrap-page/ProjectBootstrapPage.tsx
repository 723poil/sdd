import { InfoSidebar } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/InfoSidebar';
import { MainWorkspace } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/MainWorkspace';
import { ProjectSidebar } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/ProjectSidebar';
import { useProjectBootstrapWorkbench } from '@/renderer/features/project-bootstrap/project-bootstrap-page/use-project-bootstrap-workbench';

export function ProjectBootstrapPage() {
  const workbench = useProjectBootstrapWorkbench();
  const handleActivateProject = (rootPath: string) => {
    void workbench.onActivateProject(rootPath);
  };
  const handleChangeDraftMessage = (value: string) => {
    workbench.onChangeDraftMessage(value);
  };
  const handleCreateSession = () => {
    workbench.onCreateSession();
  };
  const handleDragOverProject = (rootPath: string) => {
    workbench.onDragOverProject(rootPath);
  };
  const handleDropProject = (rootPath: string) => {
    workbench.onDropProject(rootPath);
  };
  const handleEndDraggingProject = () => {
    workbench.onEndDraggingProject();
  };
  const handleStartDraggingProject = (rootPath: string) => {
    workbench.onStartDraggingProject(rootPath);
  };
  const handleAnalyzeProject = () => {
    workbench.onAnalyzeProject();
  };
  const handleSendMessage = () => {
    workbench.onSendMessage();
  };
  const handleSelectProject = () => {
    workbench.onSelectProject();
  };
  const handleSelectSession = (sessionId: string) => {
    workbench.onSelectSession(sessionId);
  };
  const handleToggleLeftSidebar = () => {
    workbench.onToggleLeftSidebar();
  };
  const handleToggleRightSidebar = () => {
    workbench.onToggleRightSidebar();
  };
  const handleToggleProjectExpansion = (rootPath: string) => {
    workbench.onToggleProjectExpansion(rootPath);
  };

  return (
    <main className={workbench.workbenchClassName}>
      {workbench.isLeftSidebarOpen ? (
        <ProjectSidebar
          expandedProjectRootPaths={workbench.expandedProjectRootPaths}
          draggingProjectRootPath={workbench.draggingProjectRootPath}
          dropTargetRootPath={workbench.dropTargetRootPath}
          inspection={workbench.inspection}
          onActivateProject={handleActivateProject}
          onCreateSession={handleCreateSession}
          onToggleSidebar={handleToggleLeftSidebar}
          onDragOverProject={handleDragOverProject}
          onDropProject={handleDropProject}
          onEndDraggingProject={handleEndDraggingProject}
          onSelectSession={handleSelectSession}
          onStartDraggingProject={handleStartDraggingProject}
          onToggleProjectExpansion={handleToggleProjectExpansion}
          projectEntries={workbench.projectEntries}
          selectedPath={workbench.selectedPath}
          selectedSessionId={workbench.selectedSession?.id ?? null}
          sessions={workbench.sessions}
          isCreatingSession={workbench.isCreatingSession}
        />
      ) : (
        <button
          aria-label="왼쪽 프로젝트 패널 열기"
          className="sidebar-peek-button sidebar-peek-button--left"
          onClick={handleToggleLeftSidebar}
          type="button"
        >
          <span aria-hidden="true">›</span>
        </button>
      )}

      <MainWorkspace
        analysisStatus={workbench.analysisStatus}
        canAnalyze={workbench.canAnalyze}
        draftMessage={workbench.draftMessage}
        errorMessage={workbench.errorMessage}
        inspection={workbench.inspection}
        isAnalyzing={workbench.isAnalyzing}
        isCreatingSession={workbench.isCreatingSession}
        isSelecting={workbench.isSelecting}
        isSendingMessage={workbench.isSendingMessage}
        message={workbench.message}
        onAnalyzeProject={handleAnalyzeProject}
        onChangeDraftMessage={handleChangeDraftMessage}
        onCreateSession={handleCreateSession}
        onSelectProject={handleSelectProject}
        onSendMessage={handleSendMessage}
        selectedSession={workbench.selectedSession}
        sessionCount={workbench.sessions.length}
        sessionMessages={workbench.sessionMessages}
        storageStatus={workbench.storageStatus}
      />

      {workbench.isRightSidebarOpen ? (
        <InfoSidebar
          analysis={workbench.analysis}
          inspection={workbench.inspection}
          onToggleSidebar={handleToggleRightSidebar}
          sessions={workbench.sessions}
        />
      ) : (
        <button
          aria-label="오른쪽 요약 패널 열기"
          className="sidebar-peek-button sidebar-peek-button--right"
          onClick={handleToggleRightSidebar}
          type="button"
        >
          <span aria-hidden="true">‹</span>
        </button>
      )}
    </main>
  );
}
