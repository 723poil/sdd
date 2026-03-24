import { contextBridge, ipcRenderer } from 'electron';

import { createRendererProjectApi } from '@/shared/ipc/project-ipc-api';
import { createRendererSettingsApi } from '@/shared/ipc/settings-ipc-api';
import type { RendererSddApi } from '@/shared/ipc/sdd-ipc';

const invoke = ipcRenderer.invoke.bind(ipcRenderer);

const sddApi: RendererSddApi = {
  project: createRendererProjectApi(invoke),
  settings: createRendererSettingsApi(invoke),
};

contextBridge.exposeInMainWorld('sdd', sddApi);
