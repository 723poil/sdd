import type { SPEC_INDEX_SCHEMA_VERSION } from '@/domain/project/project-model';

export const PROJECT_SPEC_SCHEMA_VERSION = 1;

export const PROJECT_SPEC_STATUSES = ['draft', 'approved', 'archived'] as const;
export type ProjectSpecStatus = (typeof PROJECT_SPEC_STATUSES)[number];

export interface ProjectSpecMeta {
  schemaVersion: typeof PROJECT_SPEC_SCHEMA_VERSION;
  id: string;
  slug: string;
  title: string;
  status: ProjectSpecStatus;
  createdAt: string;
  updatedAt: string;
  revision: number;
  latestVersion: string;
  summary: string | null;
}

export interface ProjectSpecSummary {
  id: string;
  slug: string;
  title: string;
  status: ProjectSpecStatus;
  latestVersion: string;
  updatedAt: string;
  summary: string | null;
}

export interface ProjectSpecDocument {
  meta: ProjectSpecMeta;
  markdown: string;
}

export interface ProjectSpecIndex {
  schemaVersion: typeof SPEC_INDEX_SCHEMA_VERSION;
  generatedAt: string;
  specs: ProjectSpecSummary[];
}

export function createProjectSpecMeta(input: {
  id: string;
  slug: string;
  title: string;
  now: string;
  latestVersion: string;
  summary: string | null;
}): ProjectSpecMeta {
  return {
    schemaVersion: PROJECT_SPEC_SCHEMA_VERSION,
    id: input.id,
    slug: input.slug,
    title: input.title,
    status: 'draft',
    createdAt: input.now,
    updatedAt: input.now,
    revision: 1,
    latestVersion: input.latestVersion,
    summary: input.summary,
  };
}

export function createDefaultProjectSpecTitle(input: { sequenceNumber: number }): string {
  return `새 명세 ${String(input.sequenceNumber).padStart(2, '0')}`;
}

export function createDefaultProjectSpecSlug(input: { sequenceNumber: number }): string {
  return `spec-${String(input.sequenceNumber).padStart(2, '0')}`;
}

export function createInitialProjectSpecMarkdown(input: { title: string }): string {
  return [
    `# ${input.title}`,
    '',
    '> 이 명세는 오른쪽 채팅으로 초안을 시작합니다.',
    '',
    '## 목적',
    '',
    '- 채팅으로 정리 예정',
    '',
    '## 사용자 흐름',
    '',
    '- 채팅으로 정리 예정',
    '',
    '## 범위',
    '',
    '- 채팅으로 정리 예정',
  ].join('\n');
}

export function isProjectSpecStatus(value: unknown): value is ProjectSpecStatus {
  return typeof value === 'string' && PROJECT_SPEC_STATUSES.includes(value as ProjectSpecStatus);
}

export function isProjectSpecMeta(value: unknown): value is ProjectSpecMeta {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.schemaVersion === PROJECT_SPEC_SCHEMA_VERSION &&
    typeof candidate.id === 'string' &&
    typeof candidate.slug === 'string' &&
    typeof candidate.title === 'string' &&
    isProjectSpecStatus(candidate.status) &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    typeof candidate.revision === 'number' &&
    typeof candidate.latestVersion === 'string' &&
    (typeof candidate.summary === 'string' || candidate.summary === null)
  );
}

export function toProjectSpecSummary(meta: ProjectSpecMeta): ProjectSpecSummary {
  return {
    id: meta.id,
    slug: meta.slug,
    title: meta.title,
    status: meta.status,
    latestVersion: meta.latestVersion,
    updatedAt: meta.updatedAt,
    summary: meta.summary,
  };
}
