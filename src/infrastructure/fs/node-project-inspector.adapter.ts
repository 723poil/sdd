import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import type { ProjectInspectorPort } from '@/application/project/project.ports';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok } from '@/shared/contracts/result';

async function hasAccess(path: string, mode: number): Promise<boolean> {
  try {
    await access(path, mode);
    return true;
  } catch {
    return false;
  }
}

export function createNodeProjectInspectorAdapter(): ProjectInspectorPort {
  return {
    async inspectDirectory(input) {
      const rootPath = resolve(input.rootPath);

      if (rootPath.length === 0) {
        return err(createProjectError('INVALID_PROJECT_PATH', '프로젝트 경로가 비어 있습니다.'));
      }

      let entryStat;
      try {
        entryStat = await stat(rootPath);
      } catch {
        return err(
          createProjectError(
            'INVALID_PROJECT_PATH',
            '선택한 경로를 찾을 수 없습니다.',
            rootPath,
          ),
        );
      }

      if (!entryStat.isDirectory()) {
        return err(
          createProjectError(
            'PROJECT_NOT_DIRECTORY',
            '선택한 경로가 폴더가 아닙니다.',
            rootPath,
          ),
        );
      }

      const isReadable = await hasAccess(rootPath, constants.R_OK);
      if (!isReadable) {
        return err(
          createProjectError(
            'PROJECT_NOT_READABLE',
            '선택한 프로젝트를 읽을 수 없습니다.',
            rootPath,
          ),
        );
      }

      const isWritable = await hasAccess(rootPath, constants.W_OK);
      const hasSddDirectory = await hasAccess(join(rootPath, '.sdd'), constants.F_OK);

      return ok({
        rootPath,
        projectName: basename(rootPath),
        exists: true,
        isDirectory: true,
        isReadable,
        isWritable,
        hasSddDirectory,
      });
    },
  };
}
