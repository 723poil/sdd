import { app, nativeImage } from 'electron';
import { join } from 'node:path';

function resolveMacAppIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'icon', 'sdd-icon.png');
  }

  return join(process.cwd(), 'build', 'icon', 'sdd-icon.png');
}

export function applyMacAppIcon(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  const icon = nativeImage.createFromPath(resolveMacAppIconPath());

  if (icon.isEmpty()) {
    return;
  }

  app.dock.setIcon(icon);
}
