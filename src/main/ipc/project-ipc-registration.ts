import {
  type IpcMainHandleTarget,
  registerIpcHandle0,
  registerIpcHandle1,
} from '@/shared/ipc/ipc-bridge';
import { projectIpcChannels } from '@/shared/ipc/project-ipc';
import { createActivateProjectUseCase } from '@/application/project/activate-project.use-case';
import { createAnalyzeProjectUseCase } from '@/application/project/analyze-project.use-case';
import { createCancelProjectAnalysisUseCase } from '@/application/project/cancel-project-analysis.use-case';
import { createCancelProjectReferenceTagGenerationUseCase } from '@/application/project/cancel-project-reference-tag-generation.use-case';
import { createCancelProjectSessionMessageUseCase } from '@/application/project/cancel-project-session-message.use-case';
import { createApplyProjectSpecVersionUseCase } from '@/application/project/apply-project-spec-version.use-case';
import { createCreateProjectSessionUseCase } from '@/application/project/create-project-session.use-case';
import { createCreateProjectSpecUseCase } from '@/application/project/create-project-spec.use-case';
import { createDeleteProjectSpecVersionUseCase } from '@/application/project/delete-project-spec-version.use-case';
import { createGenerateProjectReferenceTagsUseCase } from '@/application/project/generate-project-reference-tags.use-case';
import { createInitializeProjectStorageUseCase } from '@/application/project/initialize-project-storage.use-case';
import { createInspectProjectUseCase } from '@/application/project/inspect-project.use-case';
import { createListRecentProjectsUseCase } from '@/application/project/list-recent-projects.use-case';
import { createListProjectSessionsUseCase } from '@/application/project/list-project-sessions.use-case';
import { createReadProjectAnalysisRunStatusUseCase } from '@/application/project/read-project-analysis-run-status.use-case';
import { createReadProjectAnalysisUseCase } from '@/application/project/read-project-analysis.use-case';
import { createReadProjectSessionMessageRunStatusUseCase } from '@/application/project/read-project-session-message-run-status.use-case';
import { createReadProjectSessionMessagesUseCase } from '@/application/project/read-project-session-messages.use-case';
import { createReadProjectSpecsUseCase } from '@/application/project/read-project-specs.use-case';
import { createReadProjectSpecVersionDiffUseCase } from '@/application/project/read-project-spec-version-diff.use-case';
import { createReadProjectSpecVersionHistoryUseCase } from '@/application/project/read-project-spec-version-history.use-case';
import { createReadProjectSpecVersionUseCase } from '@/application/project/read-project-spec-version.use-case';
import { createRemoveRecentProjectUseCase } from '@/application/project/remove-recent-project.use-case';
import { createRenameProjectUseCase } from '@/application/project/rename-project.use-case';
import { createReorderRecentProjectsUseCase } from '@/application/project/reorder-recent-projects.use-case';
import { createSaveProjectAnalysisDocumentLayoutsUseCase } from '@/application/project/save-project-analysis-document-layouts.use-case';
import { createSaveProjectReferenceTagsUseCase } from '@/application/project/save-project-reference-tags.use-case';
import { createSaveProjectSpecUseCase } from '@/application/project/save-project-spec.use-case';
import { createSelectProjectDirectoryUseCase } from '@/application/project/select-project-directory.use-case';
import { createSendProjectSessionMessageUseCase } from '@/application/project/send-project-session-message.use-case';
import { createFsAgentCliSettingsRepository } from '@/infrastructure/app-settings/fs-agent-cli-settings.repository';
import { createInMemoryProjectAnalysisRunStatusStore } from '@/infrastructure/analysis/in-memory-project-analysis-run-status.store';
import { createNodeProjectAnalyzerAdapter } from '@/infrastructure/analysis/node-project-analyzer.adapter';
import { createElectronProjectDialogAdapter } from '@/infrastructure/dialog/electron-project-dialog.adapter';
import { createNodeProjectInspectorAdapter } from '@/infrastructure/fs/node-project-inspector.adapter';
import { createFsRecentProjectsRepository } from '@/infrastructure/app-settings/fs-recent-projects.repository';
import { createFsProjectSessionRepository } from '@/infrastructure/sdd/fs-project-session.repository';
import { createFsProjectStorageRepository } from '@/infrastructure/sdd/fs-project-storage.repository';
import { createNodeProjectReferenceTagGeneratorAdapter } from '@/infrastructure/reference-tags/node-project-reference-tag-generator.adapter';
import { createInMemoryProjectSessionMessageRunStatusStore } from '@/infrastructure/spec-chat/in-memory-project-session-message-run-status.store';
import { createNodeProjectSpecChatAdapter } from '@/infrastructure/spec-chat/node-project-spec-chat.adapter';

type Executable0<Output> = {
  execute(): Promise<Output> | Output;
};

type Executable1<Input, Output> = {
  execute(input: Input): Promise<Output> | Output;
};

type ProjectIpcUseCases = ReturnType<typeof createProjectIpcUseCases>;

function registerZeroInputHandle<Output>(
  target: IpcMainHandleTarget,
  channel: string,
  useCase: Executable0<Output>,
): void {
  registerIpcHandle0(target, channel, () => useCase.execute());
}

function registerInputHandle<Input, Output>(
  target: IpcMainHandleTarget,
  channel: string,
  useCase: Executable1<Input, Output>,
): void {
  registerIpcHandle1(target, channel, (input: Input) => useCase.execute(input));
}

function createProjectIpcUseCases() {
  const agentCliSettingsStore = createFsAgentCliSettingsRepository();
  const analysisRunStatusStore = createInMemoryProjectAnalysisRunStatusStore();
  const sessionMessageRunStatusStore = createInMemoryProjectSessionMessageRunStatusStore();
  const projectDialog = createElectronProjectDialogAdapter();
  const projectAnalyzer = createNodeProjectAnalyzerAdapter({
    agentCliSettingsStore,
    analysisRunStatusStore,
  });
  const projectReferenceTagGenerator = createNodeProjectReferenceTagGeneratorAdapter({
    agentCliSettingsStore,
  });
  const projectSpecChat = createNodeProjectSpecChatAdapter({
    agentCliSettingsStore,
  });
  const projectInspector = createNodeProjectInspectorAdapter();
  const projectSessionStore = createFsProjectSessionRepository();
  const projectStorage = createFsProjectStorageRepository();
  const recentProjectsStore = createFsRecentProjectsRepository();

  const selectProjectDirectory = createSelectProjectDirectoryUseCase({
    projectDialog,
  });
  const inspectProject = createInspectProjectUseCase({
    projectInspector,
    projectStorage,
  });
  const readProjectAnalysis = createReadProjectAnalysisUseCase({
    projectStorage,
  });
  const saveProjectAnalysisDocumentLayouts = createSaveProjectAnalysisDocumentLayoutsUseCase({
    projectInspector,
    projectStorage,
  });
  const saveProjectReferenceTags = createSaveProjectReferenceTagsUseCase({
    projectInspector,
    projectStorage,
  });
  const generateProjectReferenceTags = createGenerateProjectReferenceTagsUseCase({
    projectInspector,
    projectReferenceTagGenerator,
    projectStorage,
  });
  const cancelProjectReferenceTagGeneration = createCancelProjectReferenceTagGenerationUseCase({
    projectReferenceTagGenerator,
  });
  const readProjectSpecs = createReadProjectSpecsUseCase({
    projectStorage,
  });
  const readProjectSpecVersionHistory = createReadProjectSpecVersionHistoryUseCase({
    projectStorage,
  });
  const readProjectSpecVersion = createReadProjectSpecVersionUseCase({
    projectStorage,
  });
  const readProjectSpecVersionDiff = createReadProjectSpecVersionDiffUseCase({
    projectStorage,
  });
  const readProjectAnalysisRunStatus = createReadProjectAnalysisRunStatusUseCase({
    analysisRunStatusStore,
  });
  const cancelProjectAnalysis = createCancelProjectAnalysisUseCase({
    analysisRunStatusStore,
  });
  const listRecentProjects = createListRecentProjectsUseCase({
    recentProjectsStore,
  });
  const listProjectSessions = createListProjectSessionsUseCase({
    projectSessionStore,
  });
  const initializeProjectStorage = createInitializeProjectStorageUseCase({
    projectInspector,
    projectStorage,
  });
  const activateProject = createActivateProjectUseCase({
    inspectProject,
    initializeProjectStorage,
    recentProjectsStore,
  });
  const createProjectSession = createCreateProjectSessionUseCase({
    projectInspector,
    projectSessionStore,
    projectStorage,
  });
  const renameProject = createRenameProjectUseCase({
    inspectProject,
    projectStorage,
    recentProjectsStore,
  });
  const createProjectSpec = createCreateProjectSpecUseCase({
    projectInspector,
    projectStorage,
  });
  const saveProjectSpec = createSaveProjectSpecUseCase({
    projectInspector,
    projectStorage,
  });
  const applyProjectSpecVersion = createApplyProjectSpecVersionUseCase({
    projectInspector,
    projectStorage,
  });
  const deleteProjectSpecVersion = createDeleteProjectSpecVersionUseCase({
    projectInspector,
    projectStorage,
  });
  const readProjectSessionMessages = createReadProjectSessionMessagesUseCase({
    projectSessionStore,
  });
  const readProjectSessionMessageRunStatus = createReadProjectSessionMessageRunStatusUseCase({
    sessionMessageRunStatusStore,
  });
  const cancelProjectSessionMessage = createCancelProjectSessionMessageUseCase({
    sessionMessageRunStatusStore,
  });
  const reorderRecentProjects = createReorderRecentProjectsUseCase({
    recentProjectsStore,
  });
  const removeRecentProject = createRemoveRecentProjectUseCase({
    recentProjectsStore,
  });
  const sendProjectSessionMessage = createSendProjectSessionMessageUseCase({
    projectInspector,
    projectSpecChat,
    projectSessionStore,
    sessionMessageRunStatusStore,
    projectStorage,
  });
  const analyzeProject = createAnalyzeProjectUseCase({
    analysisRunStatusStore,
    projectAnalyzer,
    projectInspector,
    projectStorage,
  });

  return {
    activateProject,
    analyzeProject,
    cancelProjectAnalysis,
    cancelProjectReferenceTagGeneration,
    createProjectSession,
    createProjectSpec,
    deleteProjectSpecVersion,
    generateProjectReferenceTags,
    inspectProject,
    listProjectSessions,
    listRecentProjects,
    readProjectAnalysis,
    readProjectAnalysisRunStatus,
    readProjectSpecVersion,
    readProjectSpecVersionDiff,
    readProjectSpecVersionHistory,
    readProjectSessionMessages,
    readProjectSessionMessageRunStatus,
    readProjectSpecs,
    removeRecentProject,
    renameProject,
    reorderRecentProjects,
    applyProjectSpecVersion,
    saveProjectAnalysisDocumentLayouts,
    saveProjectReferenceTags,
    saveProjectSpec,
    cancelProjectSessionMessage,
    selectProjectDirectory,
    sendProjectSessionMessage,
  };
}

function registerProjectAnalysisIpc(
  target: IpcMainHandleTarget,
  useCases: ProjectIpcUseCases,
): void {
  registerZeroInputHandle(
    target,
    projectIpcChannels.selectDirectory,
    useCases.selectProjectDirectory,
  );
  registerInputHandle(target, projectIpcChannels.inspect, useCases.inspectProject);
  registerInputHandle(target, projectIpcChannels.renameProject, useCases.renameProject);
  registerInputHandle(target, projectIpcChannels.readAnalysis, useCases.readProjectAnalysis);
  registerInputHandle(
    target,
    projectIpcChannels.saveAnalysisDocumentLayouts,
    useCases.saveProjectAnalysisDocumentLayouts,
  );
  registerInputHandle(
    target,
    projectIpcChannels.saveReferenceTags,
    useCases.saveProjectReferenceTags,
  );
  registerInputHandle(
    target,
    projectIpcChannels.generateReferenceTags,
    useCases.generateProjectReferenceTags,
  );
  registerInputHandle(
    target,
    projectIpcChannels.cancelReferenceTagGeneration,
    useCases.cancelProjectReferenceTagGeneration,
  );
}

function registerProjectSpecIpc(target: IpcMainHandleTarget, useCases: ProjectIpcUseCases): void {
  registerInputHandle(target, projectIpcChannels.readSpecs, useCases.readProjectSpecs);
  registerInputHandle(target, projectIpcChannels.createSpec, useCases.createProjectSpec);
  registerInputHandle(target, projectIpcChannels.saveSpec, useCases.saveProjectSpec);
  registerInputHandle(
    target,
    projectIpcChannels.readSpecVersionHistory,
    useCases.readProjectSpecVersionHistory,
  );
  registerInputHandle(target, projectIpcChannels.readSpecVersion, useCases.readProjectSpecVersion);
  registerInputHandle(
    target,
    projectIpcChannels.readSpecVersionDiff,
    useCases.readProjectSpecVersionDiff,
  );
  registerInputHandle(target, projectIpcChannels.applySpecVersion, useCases.applyProjectSpecVersion);
  registerInputHandle(
    target,
    projectIpcChannels.deleteSpecVersion,
    useCases.deleteProjectSpecVersion,
  );
  registerInputHandle(
    target,
    projectIpcChannels.readAnalysisRunStatus,
    useCases.readProjectAnalysisRunStatus,
  );
}

function registerProjectSessionIpc(
  target: IpcMainHandleTarget,
  useCases: ProjectIpcUseCases,
): void {
  registerInputHandle(target, projectIpcChannels.listSessions, useCases.listProjectSessions);
  registerInputHandle(target, projectIpcChannels.createSession, useCases.createProjectSession);
  registerInputHandle(
    target,
    projectIpcChannels.readSessionMessages,
    useCases.readProjectSessionMessages,
  );
  registerInputHandle(
    target,
    projectIpcChannels.readSessionMessageRunStatus,
    useCases.readProjectSessionMessageRunStatus,
  );
  registerInputHandle(
    target,
    projectIpcChannels.sendSessionMessage,
    useCases.sendProjectSessionMessage,
  );
  registerInputHandle(
    target,
    projectIpcChannels.cancelSessionMessage,
    useCases.cancelProjectSessionMessage,
  );
}

function registerRecentProjectIpc(target: IpcMainHandleTarget, useCases: ProjectIpcUseCases): void {
  registerZeroInputHandle(
    target,
    projectIpcChannels.listRecentProjects,
    useCases.listRecentProjects,
  );
  registerInputHandle(target, projectIpcChannels.removeRecentProject, useCases.removeRecentProject);
  registerInputHandle(target, projectIpcChannels.activate, useCases.activateProject);
  registerInputHandle(
    target,
    projectIpcChannels.reorderRecentProjects,
    useCases.reorderRecentProjects,
  );
}

function registerProjectExecutionIpc(
  target: IpcMainHandleTarget,
  useCases: ProjectIpcUseCases,
): void {
  registerInputHandle(target, projectIpcChannels.analyze, useCases.analyzeProject);
  registerInputHandle(target, projectIpcChannels.cancelAnalysis, useCases.cancelProjectAnalysis);
}

export function registerProjectIpcHandlers(target: IpcMainHandleTarget): void {
  const useCases = createProjectIpcUseCases();

  registerProjectAnalysisIpc(target, useCases);
  registerProjectSpecIpc(target, useCases);
  registerProjectSessionIpc(target, useCases);
  registerRecentProjectIpc(target, useCases);
  registerProjectExecutionIpc(target, useCases);
}
