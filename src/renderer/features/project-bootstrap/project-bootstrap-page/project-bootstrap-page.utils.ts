import type { ProjectInspection } from '@/domain/project/project-model';
import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
import type {
  ProjectSessionMessageRunStatus,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';

import type { StatusBadgeModel } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';
import type { ProjectAnalysisRunStatus } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

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

export function createProjectSessionStateKey(input: {
  rootPath: string;
  sessionId: string;
}): string {
  return `${input.rootPath}::${input.sessionId}`;
}

export function resolveSelectedSpec(
  specs: ProjectSpecDocument[],
  selectedSpecId: string | null,
): ProjectSpecDocument | null {
  return specs.find((spec) => spec.meta.id === selectedSpecId) ?? specs[0] ?? null;
}

export function describeInitializationState(inspection: ProjectInspection | null): string {
  if (!inspection) {
    return '프로젝트를 선택하면 이 작업 공간에서 바로 이어서 진행할 수 있습니다.';
  }

  if (inspection.initializationState === 'ready' && inspection.projectMeta?.lastAnalyzedAt) {
    return '분석 결과가 준비되어 있습니다. 구조 문서를 확인한 뒤 다음 작업으로 이어가면 됩니다.';
  }

  if (inspection.initializationState === 'ready') {
    return '이 프로젝트는 바로 사용할 수 있습니다. 이제 전체 분석이나 참조 분석을 실행할 수 있습니다.';
  }

  if (!inspection.isWritable) {
    return '이 경로에는 쓰기 권한이 없습니다. 전체 분석과 저장은 막히지만, 참조 분석은 저장 없이 실행할 수 있습니다.';
  }

  return '이 프로젝트에는 아직 저장용 작업 공간 정보가 없습니다.';
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
      label: '프로젝트 준비됨',
      tone: 'positive',
    };
  }

  if (!inspection.isWritable) {
    return {
      label: '읽기 전용',
      tone: 'warning',
    };
  }

  return {
    label: '저장 공간 없음',
    tone: 'warning',
  };
}

export function getAnalysisStatus(input: {
  inspection: ProjectInspection | null;
  analysisRunStatus: ProjectAnalysisRunStatus | null;
}): StatusBadgeModel {
  const { inspection, analysisRunStatus } = input;

  if (!inspection) {
    return {
      label: '프로젝트 필요',
      tone: 'neutral',
    };
  }

  if (inspection.initializationState !== 'ready' && !inspection.isWritable) {
    return {
      label: '참조 분석만 가능',
      tone: 'warning',
    };
  }

  if (inspection.initializationState !== 'ready') {
    return {
      label: '저장 공간 없음',
      tone: 'warning',
    };
  }

  if (analysisRunStatus?.status === 'running') {
    return { label: '분석 중', tone: 'neutral' };
  }

  if (analysisRunStatus?.status === 'cancelling') {
    return { label: '분석 취소 중', tone: 'neutral' };
  }

  if (analysisRunStatus?.status === 'cancelled') {
    return { label: '분석 취소됨', tone: 'neutral' };
  }

  if (analysisRunStatus?.status === 'failed') {
    return { label: '분석 실패', tone: 'warning' };
  }

  if (analysisRunStatus?.status === 'succeeded' || inspection.projectMeta?.lastAnalyzedAt) {
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

export function getVisibleAnalysisRunStatus(
  analysisRunStatus: ProjectAnalysisRunStatus | null,
): ProjectAnalysisRunStatus | null {
  if (!analysisRunStatus) {
    return null;
  }

  if (analysisRunStatus.status === 'idle') {
    return null;
  }

  return analysisRunStatus;
}

export function getVisibleSessionMessageRunStatus(
  sessionMessageRunStatus: ProjectSessionMessageRunStatus | null,
): ProjectSessionMessageRunStatus | null {
  if (!sessionMessageRunStatus) {
    return null;
  }

  if (
    sessionMessageRunStatus.status === 'idle' ||
    sessionMessageRunStatus.status === 'succeeded'
  ) {
    return null;
  }

  return sessionMessageRunStatus;
}
