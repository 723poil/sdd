import { contextBridge, ipcRenderer } from 'electron';

import type { RendererSddApi } from '@/shared/ipc/sdd-ipc';
import { projectIpcChannels } from '@/shared/ipc/project-ipc';
import { settingsIpcChannels } from '@/shared/ipc/settings-ipc';

const sddApi: RendererSddApi = {
  project: {
    selectDirectory() {
      return ipcRenderer.invoke(projectIpcChannels.selectDirectory);
    },
    inspect(input) {
      return ipcRenderer.invoke(projectIpcChannels.inspect, input);
    },
    readAnalysis(input) {
      return ipcRenderer.invoke(projectIpcChannels.readAnalysis, input);
    },
    saveAnalysisDocumentLayouts(input) {
      return ipcRenderer.invoke(projectIpcChannels.saveAnalysisDocumentLayouts, input);
    },
    readSpecs(input) {
      return ipcRenderer.invoke(projectIpcChannels.readSpecs, input);
    },
    createSpec(input) {
      return ipcRenderer.invoke(projectIpcChannels.createSpec, input);
    },
    readAnalysisRunStatus(input) {
      return ipcRenderer.invoke(projectIpcChannels.readAnalysisRunStatus, input);
    },
    analyze(input) {
      return ipcRenderer.invoke(projectIpcChannels.analyze, input);
    },
    cancelAnalysis(input) {
      return ipcRenderer.invoke(projectIpcChannels.cancelAnalysis, input);
    },
    listSessions(input) {
      return ipcRenderer.invoke(projectIpcChannels.listSessions, input);
    },
    createSession(input) {
      return ipcRenderer.invoke(projectIpcChannels.createSession, input);
    },
    readSessionMessages(input) {
      return ipcRenderer.invoke(projectIpcChannels.readSessionMessages, input);
    },
    sendSessionMessage(input) {
      return ipcRenderer.invoke(projectIpcChannels.sendSessionMessage, input);
    },
    listRecentProjects() {
      return ipcRenderer.invoke(projectIpcChannels.listRecentProjects);
    },
    activate(input) {
      return ipcRenderer.invoke(projectIpcChannels.activate, input);
    },
    reorderRecentProjects(input) {
      return ipcRenderer.invoke(projectIpcChannels.reorderRecentProjects, input);
    },
  },
  settings: {
    listAgentCliConnections() {
      return ipcRenderer.invoke(settingsIpcChannels.listAgentCliConnections);
    },
    saveAgentCliConnection(input) {
      return ipcRenderer.invoke(settingsIpcChannels.saveAgentCliConnection, input);
    },
    checkAgentCliConnection(input) {
      return ipcRenderer.invoke(settingsIpcChannels.checkAgentCliConnection, input);
    },
  },
};

contextBridge.exposeInMainWorld('sdd', sddApi);
