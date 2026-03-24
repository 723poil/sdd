import { BrowserWindow, nativeTheme } from 'electron';
import { join } from 'node:path';

import { APP_DISPLAY_NAME } from '@/shared/app/app-display-name';

function getSystemBackgroundColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#0c1117' : '#f3f5f7';
}

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    show: false,
    title: APP_DISPLAY_NAME,
    titleBarStyle: 'hiddenInset',
    backgroundColor: getSystemBackgroundColor(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  const handleNativeThemeUpdated = () => {
    mainWindow.setBackgroundColor(getSystemBackgroundColor());
  };

  nativeTheme.on('updated', handleNativeThemeUpdated);
  mainWindow.on('closed', () => {
    nativeTheme.off('updated', handleNativeThemeUpdated);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}
