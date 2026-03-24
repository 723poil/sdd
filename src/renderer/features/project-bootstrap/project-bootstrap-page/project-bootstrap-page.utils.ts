import type { ProjectInspection } from '@/domain/project/project-model';
import type { ProjectSessionSummary } from '@/domain/project/project-session-model';

import type { StatusBadgeModel } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

export function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);

  if (typeof movedItem === 'undefined') {
    return items;
  }

  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

export function resolveSelectedSession(
  sessions: ProjectSessionSummary[],
  selectedSessionId: string | null,
): ProjectSessionSummary | null {
  return sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null;
}

export function describeInitializationState(inspection: ProjectInspection | null): string {
  if (!inspection) {
    return '프로젝트를 선택하면 이 작업 공간에서 바로 이어서 진행할 수 있습니다.';
  }

  if (inspection.initializationState === 'ready' && inspection.projectMeta?.lastAnalyzedAt) {
    return '기본 분석 결과가 준비되어 있습니다. 확인 후 다음 작업으로 이어가면 됩니다.';
  }

  if (inspection.initializationState === 'ready') {
    return '이 프로젝트는 준비되었습니다. 이제 기본 분석을 실행할 수 있습니다.';
  }

  if (!inspection.isWritable) {
    return '이 경로에는 쓰기 권한이 없습니다. 권한을 확인해야 작업 공간을 만들 수 있습니다.';
  }

  return '이 프로젝트용 작업 공간을 만들기 위해 준비 작업이 필요합니다.';
}

export function getStorageStatus(inspection: ProjectInspection | null): StatusBadgeModel {
  if (!inspection) {
    return {
      label: '프로젝트 선택 필요',
      tone: 'neutral',
    };
  }

  if (inspection.initializationState === 'ready') {
    return {
      label: '작업 준비 완료',
      tone: 'positive',
    };
  }

  if (!inspection.isWritable) {
    return {
      label: '쓰기 권한 필요',
      tone: 'warning',
    };
  }

  return {
    label: '작업 공간 준비 필요',
    tone: 'warning',
  };
}

export function getAnalysisStatus(input: {
  inspection: ProjectInspection | null;
  isAnalyzing: boolean;
}): StatusBadgeModel {
  const { inspection, isAnalyzing } = input;

  if (!inspection) {
    return {
      label: '프로젝트 필요',
      tone: 'neutral',
    };
  }

  if (inspection.initializationState !== 'ready') {
    return {
      label: '작업 공간 필요',
      tone: 'warning',
    };
  }

  if (isAnalyzing) {
    return {
      label: '분석 중',
      tone: 'neutral',
    };
  }

  if (inspection.projectMeta?.lastAnalyzedAt) {
    return {
      label: '분석 완료',
      tone: 'positive',
    };
  }

  return {
    label: '분석 전',
    tone: 'neutral',
  };
}
