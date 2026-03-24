import { ipcMain } from 'electron';

import { createActivateProjectUseCase } from '@/application/project/activate-project.use-case';
import { createAnalyzeProjectUseCase } from '@/application/project/analyze-project.use-case';
import { createCreateProjectSessionUseCase } from '@/application/project/create-project-session.use-case';
import { createInitializeProjectStorageUseCase } from '@/application/project/initialize-project-storage.use-case';
import { createInspectProjectUseCase } from '@/application/project/inspect-project.use-case';
import { createListRecentProjectsUseCase } from '@/application/project/list-recent-projects.use-case';
import { createListProjectSessionsUseCase } from '@/application/project/list-project-sessions.use-case';
import { createReadProjectAnalysisUseCase } from '@/application/project/read-project-analysis.use-case';
import { createReadProjectSessionMessagesUseCase } from '@/application/project/read-project-session-messages.use-case';
import { createReorderRecentProjectsUseCase } from '@/application/project/reorder-recent-projects.use-case';
import { createSelectProjectDirectoryUseCase } from '@/application/project/select-project-directory.use-case';
import { createSendProjectSessionMessageUseCase } from '@/application/project/send-project-session-message.use-case';
import { createFsRecentProjectsRepository } from '@/infrastructure/app-settings/fs-recent-projects.repository';
import { createNodeProjectAnalyzerAdapter } from '@/infrastructure/analysis/node-project-analyzer.adapter';
import { createElectronProjectDialogAdapter } from '@/infrastructure/dialog/electron-project-dialog.adapter';
import { createNodeProjectInspectorAdapter } from '@/infrastructure/fs/node-project-inspector.adapter';
import { createFsProjectSessionRepository } from '@/infrastructure/sdd/fs-project-session.repository';
import { createFsProjectStorageRepository } from '@/infrastructure/sdd/fs-project-storage.repository';
import { projectIpcChannels } from '@/shared/ipc/project-ipc';

export function registerProjectIpc(): void {
  const projectDialog = createElectronProjectDialogAdapter();
  const projectAnalyzer = createNodeProjectAnalyzerAdapter();
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

  ipcMain.handle(projectIpcChannels.listSessions, async (_event, input: { rootPath: string }) => {
    return listProjectSessions.execute(input);
  });

  ipcMain.handle(
    projectIpcChannels.createSession,
    async (_event, input: { rootPath: string; title?: string }) => {
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
}
