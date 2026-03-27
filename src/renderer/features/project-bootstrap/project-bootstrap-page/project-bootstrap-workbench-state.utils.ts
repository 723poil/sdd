import type { ProjectAnalysisRunStatus } from '@/domain/project/project-analysis-model';
import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
import type {
  ProjectSessionMessage,
  ProjectSessionMessagePendingAttachment,
  ProjectSessionMessageRunStatus,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';
import type { AppError } from '@/shared/contracts/app-error';

export function replaceRecordValue<T>(
  current: Record<string, T>,
  key: string,
  value: T | null,
): Record<string, T> {
  const next = { ...current };
  if (value === null) {
    delete next[key];
    return next;
  }

  next[key] = value;
  return next;
}

export function createRunningProjectAnalysisRunStatus(input: {
  rootPath: string;
  startedAt: string;
  stageMessage: string;
  progressMessage: string;
  stepIndex: number;
  stepTotal: number;
}): ProjectAnalysisRunStatus {
  return {
    rootPath: input.rootPath,
    status: 'running',
    stepIndex: input.stepIndex,
    stepTotal: input.stepTotal,
    stageMessage: input.stageMessage,
    progressMessage: input.progressMessage,
    startedAt: input.startedAt,
    updatedAt: input.startedAt,
    completedAt: null,
    lastError: null,
  };
}

export function createRunningProjectSessionMessageRunStatus(input: {
  attachmentCount: number;
  progressMessage: string;
  requestAttachments: ProjectSessionMessagePendingAttachment[];
  requestSummary: string | null;
  requestText: string | null;
  rootPath: string;
  sessionId: string;
  startedAt: string;
  stageMessage: string;
}): ProjectSessionMessageRunStatus {
  return {
    rootPath: input.rootPath,
    sessionId: input.sessionId,
    status: 'running',
    stepIndex: 1,
    stepTotal: 3,
    stageMessage: input.stageMessage,
    progressMessage: input.progressMessage,
    requestText: input.requestText,
    requestSummary: input.requestSummary,
    attachmentCount: input.attachmentCount,
    requestAttachments: input.requestAttachments,
    startedAt: input.startedAt,
    updatedAt: input.startedAt,
    completedAt: null,
    lastError: null,
  };
}

export function createFailedProjectSessionMessageRunStatus(input: {
  attachmentCount: number;
  completedAt: string;
  lastError: string;
  progressMessage: string | null;
  requestAttachments: ProjectSessionMessagePendingAttachment[];
  requestSummary: string | null;
  requestText: string | null;
  rootPath: string;
  sessionId: string;
  startedAt: string;
  stageMessage: string;
  stepIndex: number;
  stepTotal: number;
}): ProjectSessionMessageRunStatus {
  return {
    rootPath: input.rootPath,
    sessionId: input.sessionId,
    status: 'failed',
    stepIndex: input.stepIndex,
    stepTotal: input.stepTotal,
    stageMessage: input.stageMessage,
    progressMessage: input.progressMessage,
    requestText: input.requestText,
    requestSummary: input.requestSummary,
    attachmentCount: input.attachmentCount,
    requestAttachments: input.requestAttachments,
    startedAt: input.startedAt,
    updatedAt: input.completedAt,
    completedAt: input.completedAt,
    lastError: input.lastError,
  };
}

export function createCancelledProjectSessionMessageRunStatus(input: {
  completedAt: string;
  current: ProjectSessionMessageRunStatus;
}): ProjectSessionMessageRunStatus {
  return {
    ...input.current,
    status: 'cancelled',
    stepIndex: 2,
    stepTotal: 3,
    stageMessage: '요청 취소됨',
    progressMessage: '응답 생성을 취소했습니다.',
    requestText: null,
    requestSummary: null,
    attachmentCount: 0,
    requestAttachments: [],
    updatedAt: input.completedAt,
    completedAt: input.completedAt,
    lastError: null,
  };
}

export function createCancellingProjectSessionMessageRunStatus(input: {
  current: ProjectSessionMessageRunStatus;
  updatedAt: string;
}): ProjectSessionMessageRunStatus {
  return {
    ...input.current,
    status: 'cancelling',
    stageMessage: '요청 취소 중',
    progressMessage: '응답 생성을 종료하고 있습니다.',
    updatedAt: input.updatedAt,
    completedAt: null,
    lastError: null,
  };
}

export function upsertProjectSpec(
  specs: ProjectSpecDocument[],
  nextSpec: ProjectSpecDocument,
): ProjectSpecDocument[] {
  const didExist = specs.some((spec) => spec.meta.id === nextSpec.meta.id);
  const mergedSpecs = didExist
    ? specs.map((spec) => (spec.meta.id === nextSpec.meta.id ? nextSpec : spec))
    : [...specs, nextSpec];

  return [...mergedSpecs].sort((left, right) =>
    right.meta.updatedAt.localeCompare(left.meta.updatedAt),
  );
}

export function upsertProjectSessionSummary(
  sessions: ProjectSessionSummary[],
  nextSession: {
    id: string;
    specId: string | null;
    title: string;
    updatedAt: string;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    messageCount: number;
  },
): ProjectSessionSummary[] {
  const didExist = sessions.some((session) => session.id === nextSession.id);
  const mergedSessions = didExist
    ? sessions.map((session) => (session.id === nextSession.id ? { ...nextSession } : session))
    : [...sessions, { ...nextSession }];

  return [...mergedSessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function mergeProjectSessionMessages(
  currentMessages: ProjectSessionMessage[],
  nextMessages: ProjectSessionMessage[],
): ProjectSessionMessage[] {
  const seenMessageIds = new Set(currentMessages.map((message) => message.id));
  const mergedMessages = [...currentMessages];

  for (const message of nextMessages) {
    if (seenMessageIds.has(message.id)) {
      continue;
    }

    seenMessageIds.add(message.id);
    mergedMessages.push(message);
  }

  return [...mergedMessages].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function formatAppErrorMessage(error: AppError): string {
  if (!error.details || error.details.trim().length === 0) {
    return error.message;
  }

  return `${error.message}\n${error.details.trim()}`;
}
