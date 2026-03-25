import { ipcMain } from 'electron';

import { createActivateProjectUseCase } from '@/application/project/activate-project.use-case';
import { createAnalyzeProjectUseCase } from '@/application/project/analyze-project.use-case';
import { createCancelProjectAnalysisUseCase } from '@/application/project/cancel-project-analysis.use-case';
import { createCancelProjectReferenceTagGenerationUseCase } from '@/application/project/cancel-project-reference-tag-generation.use-case';
import { createCreateProjectSessionUseCase } from '@/application/project/create-project-session.use-case';
import { createCreateProjectSpecUseCase } from '@/application/project/create-project-spec.use-case';
import { createGenerateProjectReferenceTagsUseCase } from '@/application/project/generate-project-reference-tags.use-case';
import { createInitializeProjectStorageUseCase } from '@/application/project/initialize-project-storage.use-case';
import { createInspectProjectUseCase } from '@/application/project/inspect-project.use-case';
import { createListRecentProjectsUseCase } from '@/application/project/list-recent-projects.use-case';
import { createListProjectSessionsUseCase } from '@/application/project/list-project-sessions.use-case';
import { createReadProjectAnalysisUseCase } from '@/application/project/read-project-analysis.use-case';
import { createReadProjectAnalysisRunStatusUseCase } from '@/application/project/read-project-analysis-run-status.use-case';
import { createReadProjectSessionMessagesUseCase } from '@/application/project/read-project-session-messages.use-case';
import { createReadProjectSpecsUseCase } from '@/application/project/read-project-specs.use-case';
import { createRemoveRecentProjectUseCase } from '@/application/project/remove-recent-project.use-case';
import { createRenameProjectUseCase } from '@/application/project/rename-project.use-case';
import { createReorderRecentProjectsUseCase } from '@/application/project/reorder-recent-projects.use-case';
import { createSaveProjectAnalysisDocumentLayoutsUseCase } from '@/application/project/save-project-analysis-document-layouts.use-case';
import { createSaveProjectSpecUseCase } from '@/application/project/save-project-spec.use-case';
import { createSaveProjectReferenceTagsUseCase } from '@/application/project/save-project-reference-tags.use-case';
import { createSelectProjectDirectoryUseCase } from '@/application/project/select-project-directory.use-case';
import { createSendProjectSessionMessageUseCase } from '@/application/project/send-project-session-message.use-case';
import { createFsAgentCliSettingsRepository } from '@/infrastructure/app-settings/fs-agent-cli-settings.repository';
import { createFsRecentProjectsRepository } from '@/infrastructure/app-settings/fs-recent-projects.repository';
import { createInMemoryProjectAnalysisRunStatusStore } from '@/infrastructure/analysis/in-memory-project-analysis-run-status.store';
import { createNodeProjectAnalyzerAdapter } from '@/infrastructure/analysis/node-project-analyzer.adapter';
import { createElectronProjectDialogAdapter } from '@/infrastructure/dialog/electron-project-dialog.adapter';
import { createNodeProjectInspectorAdapter } from '@/infrastructure/fs/node-project-inspector.adapter';
import { createNodeProjectReferenceTagGeneratorAdapter } from '@/infrastructure/reference-tags/node-project-reference-tag-generator.adapter';
import { createFsProjectSessionRepository } from '@/infrastructure/sdd/fs-project-session.repository';
import { createFsProjectStorageRepository } from '@/infrastructure/sdd/fs-project-storage.repository';
import { createNodeProjectSpecChatAdapter } from '@/infrastructure/spec-chat/node-project-spec-chat.adapter';
import { registerIpcHandle0, registerIpcHandle1 } from '@/shared/ipc/ipc-bridge';
import {
  type ActivateProjectInput,
  type AnalyzeProjectInput,
  type CancelProjectAnalysisInput,
  type CancelProjectReferenceTagGenerationInput,
  type CreateProjectSessionInput,
  type CreateProjectSpecInput,
  type GenerateProjectReferenceTagsInput,
  type InspectProjectInput,
  type ListProjectSessionsInput,
  type RemoveRecentProjectInput,
  type ReadProjectAnalysisInput,
  type ReadProjectAnalysisRunStatusInput,
  type ReadProjectSessionMessagesInput,
  type ReadProjectSpecsInput,
  type RenameProjectInput,
  type ReorderRecentProjectsInput,
  type SaveProjectSpecInput,
  type SaveProjectAnalysisDocumentLayoutsInput,
  type SaveProjectReferenceTagsInput,
  type SendProjectSessionMessageInput,
  projectIpcChannels,
} from '@/shared/ipc/project-ipc';

export function registerProjectIpc(): void {
  const agentCliSettingsStore = createFsAgentCliSettingsRepository();
  const analysisRunStatusStore = createInMemoryProjectAnalysisRunStatusStore();
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
  const readProjectSessionMessages = createReadProjectSessionMessagesUseCase({
    projectSessionStore,
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
    projectStorage,
  });
  const analyzeProject = createAnalyzeProjectUseCase({
    analysisRunStatusStore,
    projectAnalyzer,
    projectInspector,
    projectStorage,
  });

  registerIpcHandle0(ipcMain, projectIpcChannels.selectDirectory, () =>
    selectProjectDirectory.execute(),
  );
  registerIpcHandle1(ipcMain, projectIpcChannels.inspect, (input: InspectProjectInput) =>
    inspectProject.execute(input),
  );
  registerIpcHandle1(ipcMain, projectIpcChannels.renameProject, (input: RenameProjectInput) =>
    renameProject.execute(input),
  );
  registerIpcHandle1(ipcMain, projectIpcChannels.readAnalysis, (input: ReadProjectAnalysisInput) =>
    readProjectAnalysis.execute(input),
  );
  registerIpcHandle1(
    ipcMain,
    projectIpcChannels.saveAnalysisDocumentLayouts,
    (input: SaveProjectAnalysisDocumentLayoutsInput) =>
      saveProjectAnalysisDocumentLayouts.execute(input),
  );
  registerIpcHandle1(
    ipcMain,
    projectIpcChannels.saveReferenceTags,
    (input: SaveProjectReferenceTagsInput) => saveProjectReferenceTags.execute(input),
  );
  registerIpcHandle1(
    ipcMain,
    projectIpcChannels.generateReferenceTags,
    (input: GenerateProjectReferenceTagsInput) => generateProjectReferenceTags.execute(input),
  );
  registerIpcHandle1(
    ipcMain,
    projectIpcChannels.cancelReferenceTagGeneration,
    (input: CancelProjectReferenceTagGenerationInput) =>
      cancelProjectReferenceTagGeneration.execute(input),
  );
  registerIpcHandle1(ipcMain, projectIpcChannels.readSpecs, (input: ReadProjectSpecsInput) =>
    readProjectSpecs.execute(input),
  );
  registerIpcHandle1(ipcMain, projectIpcChannels.createSpec, (input: CreateProjectSpecInput) =>
    createProjectSpec.execute(input),
  );
  registerIpcHandle1(ipcMain, projectIpcChannels.saveSpec, (input: SaveProjectSpecInput) =>
    saveProjectSpec.execute(input),
  );
  registerIpcHandle1(
    ipcMain,
    projectIpcChannels.readAnalysisRunStatus,
    (input: ReadProjectAnalysisRunStatusInput) => readProjectAnalysisRunStatus.execute(input),
  );
  registerIpcHandle1(ipcMain, projectIpcChannels.listSessions, (input: ListProjectSessionsInput) =>
    listProjectSessions.execute(input),
  );
  registerIpcHandle1(
    ipcMain,
    projectIpcChannels.createSession,
    (input: CreateProjectSessionInput) => createProjectSession.execute(input),
  );
  registerIpcHandle1(
    ipcMain,
    projectIpcChannels.readSessionMessages,
    (input: ReadProjectSessionMessagesInput) => readProjectSessionMessages.execute(input),
  );
  registerIpcHandle1(
    ipcMain,
    projectIpcChannels.sendSessionMessage,
    (input: SendProjectSessionMessageInput) => sendProjectSessionMessage.execute(input),
  );
  registerIpcHandle0(ipcMain, projectIpcChannels.listRecentProjects, () =>
    listRecentProjects.execute(),
  );
  registerIpcHandle1(
    ipcMain,
    projectIpcChannels.removeRecentProject,
    (input: RemoveRecentProjectInput) => removeRecentProject.execute(input),
  );
  registerIpcHandle1(ipcMain, projectIpcChannels.activate, (input: ActivateProjectInput) =>
    activateProject.execute(input),
  );
  registerIpcHandle1(
    ipcMain,
    projectIpcChannels.reorderRecentProjects,
    (input: ReorderRecentProjectsInput) => reorderRecentProjects.execute(input),
  );
  registerIpcHandle1(ipcMain, projectIpcChannels.analyze, (input: AnalyzeProjectInput) =>
    analyzeProject.execute(input),
  );
  registerIpcHandle1(
    ipcMain,
    projectIpcChannels.cancelAnalysis,
    (input: CancelProjectAnalysisInput) => cancelProjectAnalysis.execute(input),
  );
}
