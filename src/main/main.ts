import { BrowserWindow, app } from 'electron';

import { createMainWindow } from '@/main/create-main-window';
import { registerProjectIpc } from '@/main/ipc/register-project-ipc';

async function bootstrap(): Promise<void> {
  await app.whenReady();

  registerProjectIpc();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

void bootstrap();

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
