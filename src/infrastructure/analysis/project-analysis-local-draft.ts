import {
  createProjectAnalysisDocument,
  type ProjectAnalysisDocument,
  type ProjectAnalysisDocumentId,
  type ProjectAnalysisDraft,
} from '@/domain/project/project-analysis-model';

import { createProjectAnalysisDetection } from '@/infrastructure/analysis/project-analysis-detection';
import {
  analyzeLocalProjectReferences,
  type LocalProjectReferenceAnalysis,
} from '@/infrastructure/analysis/project-analysis-local-reference-extractor';
import {
  createEmptyProjectAnalysisScanState,
  scanProjectAnalysis,
} from '@/infrastructure/analysis/project-analysis-scanner';
import { createProjectAnalysisSummaryMarkdown } from '@/infrastructure/analysis/project-analysis-summary';

const DEFAULT_DOCUMENT_LINKS: Array<{
  from: ProjectAnalysisDocumentId;
  label: string;
  reason: string;
  to: ProjectAnalysisDocumentId;
}> = [
  {
    from: 'overview',
    label: '목적',
    reason: '프로젝트 개요에서 목적 문서로 이어집니다.',
    to: 'purpose',
  },
  {
    from: 'overview',
    label: '구조',
    reason: '프로젝트 개요에서 구조 문서로 이어집니다.',
    to: 'structure',
  },
  {
    from: 'purpose',
    label: '책임',
    reason: '목적 문서에서 계층 책임 문서로 이어집니다.',
    to: 'layers',
  },
  {
    from: 'structure',
    label: '흐름',
    reason: '구조 문서에서 연결성 문서로 이어집니다.',
    to: 'connectivity',
  },
  {
    from: 'purpose',
    label: '참조',
    reason: '목적 문서에서 핵심 참조 문서로 이어집니다.',
    to: 'connectivity',
  },
];

export async function createLocalProjectAnalysisDraft(input: {
  projectName: string;
  rootPath: string;
}): Promise<ProjectAnalysisDraft> {
  const scanState = createEmptyProjectAnalysisScanState();
  await scanProjectAnalysis({
    currentPath: input.rootPath,
    depth: 0,
    rootPath: input.rootPath,
    scanState,
  });

  const detection = createProjectAnalysisDetection(scanState);
  const referenceAnalysis = await analyzeLocalProjectReferences({
    rootPath: input.rootPath,
    scanState,
  });
  const summaryMarkdown = createProjectAnalysisSummaryMarkdown({
    context: {
      ...detection.context,
      architectureSummary: createArchitectureSummary(referenceAnalysis),
      connections: referenceAnalysis.connections,
      directorySummaries: referenceAnalysis.directorySummaries,
      documentLinks: DEFAULT_DOCUMENT_LINKS,
      documentSummaries: [],
      fileReferences: referenceAnalysis.fileReferences,
      layers: referenceAnalysis.layers,
      projectPurpose: createProjectPurpose(detection.detectedFrameworks),
    },
    packageManager: scanState.packageManager,
    projectName: input.projectName,
  });

  const documents = buildLocalAnalysisDocuments({
    detectedFrameworks: detection.detectedFrameworks,
    projectName: input.projectName,
    referenceAnalysis,
    scanState,
    summaryMarkdown,
    unknowns: detection.unknowns,
  });

  return {
    context: {
      ...detection.context,
      architectureSummary: createArchitectureSummary(referenceAnalysis),
      connections: referenceAnalysis.connections,
      directorySummaries: referenceAnalysis.directorySummaries,
      documentLayouts: {},
      documentLinks: DEFAULT_DOCUMENT_LINKS,
      documentSummaries: documents.map((document) => ({
        id: document.id,
        summary: document.summary,
      })),
      fileReferences: referenceAnalysis.fileReferences,
      layers: referenceAnalysis.layers,
      projectPurpose: createProjectPurpose(detection.detectedFrameworks),
    },
    detectedStack: detection.detectedStack,
    documents,
    fileIndex: referenceAnalysis.fileIndex,
    summaryMarkdown,
  };
}

export function mergeProjectAnalysisWithLocalDraft(input: {
  codexDraft: ProjectAnalysisDraft;
  localDraft: ProjectAnalysisDraft;
}): ProjectAnalysisDraft {
  return {
    ...input.codexDraft,
    detectedStack: mergeStringLists(input.codexDraft.detectedStack, input.localDraft.detectedStack),
    context: {
      ...input.codexDraft.context,
      architectureSummary:
        input.codexDraft.context.architectureSummary.length > 0
          ? input.codexDraft.context.architectureSummary
          : input.localDraft.context.architectureSummary,
      connections:
        input.localDraft.context.connections.length > 0
          ? input.localDraft.context.connections
          : input.codexDraft.context.connections,
      directories: preferNonEmptyList(
        input.codexDraft.context.directories,
        input.localDraft.context.directories,
      ),
      detectedFrameworks: mergeStringLists(
        input.codexDraft.context.detectedFrameworks,
        input.localDraft.context.detectedFrameworks,
      ),
      entrypoints: preferNonEmptyList(
        input.codexDraft.context.entrypoints,
        input.localDraft.context.entrypoints,
      ),
      fileReferences: input.localDraft.context.fileReferences,
      files: preferNonEmptyList(input.codexDraft.context.files, input.localDraft.context.files),
      keyConfigs: preferNonEmptyList(
        input.codexDraft.context.keyConfigs,
        input.localDraft.context.keyConfigs,
      ),
      layers:
        input.localDraft.context.layers.length > 0
          ? input.localDraft.context.layers
          : input.codexDraft.context.layers,
      modules: preferNonEmptyList(input.codexDraft.context.modules, input.localDraft.context.modules),
      projectPurpose:
        input.codexDraft.context.projectPurpose.length > 0
          ? input.codexDraft.context.projectPurpose
          : input.localDraft.context.projectPurpose,
      unknowns: mergeStringLists(input.codexDraft.context.unknowns, input.localDraft.context.unknowns),
      directorySummaries:
        input.localDraft.context.directorySummaries.length > 0
          ? input.localDraft.context.directorySummaries
          : input.codexDraft.context.directorySummaries,
      confidence: Math.max(input.codexDraft.context.confidence, input.localDraft.context.confidence),
    },
    fileIndex: input.localDraft.fileIndex.length > 0 ? input.localDraft.fileIndex : input.codexDraft.fileIndex,
  };
}

function buildLocalAnalysisDocuments(input: {
  detectedFrameworks: string[];
  projectName: string;
  referenceAnalysis: LocalProjectReferenceAnalysis;
  scanState: {
    entrypoints: Set<string>;
    keyConfigs: Set<string>;
    modules: Set<string>;
  };
  summaryMarkdown: string;
  unknowns: string[];
}): ProjectAnalysisDocument[] {
  const importantReferences = input.referenceAnalysis.fileReferences.slice(0, 12);

  return [
    createProjectAnalysisDocument({
      id: 'overview',
      markdown: input.summaryMarkdown,
      summary: '감지한 스택과 핵심 진입점, 설정 파일을 정리한 개요입니다.',
    }),
    createProjectAnalysisDocument({
      id: 'purpose',
      markdown: [
        '# 목적과 사용자 가치',
        '',
        `- 자동 정적 분석 기준으로 보면 이 프로젝트는 ${
          input.detectedFrameworks.length > 0
            ? input.detectedFrameworks.join(', ')
            : '구조 확인이 필요한'
        } 코드베이스입니다.`,
        '- 사용자 가치나 도메인 목적은 정적 참조만으로 확정하지 않았습니다.',
        '',
        '## 확인한 단서',
        '',
        ...createBulletList(
          [...input.scanState.entrypoints].slice(0, 6),
          '진입점 후보를 자동으로 찾지 못했습니다.',
        ),
        '',
        '## 추가 확인 필요',
        '',
        ...createBulletList(input.unknowns, '추가 확인 필요 항목은 아직 없습니다.'),
        '',
      ].join('\n'),
      summary: '정적 분석으로 확인한 목적 단서와 불확실성을 정리했습니다.',
    }),
    createProjectAnalysisDocument({
      id: 'structure',
      markdown: [
        '# 구조와 주요 모듈',
        '',
        '## 주요 모듈 경로',
        '',
        ...createBulletList(
          [...input.scanState.modules].slice(0, 10),
          '자동으로 찾은 대표 모듈이 없습니다.',
        ),
        '',
        '## 주요 디렉터리',
        '',
        ...createBulletList(
          input.referenceAnalysis.directorySummaries.map(
            (directory) => `${directory.path}: ${directory.role}`,
          ),
          '요약 가능한 주요 디렉터리가 없습니다.',
        ),
        '',
      ].join('\n'),
      summary: '주요 모듈과 디렉터리 구조를 정리했습니다.',
    }),
    createProjectAnalysisDocument({
      id: 'layers',
      markdown: [
        '# 계층과 책임',
        '',
        ...createBulletList(
          input.referenceAnalysis.layers.map((layer) => {
            const dependsOn =
              layer.dependsOn.length > 0 ? `, 의존: ${layer.dependsOn.join(', ')}` : '';

            return `${layer.name}: ${layer.responsibility}${dependsOn}`;
          }),
          '명확한 계층 구분을 자동으로 확정하지 못했습니다.',
        ),
        '',
      ].join('\n'),
      summary: '경로 기반 계층과 의존 방향을 요약했습니다.',
    }),
    createProjectAnalysisDocument({
      id: 'connectivity',
      markdown: [
        '# 연결성과 데이터 흐름',
        '',
        '## 핵심 레이어 연결',
        '',
        ...createBulletList(
          input.referenceAnalysis.connections.map(
            (connection) =>
              `${connection.from} -> ${connection.to}: ${connection.relationship} (${connection.reason})`,
          ),
          '레이어 단위 연결 관계를 자동으로 정리하지 못했습니다.',
        ),
        '',
        '## 핵심 파일 참조',
        '',
        ...createBulletList(
          importantReferences.map(
            (reference) =>
              `${reference.from} -> ${reference.to}: ${reference.relationship} (${reference.reason})`,
          ),
          '핵심 파일 참조를 찾지 못했습니다.',
        ),
        '',
        '## 주요 설정 파일',
        '',
        ...createBulletList(
          [...input.scanState.keyConfigs].slice(0, 8),
          '자동으로 감지한 주요 설정 파일이 없습니다.',
        ),
        '',
      ].join('\n'),
      summary: '정적 참조 기반의 핵심 연결 관계를 정리했습니다.',
    }),
  ];
}

function createProjectPurpose(detectedFrameworks: string[]): string {
  if (detectedFrameworks.length === 0) {
    return '정적 분석만으로 프로젝트 목적을 확정하지 못했습니다.';
  }

  return `정적 분석 기준으로는 ${detectedFrameworks.join(', ')} 중심의 코드베이스로 보입니다. 도메인 목적은 추가 설명 없이 확정하지 않았습니다.`;
}

function createArchitectureSummary(referenceAnalysis: LocalProjectReferenceAnalysis): string {
  if (referenceAnalysis.layers.length === 0) {
    return '정적 분석 기준으로는 뚜렷한 계층을 확정하지 못했습니다.';
  }

  const layerNames = referenceAnalysis.layers.map((layer) => layer.name).join(', ');
  if (referenceAnalysis.connections.length === 0) {
    return `주요 경로는 ${layerNames} 중심으로 나뉘어 있습니다. 파일 간 정적 참조는 감지했지만 레이어 간 연결은 두드러지지 않았습니다.`;
  }

  return `주요 경로는 ${layerNames} 중심으로 나뉘어 있으며, 정적 참조 기준 연결 관계를 함께 저장합니다.`;
}

function createBulletList(values: string[], emptyMessage: string): string[] {
  if (values.length === 0) {
    return [`- ${emptyMessage}`];
  }

  return values.map((value) => `- ${value}`);
}

function mergeStringLists(primary: string[], secondary: string[]): string[] {
  return [...new Set([...primary, ...secondary])];
}

function preferNonEmptyList(primary: string[], fallback: string[]): string[] {
  return primary.length > 0 ? primary : fallback;
}

