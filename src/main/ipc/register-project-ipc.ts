import { ipcMain } from 'electron';

import { registerProjectIpcHandlers } from '@/main/ipc/project-ipc-registration';

export function registerProjectIpc(): void {
  registerProjectIpcHandlers(ipcMain);
}
