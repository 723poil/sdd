import type { ProjectAnalysisDocumentId } from '@/domain/project/project-analysis-model';
import type { AppView } from '@/renderer/app-view';

import { BottomStatusBar } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/BottomStatusBar';
import { InfoSidebar } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/InfoSidebar';
import { MainWorkspace } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/MainWorkspace';
import { ProjectSidebar } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/ProjectSidebar';
import { useProjectBootstrapWorkbench } from '@/renderer/features/project-bootstrap/project-bootstrap-page/use-project-bootstrap-workbench';

interface ProjectBootstrapPageProps {
  activeAppView: AppView;
  onSelectAppView: (view: AppView) => void;
}

export function ProjectBootstrapPage(props: ProjectBootstrapPageProps) {
  const workbench = useProjectBootstrapWorkbench();
  const handleActivateProject = (rootPath: string) => {
    void workbench.onActivateProject(rootPath);
  };
  const handleChangeDraftMessage = (value: string) => {
    workbench.onChangeDraftMessage(value);
  };
  const handleCreateSpec = () => {
    workbench.onCreateSpec();
  };
  const handleDragOverProject = (rootPath: string) => {
    workbench.onDragOverProject(rootPath);
  };
  const handleDropProject = (rootPath: string) => {
    workbench.onDropProject(rootPath);
  };
  const handleChangeChatModel = (model: string) => {
    workbench.onChangeChatModel(model);
  };
  const handleChangeChatReasoningEffort = (
    modelReasoningEffort: Parameters<typeof workbench.onChangeChatReasoningEffort>[0],
  ) => {
    workbench.onChangeChatReasoningEffort(modelReasoningEffort);
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
  const handleAnalyzeReferences = () => {
    workbench.onAnalyzeReferences();
  };
  const handleCancelAnalysis = () => {
    workbench.onCancelAnalysis();
  };
  const handleSendMessage = () => {
    workbench.onSendMessage();
  };
  const handleSelectProject = () => {
    workbench.onSelectProject();
  };
  const handleSelectAnalysisDocument = (documentId: ProjectAnalysisDocumentId) => {
    workbench.onSelectAnalysisDocument(documentId);
  };
  const handleSaveAnalysisDocumentLayouts = (
    documentLayouts: Parameters<typeof workbench.onSaveAnalysisDocumentLayouts>[0],
  ) => {
    workbench.onSaveAnalysisDocumentLayouts(documentLayouts);
  };
  const handleSelectSpec = (specId: string) => {
    workbench.onSelectSpec(specId);
  };
  const handleSelectWorkspacePage = (
    page: Parameters<typeof workbench.onSelectWorkspacePage>[0],
  ) => {
    workbench.onSelectWorkspacePage(page);
  };
  const handleToggleLeftSidebar = () => {
    workbench.onToggleLeftSidebar();
  };
  const handleToggleRightSidebar = () => {
    workbench.onToggleRightSidebar();
  };

  return (
    <div className="workbench-shell">
      <div className="workbench-shell__body">
        <main className={workbench.workbenchClassName}>
          {workbench.isLeftSidebarOpen ? (
            <ProjectSidebar
              draggingProjectRootPath={workbench.draggingProjectRootPath}
              dropTargetRootPath={workbench.dropTargetRootPath}
              onActivateProject={handleActivateProject}
              onSelectProject={handleSelectProject}
              onToggleSidebar={handleToggleLeftSidebar}
              onDragOverProject={handleDragOverProject}
              onDropProject={handleDropProject}
              onEndDraggingProject={handleEndDraggingProject}
              onStartDraggingProject={handleStartDraggingProject}
              projectEntries={workbench.projectEntries}
              isSelecting={workbench.isSelecting}
              selectedPath={workbench.selectedPath}
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
            activeWorkspacePage={workbench.activeWorkspacePage}
            analysis={workbench.analysis}
            analysisSessionKey={workbench.selectedPath ?? 'no-project'}
            errorMessage={workbench.errorMessage}
            onSaveAnalysisDocumentLayouts={handleSaveAnalysisDocumentLayouts}
            onSelectAnalysisDocument={handleSelectAnalysisDocument}
            onSelectSpec={handleSelectSpec}
            onSelectWorkspacePage={handleSelectWorkspacePage}
            selectedAnalysisDocumentId={workbench.selectedAnalysisDocumentId}
            selectedSpecId={workbench.selectedSpecId}
            specs={workbench.specs}
          />

          {workbench.isRightSidebarOpen ? (
            <InfoSidebar
              activeWorkspacePage={workbench.activeWorkspacePage}
              analysis={workbench.analysis}
              canAnalyzeProject={workbench.canAnalyzeProject}
              canAnalyzeReferences={workbench.canAnalyzeReferences}
              canCancelAnalysis={workbench.canCancelAnalysis}
              canCreateSpec={
                workbench.inspection?.initializationState === 'ready' &&
                workbench.inspection.isWritable
              }
              chatModel={workbench.chatModel}
              chatReasoningEffort={workbench.chatReasoningEffort}
              draftMessage={workbench.draftMessage}
              inspection={workbench.inspection}
              isAnalyzing={workbench.isAnalyzing}
              isCancellingAnalysis={workbench.isCancellingAnalysis}
              isCreatingSpec={workbench.isCreatingSpec}
              isCreatingSession={workbench.isCreatingSession}
              isSavingChatRuntimeSettings={workbench.isSavingChatRuntimeSettings}
              isSendingMessage={workbench.isSendingMessage}
              onAnalyzeProject={handleAnalyzeProject}
              onAnalyzeReferences={handleAnalyzeReferences}
              onCancelAnalysis={handleCancelAnalysis}
              onChangeChatModel={handleChangeChatModel}
              onChangeChatReasoningEffort={handleChangeChatReasoningEffort}
              onChangeDraftMessage={handleChangeDraftMessage}
              onCreateSpec={handleCreateSpec}
              onSendMessage={handleSendMessage}
              onToggleSidebar={handleToggleRightSidebar}
              selectedAnalysisDocumentId={workbench.selectedAnalysisDocumentId}
              selectedSpec={workbench.selectedSpec}
              selectedSession={workbench.selectedSession}
              sessionMessages={workbench.sessionMessages}
            />
          ) : (
            <button
              aria-label="오른쪽 채팅 패널 열기"
              className="sidebar-peek-button sidebar-peek-button--right"
              onClick={handleToggleRightSidebar}
              type="button"
            >
              <span aria-hidden="true">‹</span>
            </button>
          )}
        </main>

        <BottomStatusBar
          activeAppView={props.activeAppView}
          activeWorkspacePage={workbench.activeWorkspacePage}
          analysisRunStatus={workbench.analysisRunStatus}
          analysisStatus={workbench.analysisStatus}
          errorMessage={workbench.errorMessage}
          inspection={workbench.inspection}
          message={workbench.message}
          onCancelAnalysis={handleCancelAnalysis}
          onSelectAppView={props.onSelectAppView}
          storageStatus={workbench.storageStatus}
        />
      </div>
    </div>
  );
}
