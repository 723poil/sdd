const LEGACY_PROJECT_SESSION_SCHEMA_VERSION = 1;
const LEGACY_PROJECT_SESSION_MESSAGE_SCHEMA_VERSION = 1;
const SESSION_MESSAGE_PREVIEW_MAX_LENGTH = 80;
const PROJECT_SESSION_ATTACHMENT_IMAGE_MIME_TYPE_MAP = new Map<string, string>([
  ['image/jpg', 'jpg'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const PROJECT_SESSION_ATTACHMENT_TEXT_MIME_TYPE_MAP = new Map<string, string>([
  ['application/javascript', 'js'],
  ['application/json', 'json'],
  ['application/toml', 'toml'],
  ['application/x-httpd-php', 'php'],
  ['application/x-yaml', 'yaml'],
  ['text/css', 'css'],
  ['text/html', 'html'],
  ['text/javascript', 'js'],
  ['text/markdown', 'md'],
  ['text/plain', 'txt'],
  ['text/x-java-source', 'java'],
  ['text/x-python', 'py'],
  ['text/yaml', 'yaml'],
]);

export const PROJECT_SESSION_SCHEMA_VERSION = 2;
export const PROJECT_SESSION_INDEX_SCHEMA_VERSION = 2;
export const PROJECT_SESSION_MESSAGE_SCHEMA_VERSION = 2;
export const PROJECT_SESSION_MESSAGE_RUN_STATES = [
  'idle',
  'running',
  'cancelling',
  'cancelled',
  'succeeded',
  'failed',
] as const;
export const PROJECT_SESSION_MESSAGE_ATTACHMENT_KINDS = ['image', 'file'] as const;
export const PROJECT_SESSION_MESSAGE_ATTACHMENT_SOURCES = ['paste', 'drop', 'picker'] as const;
export const PROJECT_SESSION_MESSAGE_ATTACHMENT_IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'webp',
] as const;
export const PROJECT_SESSION_MESSAGE_ATTACHMENT_TEXT_EXTENSIONS = [
  'txt',
  'md',
  'json',
  'yaml',
  'yml',
  'toml',
  'ts',
  'tsx',
  'js',
  'jsx',
  'css',
  'html',
  'java',
  'kt',
  'php',
  'py',
] as const;
export const PROJECT_SESSION_MESSAGE_ATTACHMENT_LIMITS = {
  maxCount: 5,
  maxSizeBytes: 20 * 1024 * 1024,
  maxTotalSizeBytes: 30 * 1024 * 1024,
} as const;
export const PROJECT_SESSION_MESSAGE_ATTACHMENT_PICKER_ACCEPT = [
  ...PROJECT_SESSION_MESSAGE_ATTACHMENT_IMAGE_EXTENSIONS,
  ...PROJECT_SESSION_MESSAGE_ATTACHMENT_TEXT_EXTENSIONS,
]
  .map((extension) => `.${extension}`)
  .join(',');

export type ProjectSessionMessageRole = 'system' | 'user' | 'assistant';
export type ProjectSessionMessageRunState = (typeof PROJECT_SESSION_MESSAGE_RUN_STATES)[number];
export type ProjectSessionMessageAttachmentKind =
  (typeof PROJECT_SESSION_MESSAGE_ATTACHMENT_KINDS)[number];
export type ProjectSessionMessageAttachmentSource =
  (typeof PROJECT_SESSION_MESSAGE_ATTACHMENT_SOURCES)[number];
export type ProjectSessionMessageAttachmentValidationCode =
  | 'unsupported-type'
  | 'file-too-large'
  | 'total-size-too-large'
  | 'too-many-attachments';

export interface ProjectSessionMeta {
  schemaVersion: typeof PROJECT_SESSION_SCHEMA_VERSION;
  id: string;
  specId: string | null;
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
  specId: string | null;
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

export interface ProjectSessionMessageAttachmentManifest {
  id: string;
  kind: ProjectSessionMessageAttachmentKind;
  source: ProjectSessionMessageAttachmentSource;
  name: string;
  mimeType: string;
  sizeBytes: number;
  relativePath: string;
  createdAt: string;
  previewUrl?: string | null;
}

export interface ProjectSessionMessagePendingAttachment {
  id: string;
  kind: ProjectSessionMessageAttachmentKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  previewUrl?: string | null;
}

export interface ProjectSessionMessageAttachmentCandidate {
  name: string;
  mimeType: string;
  sizeBytes: number;
  source: ProjectSessionMessageAttachmentSource;
}

export interface ProjectSessionMessageAttachmentUpload extends ProjectSessionMessageAttachmentCandidate {
  bytes: Uint8Array;
  kind: ProjectSessionMessageAttachmentKind;
}

export interface ProjectSessionValidatedMessageAttachmentCandidate {
  candidate: ProjectSessionMessageAttachmentCandidate;
  kind: ProjectSessionMessageAttachmentKind;
}

export interface ProjectSessionMessageAttachmentValidationIssue {
  candidate: ProjectSessionMessageAttachmentCandidate;
  code: ProjectSessionMessageAttachmentValidationCode;
}

export interface ProjectSessionMessage {
  schemaVersion: typeof PROJECT_SESSION_MESSAGE_SCHEMA_VERSION;
  id: string;
  sessionId: string;
  createdAt: string;
  role: ProjectSessionMessageRole;
  text: string;
  attachments: ProjectSessionMessageAttachmentManifest[];
}

export interface ProjectSessionMessageRunStatus {
  rootPath: string;
  sessionId: string;
  status: ProjectSessionMessageRunState;
  stepIndex: number;
  stepTotal: number;
  stageMessage: string;
  progressMessage: string | null;
  requestText: string | null;
  requestSummary: string | null;
  attachmentCount: number;
  requestAttachments: ProjectSessionMessagePendingAttachment[];
  startedAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
}

export function createProjectSessionMeta(input: {
  id: string;
  now: string;
  specId: string | null;
  title: string;
}): ProjectSessionMeta {
  return {
    schemaVersion: PROJECT_SESSION_SCHEMA_VERSION,
    id: input.id,
    specId: input.specId,
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
  attachments?: ProjectSessionMessageAttachmentManifest[];
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
    attachments: sanitizeProjectSessionMessageAttachments(input.attachments ?? []),
  };
}

export function toPersistedProjectSessionMessage(
  message: ProjectSessionMessage,
): ProjectSessionMessage {
  return {
    ...message,
    attachments: sanitizeProjectSessionMessageAttachments(message.attachments),
  };
}

export function createIdleProjectSessionMessageRunStatus(input: {
  rootPath: string;
  sessionId: string;
}): ProjectSessionMessageRunStatus {
  return {
    rootPath: input.rootPath,
    sessionId: input.sessionId,
    status: 'idle',
    stepIndex: 0,
    stepTotal: 3,
    stageMessage: '대기 중',
    progressMessage: null,
    requestText: null,
    requestSummary: null,
    attachmentCount: 0,
    requestAttachments: [],
    startedAt: null,
    updatedAt: null,
    completedAt: null,
    lastError: null,
  };
}

export function createDefaultProjectSessionTitle(input: { sequenceNumber: number }): string {
  return `새 대화 ${String(input.sequenceNumber).padStart(2, '0')}`;
}

export function createNextProjectSessionMetaAfterMessage(input: {
  attachments?: readonly Pick<ProjectSessionMessageAttachmentManifest, 'name'>[];
  current: ProjectSessionMeta;
  now: string;
  text: string;
}): ProjectSessionMeta {
  return {
    ...input.current,
    updatedAt: input.now,
    revision: input.current.revision + 1,
    lastMessageAt: input.now,
    lastMessagePreview: createProjectSessionMessagePreview({
      attachments: input.attachments ?? [],
      text: input.text,
    }),
    messageCount: input.current.messageCount + 1,
  };
}

export function createProjectSessionAttachmentSummary(
  attachments: readonly Pick<ProjectSessionMessageAttachmentManifest, 'name'>[],
): string | null {
  if (attachments.length === 0) {
    return null;
  }

  if (attachments.length === 1) {
    return `[첨부 1개] ${attachments[0]?.name ?? '파일'}`;
  }

  const firstAttachmentName = attachments[0]?.name ?? '파일';
  return `[첨부 ${attachments.length}개] ${firstAttachmentName} 외 ${attachments.length - 1}개`;
}

export function createProjectSessionMessagePreview(input: {
  attachments?: readonly Pick<ProjectSessionMessageAttachmentManifest, 'name'>[];
  text: string;
}): string | null {
  const textPreview = normalizeProjectSessionMessagePreviewText(input.text);
  const attachmentSummary = createProjectSessionAttachmentSummary(input.attachments ?? []);

  if (textPreview && attachmentSummary) {
    return clampProjectSessionMessagePreview(
      `${textPreview} [첨부 ${(input.attachments ?? []).length}개]`,
    );
  }

  return textPreview ?? attachmentSummary;
}

export function toProjectSessionSummary(meta: ProjectSessionMeta): ProjectSessionSummary {
  return {
    id: meta.id,
    specId: meta.specId,
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
    (candidate.schemaVersion === PROJECT_SESSION_SCHEMA_VERSION ||
      candidate.schemaVersion === LEGACY_PROJECT_SESSION_SCHEMA_VERSION) &&
    typeof candidate.id === 'string' &&
    (typeof candidate.specId === 'string' ||
      candidate.specId === null ||
      typeof candidate.specId === 'undefined') &&
    typeof candidate.title === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    typeof candidate.revision === 'number' &&
    (typeof candidate.lastMessageAt === 'string' || candidate.lastMessageAt === null) &&
    (typeof candidate.lastMessagePreview === 'string' || candidate.lastMessagePreview === null) &&
    typeof candidate.messageCount === 'number'
  );
}

export function normalizeProjectSessionMeta(value: unknown): ProjectSessionMeta | null {
  if (!isProjectSessionMeta(value)) {
    return null;
  }

  const candidate = value as ProjectSessionMeta & { specId?: string | null };

  return {
    ...candidate,
    schemaVersion: PROJECT_SESSION_SCHEMA_VERSION,
    specId: candidate.specId ?? null,
  };
}

export function normalizeProjectSessionMessage(value: unknown): ProjectSessionMessage | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    (candidate.schemaVersion !== PROJECT_SESSION_MESSAGE_SCHEMA_VERSION &&
      candidate.schemaVersion !== LEGACY_PROJECT_SESSION_MESSAGE_SCHEMA_VERSION) ||
    typeof candidate.id !== 'string' ||
    typeof candidate.sessionId !== 'string' ||
    typeof candidate.createdAt !== 'string' ||
    (candidate.role !== 'system' && candidate.role !== 'user' && candidate.role !== 'assistant') ||
    typeof candidate.text !== 'string'
  ) {
    return null;
  }

  const normalizedAttachments = normalizeProjectSessionMessageAttachments(
    candidate.attachments,
    candidate.schemaVersion,
  );
  if (!normalizedAttachments) {
    return null;
  }

  return {
    schemaVersion: PROJECT_SESSION_MESSAGE_SCHEMA_VERSION,
    id: candidate.id,
    sessionId: candidate.sessionId,
    createdAt: candidate.createdAt,
    role: candidate.role,
    text: candidate.text,
    attachments: normalizedAttachments,
  };
}

export function isProjectSessionMessage(value: unknown): value is ProjectSessionMessage {
  return normalizeProjectSessionMessage(value) !== null;
}

export function resolveProjectSessionMessageAttachmentKind(input: {
  mimeType: string;
  name: string;
}): ProjectSessionMessageAttachmentKind | null {
  const extension = getProjectSessionMessageAttachmentExtension(input.name);
  if (
    extension &&
    PROJECT_SESSION_MESSAGE_ATTACHMENT_IMAGE_EXTENSIONS.includes(
      extension as (typeof PROJECT_SESSION_MESSAGE_ATTACHMENT_IMAGE_EXTENSIONS)[number],
    )
  ) {
    return 'image';
  }

  if (
    extension &&
    PROJECT_SESSION_MESSAGE_ATTACHMENT_TEXT_EXTENSIONS.includes(
      extension as (typeof PROJECT_SESSION_MESSAGE_ATTACHMENT_TEXT_EXTENSIONS)[number],
    )
  ) {
    return 'file';
  }

  const normalizedMimeType = normalizeMimeType(input.mimeType);
  if (PROJECT_SESSION_ATTACHMENT_IMAGE_MIME_TYPE_MAP.has(normalizedMimeType)) {
    return 'image';
  }

  if (!extension && PROJECT_SESSION_ATTACHMENT_TEXT_MIME_TYPE_MAP.has(normalizedMimeType)) {
    return 'file';
  }

  return null;
}

export function getProjectSessionMessageAttachmentExtensionFromMimeType(
  mimeType: string,
): string | null {
  const normalizedMimeType = normalizeMimeType(mimeType);
  return (
    PROJECT_SESSION_ATTACHMENT_IMAGE_MIME_TYPE_MAP.get(normalizedMimeType) ??
    PROJECT_SESSION_ATTACHMENT_TEXT_MIME_TYPE_MAP.get(normalizedMimeType) ??
    null
  );
}

export function validateProjectSessionMessageAttachmentSelection(input: {
  candidates: readonly ProjectSessionMessageAttachmentCandidate[];
  existingAttachments?: readonly Pick<ProjectSessionMessageAttachmentCandidate, 'sizeBytes'>[];
}): {
  accepted: ProjectSessionValidatedMessageAttachmentCandidate[];
  rejected: ProjectSessionMessageAttachmentValidationIssue[];
} {
  const accepted: ProjectSessionValidatedMessageAttachmentCandidate[] = [];
  const rejected: ProjectSessionMessageAttachmentValidationIssue[] = [];
  const existingAttachments = input.existingAttachments ?? [];
  let totalSizeBytes = existingAttachments.reduce(
    (sum, attachment) => sum + attachment.sizeBytes,
    0,
  );
  let totalCount = existingAttachments.length;

  for (const candidate of input.candidates) {
    const kind = resolveProjectSessionMessageAttachmentKind({
      mimeType: candidate.mimeType,
      name: candidate.name,
    });
    if (!kind) {
      rejected.push({
        candidate,
        code: 'unsupported-type',
      });
      continue;
    }

    if (candidate.sizeBytes > PROJECT_SESSION_MESSAGE_ATTACHMENT_LIMITS.maxSizeBytes) {
      rejected.push({
        candidate,
        code: 'file-too-large',
      });
      continue;
    }

    if (totalCount + 1 > PROJECT_SESSION_MESSAGE_ATTACHMENT_LIMITS.maxCount) {
      rejected.push({
        candidate,
        code: 'too-many-attachments',
      });
      continue;
    }

    if (
      totalSizeBytes + candidate.sizeBytes >
      PROJECT_SESSION_MESSAGE_ATTACHMENT_LIMITS.maxTotalSizeBytes
    ) {
      rejected.push({
        candidate,
        code: 'total-size-too-large',
      });
      continue;
    }

    accepted.push({
      candidate,
      kind,
    });
    totalCount += 1;
    totalSizeBytes += candidate.sizeBytes;
  }

  return {
    accepted,
    rejected,
  };
}

export function describeProjectSessionMessageAttachmentValidationIssue(
  issue: ProjectSessionMessageAttachmentValidationIssue,
): string {
  const fileName = issue.candidate.name.trim() || '이 첨부';

  switch (issue.code) {
    case 'unsupported-type':
      return `${fileName}: 지원하지 않는 형식입니다.`;
    case 'file-too-large':
      return `${fileName}: 파일당 20MB까지 보낼 수 있습니다.`;
    case 'total-size-too-large':
      return `${fileName}: 첨부 총합은 30MB까지 보낼 수 있습니다.`;
    case 'too-many-attachments':
      return `${fileName}: 한 번에 5개까지 첨부할 수 있습니다.`;
  }
}

function normalizeProjectSessionMessageAttachments(
  value: unknown,
  schemaVersion: unknown,
): ProjectSessionMessageAttachmentManifest[] | null {
  if (schemaVersion === LEGACY_PROJECT_SESSION_MESSAGE_SCHEMA_VERSION) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const normalizedAttachments: ProjectSessionMessageAttachmentManifest[] = [];
  for (const item of value) {
    const normalizedAttachment = normalizeProjectSessionMessageAttachmentManifest(item);
    if (!normalizedAttachment) {
      return null;
    }

    normalizedAttachments.push(normalizedAttachment);
  }

  return normalizedAttachments;
}

function normalizeProjectSessionMessageAttachmentManifest(
  value: unknown,
): ProjectSessionMessageAttachmentManifest | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    (candidate.kind !== 'image' && candidate.kind !== 'file') ||
    (candidate.source !== 'paste' &&
      candidate.source !== 'drop' &&
      candidate.source !== 'picker') ||
    typeof candidate.name !== 'string' ||
    typeof candidate.mimeType !== 'string' ||
    typeof candidate.sizeBytes !== 'number' ||
    candidate.sizeBytes < 0 ||
    typeof candidate.relativePath !== 'string' ||
    !candidate.relativePath.startsWith('attachments/') ||
    typeof candidate.createdAt !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    kind: candidate.kind,
    source: candidate.source,
    name: candidate.name,
    mimeType: candidate.mimeType,
    sizeBytes: candidate.sizeBytes,
    relativePath: candidate.relativePath,
    createdAt: candidate.createdAt,
  };
}

function sanitizeProjectSessionMessageAttachments(
  attachments: readonly ProjectSessionMessageAttachmentManifest[],
): ProjectSessionMessageAttachmentManifest[] {
  return attachments.map((attachment) => ({
    id: attachment.id,
    kind: attachment.kind,
    source: attachment.source,
    name: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    relativePath: attachment.relativePath,
    createdAt: attachment.createdAt,
  }));
}

function normalizeProjectSessionMessagePreviewText(text: string): string | null {
  const normalized = text.replaceAll(/\s+/gu, ' ').trim();
  if (normalized.length === 0) {
    return null;
  }

  return clampProjectSessionMessagePreview(normalized);
}

function clampProjectSessionMessagePreview(value: string): string {
  return value.length > SESSION_MESSAGE_PREVIEW_MAX_LENGTH
    ? `${value.slice(0, SESSION_MESSAGE_PREVIEW_MAX_LENGTH - 3)}...`
    : value;
}

function getProjectSessionMessageAttachmentExtension(name: string): string | null {
  const trimmedName = name.trim();
  const lastDotIndex = trimmedName.lastIndexOf('.');
  if (lastDotIndex < 0 || lastDotIndex === trimmedName.length - 1) {
    return null;
  }

  return trimmedName.slice(lastDotIndex + 1).toLowerCase();
}

function normalizeMimeType(mimeType: string): string {
  return mimeType.trim().toLowerCase();
}
