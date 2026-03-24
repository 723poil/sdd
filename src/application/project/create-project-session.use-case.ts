import {
  createDefaultProjectSessionTitle,
  type ProjectSessionMeta,
} from '@/domain/project/project-session-model';
import { createProjectError } from '@/domain/project/project-errors';
import type { Result } from '@/shared/contracts/result';
import { err } from '@/shared/contracts/result';

import type { ProjectSessionPort, ProjectStoragePort } from '@/application/project/project.ports';

export interface CreateProjectSessionUseCase {
  execute(input: { rootPath: string; title?: string }): Promise<Result<ProjectSessionMeta>>;
}

export function createCreateProjectSessionUseCase(dependencies: {
  projectSessionStore: ProjectSessionPort;
  projectStorage: ProjectStoragePort;
}): CreateProjectSessionUseCase {
  return {
    async execute(input) {
      const projectMetaResult = await dependencies.projectStorage.readProjectMeta({
        rootPath: input.rootPath,
      });
      if (!projectMetaResult.ok) {
        return projectMetaResult;
      }

      if (!projectMetaResult.value) {
        return err(
          createProjectError(
            'PROJECT_NOT_INITIALIZED',
            '먼저 작업 공간 준비를 완료해야 대화 세션을 만들 수 있습니다.',
          ),
        );
      }

      const sessionsResult = await dependencies.projectSessionStore.listSessions({
        rootPath: input.rootPath,
      });
      if (!sessionsResult.ok) {
        return sessionsResult;
      }

      const title =
        input.title?.trim() ||
        createDefaultProjectSessionTitle({
          sequenceNumber: sessionsResult.value.length + 1,
        });

      return dependencies.projectSessionStore.createSession({
        rootPath: input.rootPath,
        title,
      });
    },
  };
}
