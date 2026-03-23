import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { ProjectSessionPort } from '@/application/project/project.ports';
import {
  PROJECT_SESSION_INDEX_SCHEMA_VERSION,
  createProjectSessionMessage,
  createProjectSessionMeta,
  isProjectSessionMessage,
  isProjectSessionMeta,
  toProjectSessionSummary,
  type ProjectSessionIndex,
  type ProjectSessionMessage,
  type ProjectSessionMeta,
} from '@/domain/project/project-session-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok } from '@/shared/contracts/result';

import { writeJsonAtomically, writeTextAtomically } from '@/infrastructure/fs/write-json-atomically';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

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
        const sessionMetaResult = await readSessionMeta({
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

      const summaries = sessionMetas
        .map((session) => toProjectSessionSummary(session))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

      await writeSessionIndex({
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
      const rootPath = resolve(input.rootPath);
      const messagesPath = getSessionMessagesPath(rootPath, input.sessionId);

      if (!(await pathExists(messagesPath))) {
        return ok([]);
      }

      let content = '';
      try {
        content = await readFile(messagesPath, 'utf8');
      } catch {
        return err(
          createProjectError(
            'INVALID_PROJECT_STORAGE',
            '세션 메시지 파일을 읽을 수 없습니다.',
            messagesPath,
          ),
        );
      }

      const lines = content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const messages: ProjectSessionMessage[] = [];
      for (const line of lines) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(line) as unknown;
        } catch {
          return err(
            createProjectError(
              'INVALID_PROJECT_STORAGE',
              '세션 메시지 로그를 파싱할 수 없습니다.',
              messagesPath,
            ),
          );
        }

        if (!isProjectSessionMessage(parsed)) {
          return err(
            createProjectError(
              'INVALID_PROJECT_STORAGE',
              '세션 메시지 로그가 현재 계약을 만족하지 않습니다.',
              messagesPath,
            ),
          );
        }

        messages.push(parsed);
      }

      return ok(messages);
    },

    async appendSessionMessage(input) {
      const rootPath = resolve(input.rootPath);
      const sessionMetaResult = await readSessionMeta({
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
      const message = createProjectSessionMessage({
        id: randomUUID(),
        now,
        role: input.role,
        sessionId: input.sessionId,
        text: input.text,
      });

      const messages = await this.readSessionMessages({
        rootPath,
        sessionId: input.sessionId,
      });
      if (!messages.ok) {
        return messages;
      }

      const nextMessagesContent = [...messages.value, message]
        .map((item) => JSON.stringify(item))
        .join('\n');

      const nextSession: ProjectSessionMeta = {
        ...currentSession,
        updatedAt: now,
        revision: currentSession.revision + 1,
        lastMessageAt: now,
        lastMessagePreview: createPreviewText(input.text),
        messageCount: currentSession.messageCount + 1,
      };

      await writeTextAtomically(
        getSessionMessagesPath(rootPath, input.sessionId),
        `${nextMessagesContent}\n`,
      );
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

async function readSessionIds(rootPath: string): Promise<string[]> {
  const sessionsDirectoryPath = getSessionsDirectoryPath(rootPath);
  const entries = await readdir(sessionsDirectoryPath, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function readSessionMeta(input: {
  rootPath: string;
  sessionId: string;
}) {
  const metaPath = getSessionMetaPath(input.rootPath, input.sessionId);
  if (!(await pathExists(metaPath))) {
    return ok(null);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(metaPath, 'utf8')) as unknown;
  } catch {
    return err(
      createProjectError('INVALID_PROJECT_STORAGE', '세션 메타 파일을 읽거나 파싱할 수 없습니다.', metaPath),
    );
  }

  if (!isProjectSessionMeta(parsed)) {
    return err(
      createProjectError('INVALID_PROJECT_STORAGE', '세션 메타 파일이 현재 계약을 만족하지 않습니다.', metaPath),
    );
  }

  return ok(parsed);
}

async function writeSessionIndex(input: {
  rootPath: string;
  sessions: ProjectSessionIndex['sessions'];
}): Promise<void> {
  await writeJsonAtomically(getSessionIndexPath(input.rootPath), {
    schemaVersion: PROJECT_SESSION_INDEX_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sessions: input.sessions,
  } satisfies ProjectSessionIndex);
}

function createPreviewText(text: string): string {
  const normalized = text.replaceAll(/\s+/gu, ' ').trim();
  return normalized.length > 80 ? `${normalized.slice(0, 80)}...` : normalized;
}

function getSessionsDirectoryPath(rootPath: string): string {
  return join(rootPath, '.sdd', 'sessions');
}

function getSessionIndexPath(rootPath: string): string {
  return join(getSessionsDirectoryPath(rootPath), 'index.json');
}

function getSessionDirectoryPath(rootPath: string, sessionId: string): string {
  return join(getSessionsDirectoryPath(rootPath), sessionId);
}

function getSessionMetaPath(rootPath: string, sessionId: string): string {
  return join(getSessionDirectoryPath(rootPath, sessionId), 'meta.json');
}

function getSessionMessagesPath(rootPath: string, sessionId: string): string {
  return join(getSessionDirectoryPath(rootPath, sessionId), 'messages.jsonl');
}
