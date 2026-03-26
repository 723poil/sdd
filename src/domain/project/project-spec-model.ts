import type { SPEC_INDEX_SCHEMA_VERSION } from '@/domain/project/project-model';

export const LEGACY_PROJECT_SPEC_SCHEMA_VERSION = 1;
export const PROJECT_SPEC_SCHEMA_VERSION = 2;
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

export interface LegacyProjectSpecMeta {
  schemaVersion: typeof LEGACY_PROJECT_SPEC_SCHEMA_VERSION;
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

export interface ProjectSpecMeta {
  schemaVersion: typeof PROJECT_SPEC_SCHEMA_VERSION;
  id: string;
  slug: string;
  title: string;
  status: ProjectSpecStatus;
  createdAt: string;
  updatedAt: string;
  revision: number;
  latestVersion: string | null;
  currentVersion: string | null;
  draftMarkdown: string;
  summary: string | null;
}

export interface ProjectSpecSummary {
  id: string;
  slug: string;
  title: string;
  status: ProjectSpecStatus;
  latestVersion: string | null;
  currentVersion: string | null;
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

export interface ProjectSpecSaveSavedResult {
  kind: 'saved';
  previousVersionId: string | null;
  spec: ProjectSpecDocument;
  versionId: string;
}

export interface ProjectSpecSaveNoOpResult {
  kind: 'no-op';
  spec: ProjectSpecDocument;
  versionId: string | null;
}

export interface ProjectSpecSaveConflictResult {
  kind: 'conflict';
  latestRevision: number;
  latestVersionId: string | null;
  spec: ProjectSpecDocument;
}

export type ProjectSpecSaveResult =
  | ProjectSpecSaveSavedResult
  | ProjectSpecSaveNoOpResult
  | ProjectSpecSaveConflictResult;

export interface ProjectSpecVersionHistoryEntry {
  canApply: boolean;
  canDelete: boolean;
  createdAt: string;
  isCurrent: boolean;
  isLatest: boolean;
  summary: string | null;
  title: string;
  versionId: string;
}

export interface ProjectSpecVersionDocument {
  createdAt: string;
  isCurrent: boolean;
  isLatest: boolean;
  markdown: string;
  summary: string | null;
  title: string;
  versionId: string;
}

export interface ProjectSpecVersionDiffLine {
  currentLineNumber: number | null;
  type: 'added' | 'context' | 'removed';
  value: string;
  versionLineNumber: number | null;
}

export interface ProjectSpecVersionDiff {
  current: {
    markdown: string;
    title: string;
    versionId: string | null;
  };
  hasChanges: boolean;
  lines: ProjectSpecVersionDiffLine[];
  summary: {
    addedLineCount: number;
    removedLineCount: number;
  };
  version: ProjectSpecVersionDocument;
}

export interface ProjectSpecApplyVersionAppliedResult {
  appliedVersionId: string;
  kind: 'applied';
  spec: ProjectSpecDocument;
}

export interface ProjectSpecApplyVersionNoOpResult {
  appliedVersionId: string;
  kind: 'no-op';
  spec: ProjectSpecDocument;
}

export interface ProjectSpecApplyVersionConflictResult {
  appliedVersionId: string;
  kind: 'conflict';
  latestRevision: number;
  latestVersionId: string | null;
  spec: ProjectSpecDocument;
}

export type ProjectSpecApplyVersionResult =
  | ProjectSpecApplyVersionAppliedResult
  | ProjectSpecApplyVersionNoOpResult
  | ProjectSpecApplyVersionConflictResult;

export interface ProjectSpecDeleteVersionDeletedResult {
  deletedVersionId: string;
  history: ProjectSpecVersionHistoryEntry[];
  kind: 'deleted';
}

export interface ProjectSpecDeleteVersionConflictResult {
  deletedVersionId: string;
  kind: 'conflict';
  latestRevision: number;
  latestVersionId: string | null;
  spec: ProjectSpecDocument;
}

export type ProjectSpecDeleteVersionResult =
  | ProjectSpecDeleteVersionDeletedResult
  | ProjectSpecDeleteVersionConflictResult;

export function createProjectSpecMeta(input: {
  currentVersion?: string | null;
  draftMarkdown: string;
  id: string;
  latestVersion?: string | null;
  now: string;
  slug: string;
  summary: string | null;
  title: string;
}): ProjectSpecMeta {
  return {
    schemaVersion: PROJECT_SPEC_SCHEMA_VERSION,
    id: input.id,
    slug: input.slug,
    title: normalizeProjectSpecTitle(input.title),
    status: 'draft',
    createdAt: input.now,
    updatedAt: input.now,
    revision: 1,
    latestVersion: input.latestVersion ?? null,
    currentVersion: input.currentVersion ?? null,
    draftMarkdown: input.draftMarkdown,
    summary: input.summary,
  };
}

export function createProjectSpecDocument(meta: ProjectSpecMeta): ProjectSpecDocument {
  return {
    meta,
    markdown: meta.draftMarkdown,
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

export function normalizeProjectSpecDraft(input: {
  markdown: string;
  summary?: string | null;
  title: string;
}): {
  markdown: string;
  summary: string | null;
  title: string;
} {
  const title = normalizeProjectSpecTitle(input.title);
  const markdown = normalizeProjectSpecMarkdown({
    markdown: input.markdown,
    title,
  });

  return {
    title,
    markdown,
    summary: input.summary?.trim() || extractProjectSpecSummary(markdown),
  };
}

export function replaceProjectSpecTitleHeading(input: {
  markdown: string;
  title: string;
}): string {
  return normalizeProjectSpecMarkdown(input);
}

export function extractProjectSpecTitle(markdown: string): string | null {
  const normalizedMarkdown = markdown.replaceAll('\r\n', '\n');

  for (const line of normalizedMarkdown.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }

    if (!trimmed.startsWith('# ')) {
      return null;
    }

    return normalizeProjectSpecTitle(trimmed.slice(2));
  }

  return null;
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

export function createNextProjectSpecVersionId(currentVersion: string | null): string {
  if (currentVersion === null) {
    return 'v1';
  }

  const matched = /^v(\d+)$/u.exec(currentVersion.trim());
  if (!matched) {
    return 'v1';
  }

  const currentNumber = Number(matched[1]);
  if (!Number.isFinite(currentNumber) || currentNumber < 1) {
    return 'v1';
  }

  return `v${currentNumber + 1}`;
}

export function createNextProjectSpecMeta(input: {
  current: ProjectSpecMeta;
  currentVersion: string | null;
  draftMarkdown: string;
  latestVersion: string | null;
  now: string;
  summary: string | null;
  title: string;
}): ProjectSpecMeta {
  return {
    ...input.current,
    title: normalizeProjectSpecTitle(input.title),
    latestVersion: input.latestVersion,
    currentVersion: input.currentVersion,
    draftMarkdown: input.draftMarkdown,
    updatedAt: input.now,
    revision: input.current.revision + 1,
    summary: input.summary,
  };
}

export function isProjectSpecStatus(value: unknown): value is ProjectSpecStatus {
  return typeof value === 'string' && PROJECT_SPEC_STATUSES.includes(value as ProjectSpecStatus);
}

export function isLegacyProjectSpecMeta(value: unknown): value is LegacyProjectSpecMeta {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.schemaVersion === LEGACY_PROJECT_SPEC_SCHEMA_VERSION &&
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
    (typeof candidate.latestVersion === 'string' || candidate.latestVersion === null) &&
    (typeof candidate.currentVersion === 'string' || candidate.currentVersion === null) &&
    typeof candidate.draftMarkdown === 'string' &&
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
    currentVersion: meta.currentVersion,
    updatedAt: meta.updatedAt,
    summary: meta.summary,
  };
}

export function createProjectSpecVersionDiff(input: {
  currentMarkdown: string;
  currentTitle: string;
  currentVersionId: string | null;
  version: ProjectSpecVersionDocument;
}): ProjectSpecVersionDiff {
  const current = normalizeProjectSpecDraft({
    markdown: input.currentMarkdown,
    title: input.currentTitle,
  });
  const version = normalizeProjectSpecDraft({
    markdown: input.version.markdown,
    title: input.version.title,
  });
  const lines = createLineDiff({
    currentLines: current.markdown.split('\n'),
    versionLines: version.markdown.split('\n'),
  });
  const addedLineCount = lines.filter((line) => line.type === 'added').length;
  const removedLineCount = lines.filter((line) => line.type === 'removed').length;

  return {
    current: {
      title: current.title,
      markdown: current.markdown,
      versionId: input.currentVersionId,
    },
    version: {
      ...input.version,
      title: version.title,
      markdown: version.markdown,
      summary: version.summary,
    },
    lines,
    hasChanges: addedLineCount > 0 || removedLineCount > 0,
    summary: {
      addedLineCount,
      removedLineCount,
    },
  };
}

function createLineDiff(input: {
  currentLines: string[];
  versionLines: string[];
}): ProjectSpecVersionDiffLine[] {
  const currentLength = input.currentLines.length;
  const versionLength = input.versionLines.length;
  const table = Array.from({ length: versionLength + 1 }, () =>
    Array.from({ length: currentLength + 1 }, () => 0),
  );

  for (let versionIndex = versionLength - 1; versionIndex >= 0; versionIndex -= 1) {
    for (let currentIndex = currentLength - 1; currentIndex >= 0; currentIndex -= 1) {
      if (input.versionLines[versionIndex] === input.currentLines[currentIndex]) {
        table[versionIndex]![currentIndex] = table[versionIndex + 1]![currentIndex + 1]! + 1;
      } else {
        table[versionIndex]![currentIndex] = Math.max(
          table[versionIndex + 1]![currentIndex] ?? 0,
          table[versionIndex]![currentIndex + 1] ?? 0,
        );
      }
    }
  }

  const lines: ProjectSpecVersionDiffLine[] = [];
  let versionIndex = 0;
  let currentIndex = 0;

  while (versionIndex < versionLength && currentIndex < currentLength) {
    const versionLine = input.versionLines[versionIndex];
    const currentLine = input.currentLines[currentIndex];

    if (versionLine === currentLine) {
      lines.push({
        type: 'context',
        value: versionLine ?? '',
        versionLineNumber: versionIndex + 1,
        currentLineNumber: currentIndex + 1,
      });
      versionIndex += 1;
      currentIndex += 1;
      continue;
    }

    const nextVersionScore = table[versionIndex + 1]?.[currentIndex] ?? 0;
    const nextCurrentScore = table[versionIndex]?.[currentIndex + 1] ?? 0;

    if (nextVersionScore >= nextCurrentScore) {
      lines.push({
        type: 'removed',
        value: versionLine ?? '',
        versionLineNumber: versionIndex + 1,
        currentLineNumber: null,
      });
      versionIndex += 1;
      continue;
    }

    lines.push({
      type: 'added',
      value: currentLine ?? '',
      versionLineNumber: null,
      currentLineNumber: currentIndex + 1,
    });
    currentIndex += 1;
  }

  while (versionIndex < versionLength) {
    lines.push({
      type: 'removed',
      value: input.versionLines[versionIndex] ?? '',
      versionLineNumber: versionIndex + 1,
      currentLineNumber: null,
    });
    versionIndex += 1;
  }

  while (currentIndex < currentLength) {
    lines.push({
      type: 'added',
      value: input.currentLines[currentIndex] ?? '',
      versionLineNumber: null,
      currentLineNumber: currentIndex + 1,
    });
    currentIndex += 1;
  }

  return lines;
}
