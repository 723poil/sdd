import type { ProjectAnalysis } from '@/domain/project/project-analysis-model';
import type { ProjectInspection } from '@/domain/project/project-model';

import type {
  AnalysisPreviewModel,
  StatusBadgeModel,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

export function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);

  if (typeof movedItem === 'undefined') {
    return items;
  }

  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
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

export function getNextStepLabel(
  input: {
    canAnalyze: boolean;
    canInitialize: boolean;
    inspection: ProjectInspection | null;
    sessionCount: number;
  },
): string {
  const { canAnalyze, canInitialize, inspection, sessionCount } = input;

  if (!inspection) {
    return '프로젝트 선택';
  }

  if (!inspection.isWritable && inspection.initializationState !== 'ready') {
    return '쓰기 권한 확인';
  }

  if (canInitialize) {
    return '작업 공간 준비';
  }

  if (canAnalyze && !inspection.projectMeta?.lastAnalyzedAt) {
    return '기본 분석 실행';
  }

  if (inspection.projectMeta?.lastAnalyzedAt) {
    if (sessionCount === 0) {
      return '대화 세션 만들기';
    }

    return '명세 작업 준비';
  }

  return '상태 확인';
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

export function getAnalysisPreview(input: {
  analysis: ProjectAnalysis | null;
  inspection: ProjectInspection | null;
  isAnalyzing: boolean;
}): AnalysisPreviewModel {
  const { analysis, inspection, isAnalyzing } = input;

  if (!inspection) {
    return {
      title: '분석 전',
      description: '프로젝트를 먼저 선택하면 작업 공간 준비와 기본 분석으로 이어갈 수 있습니다.',
      note: '다음 단계: 프로젝트 선택',
      sections: [],
    };
  }

  if (inspection.initializationState !== 'ready') {
    return {
      title: '분석 준비 필요',
      description: '먼저 작업 공간 준비를 완료해야 분석 결과를 저장하고 이어서 사용할 수 있습니다.',
      note: '다음 단계: 작업 공간 준비',
      sections: [],
    };
  }

  if (isAnalyzing) {
    return {
      title: '기본 분석 실행 중',
      description: '프로젝트 구조, 진입점, 주요 설정 파일을 읽고 있습니다.',
      note: '잠시만 기다리면 결과가 여기에 표시됩니다.',
      sections: [],
    };
  }

  if (!inspection.projectMeta?.lastAnalyzedAt || !analysis) {
    return {
      title: '아직 분석 기록이 없습니다',
      description: '기본 분석을 실행하면 핵심 모듈, 엔트리포인트, 설정 파일이 정리됩니다.',
      note: '다음 단계: 기본 분석 실행',
      sections: [],
    };
  }

  return {
    title: '기본 분석 결과',
    description:
      inspection.projectMeta.detectedStack.length > 0
        ? `감지한 스택: ${inspection.projectMeta.detectedStack.join(', ')}`
        : '핵심 구조 정보를 정리했습니다.',
    note:
      analysis.context.unknowns[0] ??
      `분석 신뢰도 ${Math.round(analysis.context.confidence * 100)}% 기준으로 정리되었습니다.`,
    sections: [
      {
        label: '엔트리포인트',
        values: analysis.context.entrypoints.slice(0, 4),
      },
      {
        label: '주요 설정',
        values: analysis.context.keyConfigs.slice(0, 4),
      },
      {
        label: '핵심 모듈',
        values: analysis.context.modules.slice(0, 4),
      },
    ].filter((section) => section.values.length > 0),
  };
}
