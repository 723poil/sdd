import type { ProjectAnalysisDocumentId } from '@/domain/project/project-analysis-model';
import type { AppView } from '@/renderer/app-view';
import type { WorkbenchProgressTask } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

import { WorkbenchSidebarResizeHandle } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/WorkbenchSidebarResizeHandle';
import { BottomStatusBar } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/BottomStatusBar';
import { InfoSidebar } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/InfoSidebar';
import { MainWorkspace } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/MainWorkspace';
import { ProjectSidebar } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/ProjectSidebar';
import { useProjectBootstrapWorkbench } from '@/renderer/features/project-bootstrap/project-bootstrap-page/use-project-bootstrap-workbench';
import { useWorkbenchSidebarResize } from '@/renderer/features/project-bootstrap/project-bootstrap-page/use-workbench-sidebar-resize';

interface ProjectBootstrapPageProps {
  activeAppView: AppView;
  onSelectAppView: (view: AppView) => void;
}

export function ProjectBootstrapPage(props: ProjectBootstrapPageProps) {
  const workbench = useProjectBootstrapWorkbench();
  const sidebarResize = useWorkbenchSidebarResize();
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
  const handleBeginRenameProject = (rootPath: string) => {
    workbench.onBeginRenameProject(rootPath);
  };
  const handleCancelRenameProject = () => {
    workbench.onCancelRenameProject();
  };
  const handleChangeEditingProjectName = (value: string) => {
    workbench.onChangeEditingProjectName(value);
  };
  const handleCommitRenameProject = (rootPath: string) => {
    workbench.onCommitRenameProject(rootPath);
  };
  const handleRemoveProject = (rootPath: string) => {
    workbench.onRemoveProject(rootPath);
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
  const handleCancelReferenceTagGeneration = () => {
    workbench.onCancelReferenceTagGeneration();
  };
  const handleCancelSessionMessage = () => {
    workbench.onCancelSessionMessage();
  };
  const handleCancelBottomStatusTask = (task: WorkbenchProgressTask) => {
    if (task.kind === 'analysis') {
      workbench.onCancelAnalysis(task.rootPath ?? undefined);
      return;
    }

    if (task.kind === 'reference-tags-generate') {
      workbench.onCancelReferenceTagGeneration(task.rootPath ?? undefined);
      return;
    }

    if (task.kind === 'message-send') {
      workbench.onCancelSessionMessage(task.rootPath ?? undefined, task.sessionId ?? undefined);
    }
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
  const handleSaveSpec = (input: Parameters<typeof workbench.onSaveSpec>[0]) => {
    return workbench.onSaveSpec(input);
  };
  const handleSaveReferenceTags = (
    referenceTags: Parameters<typeof workbench.onSaveReferenceTags>[0],
  ) => {
    return workbench.onSaveReferenceTags(referenceTags);
  };
  const handleSelectBottomStatusTask = (task: WorkbenchProgressTask) => {
    workbench.onSelectProgressTask(task.id);
  };
  const handleGenerateReferenceTags = () => {
    return workbench.onGenerateReferenceTags();
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
        <main
          className={workbench.workbenchClassName}
          ref={sidebarResize.workbenchRef}
          style={sidebarResize.workbenchStyle}
        >
          {workbench.isLeftSidebarOpen ? (
            <ProjectSidebar
              editingProjectNameDraft={workbench.editingProjectNameDraft}
              editingProjectRootPath={workbench.editingProjectRootPath}
              draggingProjectRootPath={workbench.draggingProjectRootPath}
              dropTargetRootPath={workbench.dropTargetRootPath}
              onActivateProject={handleActivateProject}
              onBeginRenameProject={handleBeginRenameProject}
              onCancelRenameProject={handleCancelRenameProject}
              onChangeEditingProjectName={handleChangeEditingProjectName}
              onCommitRenameProject={handleCommitRenameProject}
              onRemoveProject={handleRemoveProject}
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

          {workbench.isLeftSidebarOpen ? (
            <WorkbenchSidebarResizeHandle
              isActive={sidebarResize.activeResizeSide === 'left'}
              onAdjustByKeyboard={(delta) => {
                sidebarResize.nudgeSidebarWidth('left', delta);
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) {
                  return;
                }

                event.preventDefault();
                sidebarResize.startResize('left', event.clientX);
              }}
              side="left"
            />
          ) : null}

          <MainWorkspace
            activeWorkspacePage={workbench.activeWorkspacePage}
            analysis={workbench.analysis}
            analysisSessionKey={workbench.selectedPath ?? 'no-project'}
            canManageReferenceTags={
              workbench.inspection?.initializationState === 'ready' &&
              workbench.inspection.isWritable
            }
            errorMessage={workbench.errorMessage}
            isCancellingReferenceTags={workbench.isCancellingReferenceTags}
            isGeneratingReferenceTags={workbench.isGeneratingReferenceTags}
            isSavingReferenceTags={workbench.isSavingReferenceTags}
            isSavingSpec={workbench.isSavingSpec}
            onCancelReferenceTagGeneration={handleCancelReferenceTagGeneration}
            onGenerateReferenceTags={handleGenerateReferenceTags}
            onSaveAnalysisDocumentLayouts={handleSaveAnalysisDocumentLayouts}
            onSaveSpec={handleSaveSpec}
            onSaveReferenceTags={handleSaveReferenceTags}
            onSelectAnalysisDocument={handleSelectAnalysisDocument}
            onSelectSpec={handleSelectSpec}
            onSelectWorkspacePage={handleSelectWorkspacePage}
            selectedAnalysisDocumentId={workbench.selectedAnalysisDocumentId}
            selectedSpecId={workbench.selectedSpecId}
            specs={workbench.specs}
          />

          {workbench.isRightSidebarOpen ? (
            <WorkbenchSidebarResizeHandle
              isActive={sidebarResize.activeResizeSide === 'right'}
              onAdjustByKeyboard={(delta) => {
                sidebarResize.nudgeSidebarWidth('right', delta);
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) {
                  return;
                }

                event.preventDefault();
                sidebarResize.startResize('right', event.clientX);
              }}
              side="right"
            />
          ) : null}

          {workbench.isRightSidebarOpen ? (
            <InfoSidebar
              activeWorkspacePage={workbench.activeWorkspacePage}
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
              canCancelMessage={workbench.canCancelMessage}
              isCancellingMessage={workbench.isCancellingMessage}
              isSendingMessage={workbench.isSendingMessage}
              onAnalyzeProject={handleAnalyzeProject}
              onAnalyzeReferences={handleAnalyzeReferences}
              onCancelAnalysis={handleCancelAnalysis}
              onCancelMessage={handleCancelSessionMessage}
              onChangeChatModel={handleChangeChatModel}
              onChangeChatReasoningEffort={handleChangeChatReasoningEffort}
              onChangeDraftMessage={handleChangeDraftMessage}
              onCreateSpec={handleCreateSpec}
              onSendMessage={handleSendMessage}
              onToggleSidebar={handleToggleRightSidebar}
              selectedSpec={workbench.selectedSpec}
              selectedSession={workbench.selectedSession}
              sessionMessageRunStatus={workbench.selectedSessionMessageRunStatus}
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
          activeProgressTask={workbench.activeProgressTask}
          activeWorkspacePage={workbench.activeWorkspacePage}
          errorMessage={workbench.errorMessage}
          inspection={workbench.inspection}
          message={workbench.message}
          onCancelTask={handleCancelBottomStatusTask}
          onSelectAppView={props.onSelectAppView}
          onSelectTask={handleSelectBottomStatusTask}
          progressTasks={workbench.progressTasks}
          storageStatus={workbench.storageStatus}
        />
      </div>
    </div>
  );
}
