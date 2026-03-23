import { dialog } from 'electron';

import type { ProjectDialogPort } from '@/application/project/project.ports';
import { ok } from '@/shared/contracts/result';

export function createElectronProjectDialogAdapter(): ProjectDialogPort {
  return {
    async openProjectDirectory() {
      const selection = await dialog.showOpenDialog({
        title: '프로젝트 폴더 선택',
        properties: ['openDirectory'],
      });

      if (selection.canceled) {
        return ok(null);
      }

      return ok(selection.filePaths[0] ?? null);
    },
  };
}
