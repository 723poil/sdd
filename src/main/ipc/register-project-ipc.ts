import { ipcMain } from 'electron';

import { createActivateProjectUseCase } from '@/application/project/activate-project.use-case';
import { createAnalyzeProjectUseCase } from '@/application/project/analyze-project.use-case';
import { createCancelProjectAnalysisUseCase } from '@/application/project/cancel-project-analysis.use-case';
import { createCreateProjectSessionUseCase } from '@/application/project/create-project-session.use-case';
import { createCreateProjectSpecUseCase } from '@/application/project/create-project-spec.use-case';
import { createInitializeProjectStorageUseCase } from '@/application/project/initialize-project-storage.use-case';
import { createInspectProjectUseCase } from '@/application/project/inspect-project.use-case';
import { createListRecentProjectsUseCase } from '@/application/project/list-recent-projects.use-case';
import { createListProjectSessionsUseCase } from '@/application/project/list-project-sessions.use-case';
import { createReadProjectAnalysisUseCase } from '@/application/project/read-project-analysis.use-case';
import { createReadProjectAnalysisRunStatusUseCase } from '@/application/project/read-project-analysis-run-status.use-case';
import { createReadProjectSessionMessagesUseCase } from '@/application/project/read-project-session-messages.use-case';
import { createReadProjectSpecsUseCase } from '@/application/project/read-project-specs.use-case';
import { createReorderRecentProjectsUseCase } from '@/application/project/reorder-recent-projects.use-case';
import { createSaveProjectAnalysisDocumentLayoutsUseCase } from '@/application/project/save-project-analysis-document-layouts.use-case';
import { createSelectProjectDirectoryUseCase } from '@/application/project/select-project-directory.use-case';
import { createSendProjectSessionMessageUseCase } from '@/application/project/send-project-session-message.use-case';
import { createFsAgentCliSettingsRepository } from '@/infrastructure/app-settings/fs-agent-cli-settings.repository';
import { createFsRecentProjectsRepository } from '@/infrastructure/app-settings/fs-recent-projects.repository';
import { createInMemoryProjectAnalysisRunStatusStore } from '@/infrastructure/analysis/in-memory-project-analysis-run-status.store';
import { createNodeProjectAnalyzerAdapter } from '@/infrastructure/analysis/node-project-analyzer.adapter';
import { createElectronProjectDialogAdapter } from '@/infrastructure/dialog/electron-project-dialog.adapter';
import { createNodeProjectInspectorAdapter } from '@/infrastructure/fs/node-project-inspector.adapter';
import { createFsProjectSessionRepository } from '@/infrastructure/sdd/fs-project-session.repository';
import { createFsProjectStorageRepository } from '@/infrastructure/sdd/fs-project-storage.repository';
import { projectIpcChannels } from '@/shared/ipc/project-ipc';

export function registerProjectIpc(): void {
  const agentCliSettingsStore = createFsAgentCliSettingsRepository();
  const analysisRunStatusStore = createInMemoryProjectAnalysisRunStatusStore();
  const projectDialog = createElectronProjectDialogAdapter();
  const projectAnalyzer = createNodeProjectAnalyzerAdapter({
    agentCliSettingsStore,
    analysisRunStatusStore,
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
  const createProjectSpec = createCreateProjectSpecUseCase({
    projectInspector,
    projectStorage,
  });
  const readProjectSessionMessages = createReadProjectSessionMessagesUseCase({
    projectSessionStore,
  });
  const reorderRecentProjects = createReorderRecentProjectsUseCase({
    recentProjectsStore,
  });
  const sendProjectSessionMessage = createSendProjectSessionMessageUseCase({
    projectInspector,
    projectSessionStore,
    projectStorage,
  });
  const analyzeProject = createAnalyzeProjectUseCase({
    analysisRunStatusStore,
    projectAnalyzer,
    projectInspector,
    projectStorage,
  });

  ipcMain.handle(projectIpcChannels.selectDirectory, async () => {
    return selectProjectDirectory.execute();
  });

  ipcMain.handle(projectIpcChannels.inspect, async (_event, input: { rootPath: string }) => {
    return inspectProject.execute(input);
  });

  ipcMain.handle(projectIpcChannels.readAnalysis, async (_event, input: { rootPath: string }) => {
    return readProjectAnalysis.execute(input);
  });

  ipcMain.handle(
    projectIpcChannels.saveAnalysisDocumentLayouts,
    async (
      _event,
      input: {
        rootPath: string;
        documentLayouts: Record<string, { x: number; y: number }>;
      },
    ) => {
      return saveProjectAnalysisDocumentLayouts.execute(input);
    },
  );

  ipcMain.handle(projectIpcChannels.readSpecs, async (_event, input: { rootPath: string }) => {
    return readProjectSpecs.execute(input);
  });

  ipcMain.handle(
    projectIpcChannels.createSpec,
    async (_event, input: { rootPath: string; title?: string | null }) => {
      return createProjectSpec.execute(input);
    },
  );

  ipcMain.handle(
    projectIpcChannels.readAnalysisRunStatus,
    (_event, input: { rootPath: string }) => {
      return readProjectAnalysisRunStatus.execute(input);
    },
  );

  ipcMain.handle(projectIpcChannels.listSessions, async (_event, input: { rootPath: string }) => {
    return listProjectSessions.execute(input);
  });

  ipcMain.handle(
    projectIpcChannels.createSession,
    async (_event, input: { rootPath: string; specId?: string | null; title?: string }) => {
      return createProjectSession.execute(input);
    },
  );

  ipcMain.handle(
    projectIpcChannels.readSessionMessages,
    async (_event, input: { rootPath: string; sessionId: string }) => {
      return readProjectSessionMessages.execute(input);
    },
  );

  ipcMain.handle(
    projectIpcChannels.sendSessionMessage,
    async (_event, input: { rootPath: string; sessionId: string; text: string }) => {
      return sendProjectSessionMessage.execute(input);
    },
  );

  ipcMain.handle(projectIpcChannels.listRecentProjects, async () => {
    return listRecentProjects.execute();
  });

  ipcMain.handle(projectIpcChannels.activate, async (_event, input: { rootPath: string }) => {
    return activateProject.execute(input);
  });

  ipcMain.handle(
    projectIpcChannels.reorderRecentProjects,
    async (_event, input: { rootPaths: string[] }) => {
      return reorderRecentProjects.execute(input);
    },
  );

  ipcMain.handle(projectIpcChannels.analyze, async (_event, input: { rootPath: string }) => {
    return analyzeProject.execute(input);
  });

  ipcMain.handle(projectIpcChannels.cancelAnalysis, (_event, input: { rootPath: string }) => {
    return cancelProjectAnalysis.execute(input);
  });
}
