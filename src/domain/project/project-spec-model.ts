import type { SPEC_INDEX_SCHEMA_VERSION } from '@/domain/project/project-model';

export const PROJECT_SPEC_SCHEMA_VERSION = 1;
const DEFAULT_PROJECT_SPEC_TITLE = '새 명세';
const PROJECT_SPEC_SUMMARY_MAX_LENGTH = 180;

export const PROJECT_SPEC_STATUSES = ['draft', 'approved', 'archived'] as const;
export type ProjectSpecStatus = (typeof PROJECT_SPEC_STATUSES)[number];
export const PROJECT_SPEC_TEMPLATE_SECTION_TITLES = [
  '요약',
  '배경 / 문제',
  '목표',
  '비목표',
  '사용자 시나리오',
  '기능 요구사항',
  '비기능 요구사항',
  '참조 태그',
  '영향도 분석',
  '사용 스킬',
  '수용 기준',
  '오픈 질문',
] as const;

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
  const title = normalizeProjectSpecTitle(input.title);

  return [
    `# ${title}`,
    '',
    '## 요약',
    '',
    '- 해결하려는 기능 또는 문제를 한두 문장으로 정리합니다.',
    '',
    '## 배경 / 문제',
    '',
    '- 현재 사용자 또는 시스템이 겪는 문제를 적습니다.',
    '',
    '## 목표',
    '',
    '- 이번 명세에서 달성할 결과를 적습니다.',
    '',
    '## 비목표',
    '',
    '- 이번 변경에서 다루지 않을 범위를 적습니다.',
    '',
    '## 사용자 시나리오',
    '',
    '- 대표 사용자 흐름을 단계별로 적습니다.',
    '',
    '## 기능 요구사항',
    '',
    '- 구현해야 할 동작을 구체적으로 적습니다.',
    '',
    '## 비기능 요구사항',
    '',
    '- 성능, 안정성, 접근성, 저장 규칙 같은 제약을 적습니다.',
    '',
    '## 참조 태그',
    '',
    '- 기존 참조 태그: 확인 필요',
    '- 새 제안 태그: 필요 시 추가',
    '',
    '## 영향도 분석',
    '',
    '### 관련 파일 / 모듈',
    '',
    '- 참조 맵과 파일 인덱스를 바탕으로 관련 범위를 적습니다.',
    '',
    '### 예상 변경',
    '',
    '- 화면, 상태, 저장소, IPC, 문서 중 영향을 받는 지점을 적습니다.',
    '',
    '### 리스크 / 확인 필요',
    '',
    '- 불확실성, 선행 확인 사항, 충돌 가능성을 적습니다.',
    '',
    '## 사용 스킬',
    '',
    '- AGENTS.md 와 `.codex/skills/`를 확인해 이번 명세에 사용할 스킬을 적습니다.',
    '',
    '## 수용 기준',
    '',
    '- 완료 판단 기준을 체크리스트로 적습니다.',
    '',
    '## 오픈 질문',
    '',
    '- 아직 결정되지 않은 항목을 적습니다.',
  ].join('\n');
}

export function normalizeProjectSpecTitle(value: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : DEFAULT_PROJECT_SPEC_TITLE;
}

export function normalizeProjectSpecMarkdown(input: { markdown: string; title: string }): string {
  const normalizedTitle = normalizeProjectSpecTitle(input.title);
  const normalizedMarkdown = input.markdown.replaceAll('\r\n', '\n').trim();

  if (normalizedMarkdown.length === 0) {
    return createInitialProjectSpecMarkdown({
      title: normalizedTitle,
    });
  }

  const lines = normalizedMarkdown.split('\n');
  const contentLines = [...lines];

  while (contentLines[0]?.trim().length === 0) {
    contentLines.shift();
  }

  if (contentLines[0]?.startsWith('# ')) {
    contentLines[0] = `# ${normalizedTitle}`;
  } else {
    contentLines.unshift(`# ${normalizedTitle}`, '');
  }

  return contentLines.join('\n');
}

export function replaceProjectSpecTitleHeading(input: {
  markdown: string;
  title: string;
}): string {
  return normalizeProjectSpecMarkdown(input);
}

export function extractProjectSpecSummary(markdown: string): string | null {
  const lines = markdown
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    if (line.startsWith('# ')) {
      continue;
    }

    const normalizedLine = line
      .replace(/^[-*]\s+/u, '')
      .replace(/^>\s*/u, '')
      .trim();

    if (normalizedLine.length === 0) {
      continue;
    }

    return normalizedLine.slice(0, PROJECT_SPEC_SUMMARY_MAX_LENGTH);
  }

  return null;
}

export function createNextProjectSpecVersionId(currentVersion: string): string {
  const matched = /^v(\d+)$/u.exec(currentVersion.trim());
  if (!matched) {
    return 'v2';
  }

  const currentNumber = Number(matched[1]);
  if (!Number.isFinite(currentNumber) || currentNumber < 1) {
    return 'v2';
  }

  return `v${currentNumber + 1}`;
}

export function createNextProjectSpecMeta(input: {
  current: ProjectSpecMeta;
  title: string;
  latestVersion: string;
  now: string;
  summary: string | null;
}): ProjectSpecMeta {
  return {
    ...input.current,
    title: normalizeProjectSpecTitle(input.title),
    latestVersion: input.latestVersion,
    updatedAt: input.now,
    revision: input.current.revision + 1,
    summary: input.summary,
  };
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
