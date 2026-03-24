export const PROJECT_SESSION_SCHEMA_VERSION = 1;
export const PROJECT_SESSION_INDEX_SCHEMA_VERSION = 1;
export const PROJECT_SESSION_MESSAGE_SCHEMA_VERSION = 1;

export type ProjectSessionMessageRole = 'system' | 'user' | 'assistant';

export interface ProjectSessionMeta {
  schemaVersion: typeof PROJECT_SESSION_SCHEMA_VERSION;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  messageCount: number;
}

export interface ProjectSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  messageCount: number;
}

export interface ProjectSessionIndex {
  schemaVersion: typeof PROJECT_SESSION_INDEX_SCHEMA_VERSION;
  generatedAt: string;
  sessions: ProjectSessionSummary[];
}

export interface ProjectSessionMessage {
  schemaVersion: typeof PROJECT_SESSION_MESSAGE_SCHEMA_VERSION;
  id: string;
  sessionId: string;
  createdAt: string;
  role: ProjectSessionMessageRole;
  text: string;
}

export function createProjectSessionMeta(input: {
  id: string;
  now: string;
  title: string;
}): ProjectSessionMeta {
  return {
    schemaVersion: PROJECT_SESSION_SCHEMA_VERSION,
    id: input.id,
    title: input.title,
    createdAt: input.now,
    updatedAt: input.now,
    revision: 1,
    lastMessageAt: null,
    lastMessagePreview: null,
    messageCount: 0,
  };
}

export function createProjectSessionMessage(input: {
  id: string;
  now: string;
  role: ProjectSessionMessageRole;
  sessionId: string;
  text: string;
}): ProjectSessionMessage {
  return {
    schemaVersion: PROJECT_SESSION_MESSAGE_SCHEMA_VERSION,
    id: input.id,
    sessionId: input.sessionId,
    createdAt: input.now,
    role: input.role,
    text: input.text,
  };
}

export function createDefaultProjectSessionTitle(input: { sequenceNumber: number }): string {
  return `새 대화 ${String(input.sequenceNumber).padStart(2, '0')}`;
}

export function createNextProjectSessionMetaAfterMessage(input: {
  current: ProjectSessionMeta;
  now: string;
  text: string;
}): ProjectSessionMeta {
  return {
    ...input.current,
    updatedAt: input.now,
    revision: input.current.revision + 1,
    lastMessageAt: input.now,
    lastMessagePreview: createSessionMessagePreview(input.text),
    messageCount: input.current.messageCount + 1,
  };
}

export function toProjectSessionSummary(meta: ProjectSessionMeta): ProjectSessionSummary {
  return {
    id: meta.id,
    title: meta.title,
    updatedAt: meta.updatedAt,
    lastMessageAt: meta.lastMessageAt,
    lastMessagePreview: meta.lastMessagePreview,
    messageCount: meta.messageCount,
  };
}

export function isProjectSessionMeta(value: unknown): value is ProjectSessionMeta {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.schemaVersion === PROJECT_SESSION_SCHEMA_VERSION &&
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    typeof candidate.revision === 'number' &&
    (typeof candidate.lastMessageAt === 'string' || candidate.lastMessageAt === null) &&
    (typeof candidate.lastMessagePreview === 'string' || candidate.lastMessagePreview === null) &&
    typeof candidate.messageCount === 'number'
  );
}

export function isProjectSessionMessage(value: unknown): value is ProjectSessionMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.schemaVersion === PROJECT_SESSION_MESSAGE_SCHEMA_VERSION &&
    typeof candidate.id === 'string' &&
    typeof candidate.sessionId === 'string' &&
    typeof candidate.createdAt === 'string' &&
    (candidate.role === 'system' || candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.text === 'string'
  );
}

function createSessionMessagePreview(text: string): string {
  const normalized = text.replaceAll(/\s+/gu, ' ').trim();
  return normalized.length > 80 ? `${normalized.slice(0, 80)}...` : normalized;
}
