import { BrowserWindow, app } from 'electron';

import { createMainWindow } from '@/main/create-main-window';
import { registerProjectIpc } from '@/main/ipc/register-project-ipc';
import { registerSettingsIpc } from '@/main/ipc/register-settings-ipc';
import { APP_DISPLAY_NAME } from '@/shared/app/app-display-name';

app.setName(APP_DISPLAY_NAME);

async function bootstrap(): Promise<void> {
  await app.whenReady();

  registerProjectIpc();
  registerSettingsIpc();
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
