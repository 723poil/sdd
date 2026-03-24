import { join } from 'node:path';

export function getSessionsDirectoryPath(rootPath: string): string {
  return join(rootPath, '.sdd', 'sessions');
}

export function getSessionIndexPath(rootPath: string): string {
  return join(getSessionsDirectoryPath(rootPath), 'index.json');
}

export function getSessionDirectoryPath(rootPath: string, sessionId: string): string {
  return join(getSessionsDirectoryPath(rootPath), sessionId);
}

export function getSessionMetaPath(rootPath: string, sessionId: string): string {
  return join(getSessionDirectoryPath(rootPath, sessionId), 'meta.json');
}

export function getSessionMessagesPath(rootPath: string, sessionId: string): string {
  return join(getSessionDirectoryPath(rootPath, sessionId), 'messages.jsonl');
}
