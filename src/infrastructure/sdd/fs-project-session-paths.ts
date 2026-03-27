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

export function getSessionAttachmentsDirectoryPath(rootPath: string, sessionId: string): string {
  return join(getSessionDirectoryPath(rootPath, sessionId), 'attachments');
}

export function getSessionMessageAttachmentsDirectoryPath(
  rootPath: string,
  sessionId: string,
  messageId: string,
): string {
  return join(getSessionAttachmentsDirectoryPath(rootPath, sessionId), messageId);
}

export function getSessionAttachmentRelativePath(messageId: string, fileName: string): string {
  return ['attachments', messageId, fileName].join('/');
}

export function getSessionAttachmentAbsolutePath(
  rootPath: string,
  sessionId: string,
  relativePath: string,
): string {
  return join(getSessionDirectoryPath(rootPath, sessionId), relativePath);
}

export function getSessionMessageAttachmentPath(
  rootPath: string,
  sessionId: string,
  messageId: string,
  fileName: string,
): string {
  return join(getSessionMessageAttachmentsDirectoryPath(rootPath, sessionId, messageId), fileName);
}
