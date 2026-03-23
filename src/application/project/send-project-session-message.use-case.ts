import type { ProjectSessionMessage, ProjectSessionMeta } from '@/domain/project/project-session-model';
import { createProjectError } from '@/domain/project/project-errors';
import type { Result } from '@/shared/contracts/result';
import { err, ok } from '@/shared/contracts/result';

import type { ProjectSessionPort, ProjectStoragePort } from '@/application/project/project.ports';

export interface SendProjectSessionMessageOutput {
  message: ProjectSessionMessage;
  session: ProjectSessionMeta;
}

export interface SendProjectSessionMessageUseCase {
  execute(input: { rootPath: string; sessionId: string; text: string }): Promise<Result<SendProjectSessionMessageOutput>>;
}

export function createSendProjectSessionMessageUseCase(dependencies: {
  projectSessionStore: ProjectSessionPort;
  projectStorage: ProjectStoragePort;
}): SendProjectSessionMessageUseCase {
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
            '먼저 작업 공간 준비를 완료해야 메시지를 저장할 수 있습니다.',
          ),
        );
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
