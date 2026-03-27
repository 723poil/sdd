import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { ProjectSessionPort } from '@/application/project/project.ports';
import {
  createNextProjectSessionMetaAfterMessage,
  createProjectSessionMessage,
  createProjectSessionMeta,
  type ProjectSessionMeta,
} from '@/domain/project/project-session-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok } from '@/shared/contracts/result';

import {
  appendSessionMessageDocument,
  readSessionIds,
  readSessionMessagesDocument,
  readSessionMetaDocument,
  toProjectSessionViewSummaries,
  writeSessionIndexDocument,
} from '@/infrastructure/sdd/fs-project-session-documents';
import { persistProjectSessionMessageAttachments } from '@/infrastructure/sdd/fs-project-session-attachments';
import {
  getSessionMessageAttachmentsDirectoryPath,
  getSessionMessagesPath,
  getSessionMetaPath,
  getSessionsDirectoryPath,
} from '@/infrastructure/sdd/fs-project-session-paths';
import { pathExists } from '@/infrastructure/sdd/fs-project-storage-io';
import {
  writeJsonAtomically,
  writeTextAtomically,
} from '@/infrastructure/fs/write-json-atomically';

async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, {
    recursive: true,
  });
}

export function createFsProjectSessionRepository(): ProjectSessionPort {
  return {
    async listSessions(input) {
      const rootPath = resolve(input.rootPath);
      const sessionsDirectoryPath = getSessionsDirectoryPath(rootPath);

      if (!(await pathExists(sessionsDirectoryPath))) {
        return ok([]);
      }

      const sessionIds = await readSessionIds(rootPath);
      const sessionMetas: ProjectSessionMeta[] = [];

      for (const sessionId of sessionIds) {
        const sessionMetaResult = await readSessionMetaDocument({
          rootPath,
          sessionId,
        });
        if (!sessionMetaResult.ok) {
          return sessionMetaResult;
        }

        if (sessionMetaResult.value) {
          sessionMetas.push(sessionMetaResult.value);
        }
      }

      const summaries = toProjectSessionViewSummaries(sessionMetas).sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );

      await writeSessionIndexDocument({
        rootPath,
        sessions: summaries,
      });

      return ok(summaries);
    },

    async createSession(input) {
      const rootPath = resolve(input.rootPath);
      const sessionsDirectoryPath = getSessionsDirectoryPath(rootPath);
      const sessionId = randomUUID();
      const now = new Date().toISOString();
      const sessionMeta = createProjectSessionMeta({
        id: sessionId,
        now,
        specId: input.specId,
        title: input.title,
      });

      await ensureDirectory(sessionsDirectoryPath);
      await writeJsonAtomically(getSessionMetaPath(rootPath, sessionId), sessionMeta);
      await writeTextAtomically(getSessionMessagesPath(rootPath, sessionId), '');

      const currentSessionsResult = await this.listSessions({
        rootPath,
      });
      if (!currentSessionsResult.ok) {
        return currentSessionsResult;
      }

      return ok(sessionMeta);
    },

    async readSessionMessages(input) {
      return readSessionMessagesDocument({
        rootPath: input.rootPath,
        sessionId: input.sessionId,
      });
    },

    async appendSessionMessage(input) {
      const rootPath = resolve(input.rootPath);
      const sessionMetaResult = await readSessionMetaDocument({
        rootPath,
        sessionId: input.sessionId,
      });
      if (!sessionMetaResult.ok) {
        return sessionMetaResult;
      }

      const currentSession = sessionMetaResult.value;
      if (!currentSession) {
        return err(
          createProjectError(
            'INVALID_PROJECT_STORAGE',
            '해당 세션 메타 파일을 찾을 수 없습니다.',
            getSessionMetaPath(rootPath, input.sessionId),
          ),
        );
      }

      const now = new Date().toISOString();
      const messageId = randomUUID();
      const persistedAttachmentsResult = await persistProjectSessionMessageAttachments({
        attachments: input.attachments ?? [],
        messageId,
        now,
        rootPath,
        sessionId: input.sessionId,
      });
      if (!persistedAttachmentsResult.ok) {
        return persistedAttachmentsResult;
      }

      const message = createProjectSessionMessage({
        attachments: persistedAttachmentsResult.value,
        id: messageId,
        now,
        role: input.role,
        sessionId: input.sessionId,
        text: input.text,
      });

      const nextSession = createNextProjectSessionMetaAfterMessage({
        attachments: message.attachments,
        current: currentSession,
        now,
        text: input.text,
      });

      try {
        await appendSessionMessageDocument({
          rootPath,
          message,
          sessionId: input.sessionId,
        });
      } catch (error) {
        await rm(getSessionMessageAttachmentsDirectoryPath(rootPath, input.sessionId, messageId), {
          force: true,
          recursive: true,
        });
        return err(
          createProjectError(
            'INVALID_PROJECT_STORAGE',
            '세션 메시지 로그를 저장하지 못했습니다.',
            error instanceof Error ? error.message : undefined,
          ),
        );
      }

      await writeJsonAtomically(getSessionMetaPath(rootPath, input.sessionId), nextSession);

      const sessionsResult = await this.listSessions({
        rootPath,
      });
      if (!sessionsResult.ok) {
        return sessionsResult;
      }

      return ok({
        message,
        session: nextSession,
      });
    },
  };
}
