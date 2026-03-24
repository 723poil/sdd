import {
  createDefaultProjectSessionTitle,
  type ProjectSessionMeta,
} from '@/domain/project/project-session-model';
import type { Result } from '@/shared/contracts/result';

import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';
import type {
  ProjectInspectorPort,
  ProjectSessionPort,
  ProjectStoragePort,
} from '@/application/project/project.ports';

export interface CreateProjectSessionUseCase {
  execute(input: { rootPath: string; title?: string }): Promise<Result<ProjectSessionMeta>>;
}

export function createCreateProjectSessionUseCase(dependencies: {
  projectInspector: ProjectInspectorPort;
  projectSessionStore: ProjectSessionPort;
  projectStorage: ProjectStoragePort;
}): CreateProjectSessionUseCase {
  return {
    async execute(input) {
      const storageResult = await ensureProjectStorageReady(dependencies, {
        notWritableMessage: '대화 세션을 만들려면 프로젝트 경로에 쓰기 권한이 필요합니다.',
        rootPath: input.rootPath,
      });
      if (!storageResult.ok) {
        return storageResult;
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
