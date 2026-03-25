import {
  createProjectAnalysisDocument,
  type ProjectAnalysisDocument,
  type ProjectAnalysisConnection,
  type ProjectAnalysisDirectorySummary,
  type ProjectAnalysisDocumentId,
  type ProjectAnalysisDraft,
  type ProjectAnalysisFileIndexEntry,
  type ProjectAnalysisLayerSummary,
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
  const architectureSummary = createArchitectureSummary(referenceAnalysis);
  const projectPurpose = createProjectPurpose(detection.detectedFrameworks);
  const summaryMarkdown = createProjectAnalysisSummaryMarkdown({
    context: {
      ...detection.context,
      architectureSummary,
      connections: referenceAnalysis.connections,
      directorySummaries: referenceAnalysis.directorySummaries,
      documentLinks: DEFAULT_DOCUMENT_LINKS,
      documentSummaries: [],
      fileReferences: referenceAnalysis.fileReferences,
      layers: referenceAnalysis.layers,
      projectPurpose,
    },
    packageManager: scanState.packageManager,
    projectName: input.projectName,
  });

  const documents = buildLocalAnalysisDocuments({
    architectureSummary,
    detectedFrameworks: detection.detectedFrameworks,
    projectName: input.projectName,
    projectPurpose,
    referenceAnalysis,
    scanState,
    summaryMarkdown,
    unknowns: detection.unknowns,
  });

  return {
    context: {
      ...detection.context,
      architectureSummary,
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
      projectPurpose,
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
  const mergedDocuments = mergeAnalysisDocuments({
    codexDocuments: input.codexDraft.documents,
    localDocuments: input.localDraft.documents,
  });
  const mergedOverviewDocument =
    mergedDocuments.find((document) => document.id === 'overview') ?? null;

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
      modules: preferNonEmptyList(
        input.codexDraft.context.modules,
        input.localDraft.context.modules,
      ),
      projectPurpose:
        input.codexDraft.context.projectPurpose.length > 0
          ? input.codexDraft.context.projectPurpose
          : input.localDraft.context.projectPurpose,
      unknowns: mergeStringLists(
        input.codexDraft.context.unknowns,
        input.localDraft.context.unknowns,
      ),
      directorySummaries:
        input.localDraft.context.directorySummaries.length > 0
          ? input.localDraft.context.directorySummaries
          : input.codexDraft.context.directorySummaries,
      documentLinks:
        input.codexDraft.context.documentLinks.length > 0
          ? input.codexDraft.context.documentLinks
          : input.localDraft.context.documentLinks,
      documentSummaries: mergedDocuments.map((document) => ({
        id: document.id,
        summary: document.summary,
      })),
      confidence: Math.max(
        input.codexDraft.context.confidence,
        input.localDraft.context.confidence,
      ),
    },
    documents: mergedDocuments,
    fileIndex:
      input.localDraft.fileIndex.length > 0
        ? input.localDraft.fileIndex
        : input.codexDraft.fileIndex,
    summaryMarkdown: mergedOverviewDocument?.markdown ?? input.codexDraft.summaryMarkdown,
  };
}

function buildLocalAnalysisDocuments(input: {
  architectureSummary: string;
  detectedFrameworks: string[];
  projectName: string;
  projectPurpose: string;
  referenceAnalysis: LocalProjectReferenceAnalysis;
  scanState: {
    entrypoints: Set<string>;
    keyConfigs: Set<string>;
    modules: Set<string>;
  };
  summaryMarkdown: string;
  unknowns: string[];
}): ProjectAnalysisDocument[] {
  return [
    createProjectAnalysisDocument({
      id: 'overview',
      markdown: input.summaryMarkdown,
      summary: '프로젝트를 빠르게 파악할 수 있도록 핵심 실행 축과 읽는 순서를 압축한 개요입니다.',
    }),
    createProjectAnalysisDocument({
      id: 'purpose',
      markdown: createPurposeMarkdown(input),
      summary:
        '도메인을 추측하지 않고, 현재 코드가 어떤 작업 흐름을 지탱하는지 근거 중심으로 정리했습니다.',
    }),
    createProjectAnalysisDocument({
      id: 'structure',
      markdown: createStructureMarkdown(input),
      summary: '디렉터리 계층과 대표 파일을 함께 보여주는 구조 지도입니다.',
    }),
    createProjectAnalysisDocument({
      id: 'layers',
      markdown: createLayersMarkdown(input),
      summary: '레이어 책임과 의존 방향을 시각적으로 정리한 문서입니다.',
    }),
    createProjectAnalysisDocument({
      id: 'connectivity',
      markdown: createConnectivityMarkdown(input),
      summary: '레이어 연결, 진입점, 설정 파일을 한 흐름으로 연결해 보여줍니다.',
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

function mergeAnalysisDocuments(input: {
  codexDocuments: ProjectAnalysisDocument[];
  localDocuments: ProjectAnalysisDocument[];
}): ProjectAnalysisDocument[] {
  const localDocumentMap = new Map(input.localDocuments.map((document) => [document.id, document]));

  return input.codexDocuments.map((document) => {
    const localDocument = localDocumentMap.get(document.id);
    if (!localDocument) {
      return document;
    }

    const localMermaidCode = extractFirstMermaidCodeBlock(localDocument.markdown);
    if (!localMermaidCode || document.markdown.includes('```mermaid')) {
      return document;
    }

    return {
      ...document,
      markdown: [
        document.markdown.trimEnd(),
        '',
        '## 정적 분석 시각 요약',
        '',
        '```mermaid',
        localMermaidCode,
        '```',
      ].join('\n'),
    };
  });
}

function extractFirstMermaidCodeBlock(markdown: string): string | null {
  const match = markdown.match(/```mermaid\s*\n([\s\S]*?)\n```/u);
  return match?.[1]?.trim() ?? null;
}

function createPurposeMarkdown(input: {
  architectureSummary: string;
  detectedFrameworks: string[];
  projectPurpose: string;
  referenceAnalysis: LocalProjectReferenceAnalysis;
  scanState: {
    entrypoints: Set<string>;
    keyConfigs: Set<string>;
    modules: Set<string>;
  };
  unknowns: string[];
}): string {
  const importantDirectories = selectImportantDirectories(
    input.referenceAnalysis.directorySummaries,
    5,
  );
  const entrypoints = [...input.scanState.entrypoints].slice(0, 4);
  const keyConfigs = [...input.scanState.keyConfigs].slice(0, 3);
  const importantLayers = selectImportantLayers(input.referenceAnalysis.layers, 4);

  return joinMarkdownSections([
    ['# 목적과 사용자 가치'],
    [
      '정적 분석만으로 제품 도메인을 단정하지 않고, 현재 코드 구조가 어떤 작업 흐름을 지탱하도록 짜였는지 확인된 근거만 정리합니다.',
    ],
    [
      '## 지금 확실히 말할 수 있는 것',
      '',
      ...createBulletList(
        compactStrings([
          input.projectPurpose,
          input.architectureSummary,
          input.detectedFrameworks.length > 0
            ? `코드베이스 성격: ${input.detectedFrameworks.join(', ')}`
            : null,
          entrypoints.length > 0 ? `확인된 진입점: ${formatCodeList(entrypoints)}` : null,
          keyConfigs.length > 0 ? `주요 설정 파일: ${formatCodeList(keyConfigs)}` : null,
        ]),
        '정적 분석만으로 확정할 수 있는 운영 목적 단서를 아직 정리하지 못했습니다.',
      ),
    ],
    createMermaidSection(
      '## 시각 요약',
      createPurposeDiagram({
        entrypoints,
        keyConfigs,
        layers: importantLayers,
      }),
    ),
    [
      '## 구조가 드러내는 작업 축',
      '',
      ...createBulletList(
        compactStrings([
          ...importantDirectories.map(
            (directory) =>
              `${formatCode(directory.path)}: ${directory.role}${directory.layer ? ` (${directory.layer})` : ''}`,
          ),
          input.referenceAnalysis.fileIndex.length > 0
            ? `대표 파일 인덱스는 ${input.referenceAnalysis.fileIndex.length}개이며, 상위 항목부터 읽으면 구조 이해가 빠릅니다.`
            : null,
        ]),
        '구조상 눈에 띄는 작업 축을 아직 정리하지 못했습니다.',
      ),
    ],
    [
      '## 추가 확인 필요',
      '',
      ...createBulletList(
        input.unknowns,
        '현재 정적 분석 기준으로 바로 추가 확인이 필요한 항목은 크지 않습니다.',
      ),
    ],
  ]);
}

function createStructureMarkdown(input: {
  architectureSummary: string;
  projectName: string;
  referenceAnalysis: LocalProjectReferenceAnalysis;
  scanState: {
    entrypoints: Set<string>;
    keyConfigs: Set<string>;
    modules: Set<string>;
  };
}): string {
  const structurePaths = selectStructurePaths({
    directorySummaries: input.referenceAnalysis.directorySummaries,
    modules: [...input.scanState.modules],
  });
  const representativeFiles = selectRepresentativeFiles(input.referenceAnalysis.fileIndex, 6);

  return joinMarkdownSections([
    ['# 구조와 주요 모듈'],
    [
      `${input.projectName}의 구조는 경로 중심으로 책임이 나뉘어 있습니다. 이 문서는 디렉터리 단위의 분할 방식과 상위에서 먼저 읽어야 할 파일을 함께 보여줍니다.`,
    ],
    createMermaidSection(
      '## 구조 다이어그램',
      createStructureDiagram({
        paths: structurePaths,
        projectName: input.projectName,
      }),
    ),
    [
      '## 핵심 디렉터리',
      '',
      ...createBulletList(
        input.referenceAnalysis.directorySummaries
          .slice(0, 6)
          .map(
            (directory) =>
              `${formatCode(directory.path)}: ${directory.role}${directory.layer ? ` (${directory.layer})` : ''}`,
          ),
        '요약 가능한 주요 디렉터리를 아직 찾지 못했습니다.',
      ),
    ],
    [
      '## 대표 파일',
      '',
      ...createBulletList(
        representativeFiles.map(
          (entry) => `${formatCode(entry.path)}: ${entry.role}. ${entry.summary}`,
        ),
        '대표 파일을 아직 정리하지 못했습니다.',
      ),
    ],
    [
      '## 구조 해석 포인트',
      '',
      ...createBulletList(
        compactStrings([
          input.architectureSummary,
          structurePaths.length > 0
            ? `우선순위 경로: ${formatCodeList(structurePaths.slice(0, 4))}`
            : null,
        ]),
        '구조 해석 포인트를 아직 정리하지 못했습니다.',
      ),
    ],
  ]);
}

function createLayersMarkdown(input: {
  architectureSummary: string;
  referenceAnalysis: LocalProjectReferenceAnalysis;
}): string {
  const importantLayers = selectImportantLayers(input.referenceAnalysis.layers, 8);

  return joinMarkdownSections([
    ['# 계층과 책임'],
    [input.architectureSummary],
    createMermaidSection('## 의존 방향', createLayerDiagram(importantLayers)),
    [
      '## 레이어별 책임',
      '',
      ...createBulletList(
        importantLayers.map((layer) => {
          const representativeDirectories = selectDirectoriesByLayer({
            directories: input.referenceAnalysis.directorySummaries,
            layerName: layer.name,
          });
          const dependsOn =
            layer.dependsOn.length > 0 ? ` 의존: ${layer.dependsOn.join(', ')}.` : '';

          return `${layer.name}: ${layer.responsibility}.${representativeDirectories.length > 0 ? ` 대표 경로: ${formatCodeList(representativeDirectories)}.` : ''}${dependsOn}`.replace(
            /\.\./gu,
            '.',
          );
        }),
        '경로 기반 계층 정보를 아직 정리하지 못했습니다.',
      ),
    ],
    [
      '## 경계에서 주의할 점',
      '',
      ...createBulletList(
        input.referenceAnalysis.connections
          .slice(0, 4)
          .map((connection) => describeConnection(connection)),
        '특별히 눈에 띄는 계층 경계는 아직 정리하지 못했습니다.',
      ),
    ],
  ]);
}

function createConnectivityMarkdown(input: {
  referenceAnalysis: LocalProjectReferenceAnalysis;
  scanState: {
    entrypoints: Set<string>;
    keyConfigs: Set<string>;
    modules: Set<string>;
  };
}): string {
  const entrypoints = [...input.scanState.entrypoints].slice(0, 5);
  const keyConfigs = [...input.scanState.keyConfigs].slice(0, 5);

  return joinMarkdownSections([
    ['# 연결성과 데이터 흐름'],
    [
      '이 문서는 레이어 간 정적 참조, 진입점 후보, 설정 파일을 한 화면에서 이어 보도록 정리한 흐름 문서입니다.',
    ],
    createMermaidSection(
      '## 연결 다이어그램',
      createConnectivityDiagram(input.referenceAnalysis.connections.slice(0, 6)),
    ),
    [
      '## 핵심 연결',
      '',
      ...createBulletList(
        input.referenceAnalysis.connections
          .slice(0, 6)
          .map((connection) => describeConnection(connection)),
        '레이어 단위 연결 관계를 아직 정리하지 못했습니다.',
      ),
    ],
    [
      '## 진입점과 설정',
      '',
      ...createBulletList(
        compactStrings([
          entrypoints.length > 0 ? `진입점 후보: ${formatCodeList(entrypoints)}` : null,
          keyConfigs.length > 0 ? `설정 파일: ${formatCodeList(keyConfigs)}` : null,
        ]),
        '자동으로 감지한 진입점이나 설정 파일이 없습니다.',
      ),
    ],
    [
      '## 파일 인덱스 해석 팁',
      '',
      ...createBulletList(
        compactStrings([
          input.referenceAnalysis.fileIndex.length > 0
            ? `파일 인덱스 상위 항목은 참조가 집중된 파일부터 정렬되어 있습니다.`
            : null,
          input.referenceAnalysis.fileReferences.length > 0
            ? `전체 파일 참조는 ${input.referenceAnalysis.fileReferences.length}건이며, 자세한 관계는 파일 인덱스와 참조 맵에서 확인할 수 있습니다.`
            : null,
        ]),
        '추가로 볼 파일 인덱스 해석 팁이 없습니다.',
      ),
    ],
  ]);
}

function createPurposeDiagram(input: {
  entrypoints: string[];
  keyConfigs: string[];
  layers: ProjectAnalysisLayerSummary[];
}): string[] | null {
  if (
    input.entrypoints.length === 0 &&
    input.layers.length === 0 &&
    input.keyConfigs.length === 0
  ) {
    return null;
  }

  const mermaidLines = ['flowchart LR', '  user["사용자 작업 / 호출"]'];

  if (input.entrypoints.length > 0) {
    mermaidLines.push('  user --> entryHub["진입점"]');
    for (const [index, entrypoint] of input.entrypoints.entries()) {
      mermaidLines.push(`  entryHub --> entry${index}["${escapeMermaidLabel(entrypoint)}"]`);
    }
  }

  if (input.layers.length > 0) {
    mermaidLines.push('  user --> layerHub["핵심 실행 축"]');
    for (const [index, layer] of input.layers.entries()) {
      mermaidLines.push(`  layerHub --> layer${index}["${escapeMermaidLabel(layer.name)}"]`);
    }
  }

  if (input.keyConfigs.length > 0) {
    mermaidLines.push('  user --> configHub["주요 설정"]');
    for (const [index, config] of input.keyConfigs.entries()) {
      mermaidLines.push(`  configHub --> config${index}["${escapeMermaidLabel(config)}"]`);
    }
  }

  return mermaidLines;
}

function createStructureDiagram(input: { paths: string[]; projectName: string }): string[] | null {
  if (input.paths.length === 0) {
    return null;
  }

  const mermaidLines = ['flowchart TB', `  project["${escapeMermaidLabel(input.projectName)}"]`];
  const firstSegments = [...new Set(input.paths.map((path) => path.split('/')[0]).filter(Boolean))];

  if (firstSegments.length === 1) {
    const sharedRoot = firstSegments[0] ?? '';
    mermaidLines.push(`  project --> root0["${escapeMermaidLabel(sharedRoot)}"]`);

    for (const [index, path] of input.paths.entries()) {
      if (path === sharedRoot) {
        continue;
      }

      mermaidLines.push(`  root0 --> child${index}["${escapeMermaidLabel(path)}"]`);
    }

    return mermaidLines;
  }

  for (const [index, path] of input.paths.entries()) {
    mermaidLines.push(`  project --> node${index}["${escapeMermaidLabel(path)}"]`);
  }

  return mermaidLines;
}

function createLayerDiagram(layers: ProjectAnalysisLayerSummary[]): string[] | null {
  if (layers.length === 0) {
    return null;
  }

  const layerIdMap = new Map<string, string>();
  const mermaidLines = ['flowchart LR'];

  for (const [index, layer] of layers.entries()) {
    const layerId = `layer${index}`;
    layerIdMap.set(layer.name, layerId);
    mermaidLines.push(`  ${layerId}["${escapeMermaidLabel(layer.name)}"]`);
  }

  for (const layer of layers) {
    const fromId = layerIdMap.get(layer.name);
    if (!fromId) {
      continue;
    }

    for (const dependency of layer.dependsOn) {
      const toId = layerIdMap.get(dependency);
      if (!toId) {
        continue;
      }

      mermaidLines.push(`  ${fromId} --> ${toId}`);
    }
  }

  return mermaidLines;
}

function createConnectivityDiagram(connections: ProjectAnalysisConnection[]): string[] | null {
  if (connections.length === 0) {
    return null;
  }

  const nodeIdMap = new Map<string, string>();
  const mermaidLines = ['flowchart LR'];

  for (const connection of connections) {
    if (!nodeIdMap.has(connection.from)) {
      const nodeId = `node${nodeIdMap.size}`;
      nodeIdMap.set(connection.from, nodeId);
      mermaidLines.push(`  ${nodeId}["${escapeMermaidLabel(connection.from)}"]`);
    }
    if (!nodeIdMap.has(connection.to)) {
      const nodeId = `node${nodeIdMap.size}`;
      nodeIdMap.set(connection.to, nodeId);
      mermaidLines.push(`  ${nodeId}["${escapeMermaidLabel(connection.to)}"]`);
    }

    mermaidLines.push(
      `  ${nodeIdMap.get(connection.from)} -->|${escapeMermaidLabel(connection.relationship)}| ${nodeIdMap.get(connection.to)}`,
    );
  }

  return mermaidLines;
}

function createMermaidSection(heading: string, diagramLines: string[] | null): string[] {
  if (!diagramLines || diagramLines.length === 0) {
    return [];
  }

  return [heading, '', '```mermaid', ...diagramLines, '```'];
}

function joinMarkdownSections(sections: string[][]): string {
  return sections
    .filter((section) => section.length > 0)
    .map((section) => section.join('\n'))
    .join('\n\n');
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

function selectImportantDirectories(
  directories: ProjectAnalysisDirectorySummary[],
  limit: number,
): ProjectAnalysisDirectorySummary[] {
  return [...directories]
    .sort((left, right) => {
      const leftDepth = left.path.split('/').length;
      const rightDepth = right.path.split('/').length;
      if (leftDepth !== rightDepth) {
        return leftDepth - rightDepth;
      }

      return left.path.localeCompare(right.path);
    })
    .slice(0, limit);
}

function selectImportantLayers(
  layers: ProjectAnalysisLayerSummary[],
  limit: number,
): ProjectAnalysisLayerSummary[] {
  return [...layers]
    .sort((left, right) => compareLayerPriority(left.name, right.name))
    .slice(0, limit);
}

function selectRepresentativeFiles(
  fileIndex: ProjectAnalysisFileIndexEntry[],
  limit: number,
): ProjectAnalysisFileIndexEntry[] {
  return fileIndex
    .filter((entry) => entry.category !== 'config' && entry.category !== 'test')
    .slice(0, limit);
}

function selectStructurePaths(input: {
  directorySummaries: ProjectAnalysisDirectorySummary[];
  modules: string[];
}): string[] {
  const directoryPaths = input.directorySummaries.map((directory) => directory.path);
  const source = directoryPaths.length > 0 ? directoryPaths : input.modules;

  return [...new Set(source)].slice(0, 8);
}

function selectDirectoriesByLayer(input: {
  directories: ProjectAnalysisDirectorySummary[];
  layerName: string;
}): string[] {
  return input.directories
    .filter((directory) => directory.layer === input.layerName)
    .map((directory) => directory.path)
    .slice(0, 3);
}

function compareLayerPriority(left: string, right: string): number {
  const leftPriority = resolveLayerPriority(left);
  const rightPriority = resolveLayerPriority(right);

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return left.localeCompare(right);
}

function resolveLayerPriority(layerName: string): number {
  const normalized = layerName.toLowerCase();

  if (normalized === 'entrypoint') {
    return 0;
  }
  if (normalized === 'main') {
    return 1;
  }
  if (normalized === 'preload') {
    return 2;
  }
  if (normalized === 'renderer') {
    return 3;
  }
  if (normalized === 'application') {
    return 4;
  }
  if (normalized === 'domain') {
    return 5;
  }
  if (normalized === 'infrastructure') {
    return 6;
  }
  if (normalized === 'shared') {
    return 7;
  }
  if (normalized === 'config') {
    return 8;
  }

  return 20;
}

function describeConnection(connection: ProjectAnalysisConnection): string {
  const example = extractConnectionExample(connection.reason);
  const exampleSuffix = example ? ` 예시: ${formatCode(example)}.` : '';

  return `${connection.from} -> ${connection.to}: ${summarizeConnectionReason(connection.reason)}.${exampleSuffix}`.replace(
    /\.\./gu,
    '.',
  );
}

function summarizeConnectionReason(reason: string): string {
  const shortened = reason.split('. 예:')[0]?.trim() ?? reason.trim();
  return shortened.length > 0 ? shortened : reason;
}

function extractConnectionExample(reason: string): string | null {
  const sampleChunk = reason.split('예:')[1]?.split(',')[0]?.trim() ?? null;
  return sampleChunk && sampleChunk.length > 0 ? sampleChunk : null;
}

function formatCodeList(values: string[]): string {
  return values.map((value) => formatCode(value)).join(', ');
}

function formatCode(value: string): string {
  return `\`${value}\``;
}

function escapeMermaidLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function compactStrings(values: Array<string | null>): string[] {
  return values.filter((value): value is string => typeof value === 'string' && value.length > 0);
}
