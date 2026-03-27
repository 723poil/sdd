import { appendFile, readdir } from 'node:fs/promises';

import {
  normalizeProjectSessionMessage,
  normalizeProjectSessionMeta,
  PROJECT_SESSION_INDEX_SCHEMA_VERSION,
  toProjectSessionSummary,
  toPersistedProjectSessionMessage,
  type ProjectSessionIndex,
  type ProjectSessionMessage,
  type ProjectSessionMeta,
  type ProjectSessionSummary,
} from '@/domain/project/project-session-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

import { writeJsonAtomically } from '@/infrastructure/fs/write-json-atomically';
import { hydrateProjectSessionMessageAttachments } from '@/infrastructure/sdd/fs-project-session-attachments';
import {
  getSessionIndexPath,
  getSessionMessagesPath,
  getSessionMetaPath,
  getSessionsDirectoryPath,
} from '@/infrastructure/sdd/fs-project-session-paths';
import { pathExists, readJsonFile, readTextFile } from '@/infrastructure/sdd/fs-project-storage-io';

export async function readSessionIds(rootPath: string): Promise<string[]> {
  const sessionsDirectoryPath = getSessionsDirectoryPath(rootPath);
  const entries = await readdir(sessionsDirectoryPath, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export async function readSessionMetaDocument(input: {
  rootPath: string;
  sessionId: string;
}): Promise<Result<ProjectSessionMeta | null>> {
  const metaPath = getSessionMetaPath(input.rootPath, input.sessionId);
  if (!(await pathExists(metaPath))) {
    return ok(null);
  }

  const parsedResult = await readJsonFile(metaPath, '세션 메타 파일을 읽거나 파싱할 수 없습니다.');
  if (!parsedResult.ok) {
    return err(parsedResult.error);
  }

  const normalizedMeta = normalizeProjectSessionMeta(parsedResult.value);
  if (!normalizedMeta) {
    return err(
      createProjectError(
        'INVALID_PROJECT_STORAGE',
        '세션 메타 파일이 현재 계약을 만족하지 않습니다.',
        metaPath,
      ),
    );
  }

  return ok(normalizedMeta);
}

export async function readSessionMessagesDocument(input: {
  rootPath: string;
  sessionId: string;
}): Promise<Result<ProjectSessionMessage[]>> {
  const messagesPath = getSessionMessagesPath(input.rootPath, input.sessionId);

  if (!(await pathExists(messagesPath))) {
    return ok([]);
  }

  const contentResult = await readTextFile(messagesPath, '세션 메시지 파일을 읽을 수 없습니다.');
  if (!contentResult.ok) {
    return err(contentResult.error);
  }

  const lines = contentResult.value
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

    const normalizedMessage = normalizeProjectSessionMessage(parsed);
    if (!normalizedMessage) {
      return err(
        createProjectError(
          'INVALID_PROJECT_STORAGE',
          '세션 메시지 로그가 현재 계약을 만족하지 않습니다.',
          messagesPath,
        ),
      );
    }

    messages.push({
      ...normalizedMessage,
      attachments: hydrateProjectSessionMessageAttachments({
        attachments: normalizedMessage.attachments,
        rootPath: input.rootPath,
        sessionId: input.sessionId,
      }),
    });
  }

  return ok(messages);
}

export async function writeSessionIndexDocument(input: {
  rootPath: string;
  sessions: ProjectSessionIndex['sessions'];
}): Promise<void> {
  await writeJsonAtomically(getSessionIndexPath(input.rootPath), {
    schemaVersion: PROJECT_SESSION_INDEX_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sessions: input.sessions,
  } satisfies ProjectSessionIndex);
}

export function toProjectSessionViewSummaries(
  sessions: ProjectSessionMeta[],
): ProjectSessionSummary[] {
  return sessions.map((session) => toProjectSessionSummary(session));
}

export async function appendSessionMessageDocument(input: {
  rootPath: string;
  message: ProjectSessionMessage;
  sessionId: string;
}): Promise<void> {
  const messagePath = getSessionMessagesPath(input.rootPath, input.sessionId);
  await appendFile(
    messagePath,
    `${JSON.stringify(toPersistedProjectSessionMessage(input.message))}\n`,
    'utf8',
  );
}
