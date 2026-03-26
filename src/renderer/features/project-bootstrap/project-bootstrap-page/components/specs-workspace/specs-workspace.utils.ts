import type {
  ProjectSpecDocument,
  ProjectSpecRelationType,
} from '@/domain/project/project-spec-model';

export function resolveSelectedSpec(
  specs: ProjectSpecDocument[],
  selectedSpecId: string | null,
): ProjectSpecDocument | null {
  if (specs.length === 0) {
    return null;
  }

  return specs.find((spec) => spec.meta.id === selectedSpecId) ?? specs[0] ?? null;
}

export function describeSpecStatus(status: ProjectSpecDocument['meta']['status']): string {
  switch (status) {
    case 'draft':
      return '초안';
    case 'approved':
      return '확정';
    case 'archived':
      return '보관';
  }
}

export function describeSpecVersionBadge(spec: ProjectSpecDocument): string {
  if (!spec.meta.currentVersion) {
    return '작업 초안';
  }

  return spec.meta.currentVersion;
}

export function formatSpecDayLabel(value: string): string {
  return formatSpecTimestamp(value, {
    month: 'numeric',
    day: 'numeric',
  });
}

export function formatSpecDateTimeLabel(value: string): string {
  return formatSpecTimestamp(value, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getSpecSummary(spec: ProjectSpecDocument): string {
  return (
    spec.meta.summary ??
    `${describeSpecStatus(spec.meta.status)} · ${describeSpecVersionBadge(spec)} · 채팅과 문서 초안을 이어갈 수 있습니다.`
  );
}

function formatSpecTimestamp(value: string, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', options).format(date);
}

export function describeSpecRelationType(type: ProjectSpecRelationType): string {
  switch (type) {
    case 'derived-from':
      return '파생';
    case 'follow-up-to':
      return '후속 개발';
  }
}
