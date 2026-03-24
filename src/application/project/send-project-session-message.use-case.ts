import type { ProjectSessionMessage, ProjectSessionMeta } from '@/domain/project/project-session-model';
import { createProjectError } from '@/domain/project/project-errors';
import type { Result } from '@/shared/contracts/result';
import { err, ok } from '@/shared/contracts/result';

import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';
import type {
  ProjectInspectorPort,
  ProjectSessionPort,
  ProjectStoragePort,
} from '@/application/project/project.ports';

export interface SendProjectSessionMessageOutput {
  message: ProjectSessionMessage;
  session: ProjectSessionMeta;
}

export interface SendProjectSessionMessageUseCase {
  execute(input: { rootPath: string; sessionId: string; text: string }): Promise<Result<SendProjectSessionMessageOutput>>;
}

export function createSendProjectSessionMessageUseCase(dependencies: {
  projectInspector: ProjectInspectorPort;
  projectSessionStore: ProjectSessionPort;
  projectStorage: ProjectStoragePort;
}): SendProjectSessionMessageUseCase {
  return {
    async execute(input) {
      const storageResult = await ensureProjectStorageReady(dependencies, {
        notWritableMessage: '메시지를 저장하려면 프로젝트 경로에 쓰기 권한이 필요합니다.',
        rootPath: input.rootPath,
      });
      if (!storageResult.ok) {
        return storageResult;
      }

      const trimmedText = input.text.trim();
      if (trimmedText.length === 0) {
        return err(createProjectError('INVALID_PROJECT_STORAGE', '빈 메시지는 저장할 수 없습니다.'));
      }

      const result = await dependencies.projectSessionStore.appendSessionMessage({
        rootPath: input.rootPath,
        sessionId: input.sessionId,
        role: 'user',
        text: trimmedText,
      });
      if (!result.ok) {
        return result;
      }

      return ok(result.value);
    },
  };
}
