import type {
  ProjectAnalysisConnection,
  ProjectAnalysisContext,
  ProjectAnalysisDirectorySummary,
  ProjectAnalysisLayerSummary,
} from '@/domain/project/project-analysis-model';

export function createProjectAnalysisSummaryMarkdown(input: {
  context: ProjectAnalysisContext;
  packageManager: string | null;
  projectName: string;
}): string {
  const sections = [
    [`# ${input.projectName}`],
    [createOverviewIntro(input)],
    createQuickSummarySection(input),
    createOverviewDiagramSection(input),
    createOverviewHighlightsSection(input.context),
    createUnknownsSection(input.context),
  ].filter((section) => section.length > 0);

  return sections.map((section) => section.join('\n')).join('\n\n');
}

function createOverviewIntro(input: {
  context: ProjectAnalysisContext;
  packageManager: string | null;
  projectName: string;
}): string {
  const stackSummary =
    input.context.detectedFrameworks.length > 0
      ? `${input.context.detectedFrameworks.join(', ')} 중심의`
      : '정적 분석 기준으로 구조 확인이 필요한';
  const packageManagerSummary = input.packageManager
    ? `패키지 매니저는 \`${input.packageManager}\``
    : '패키지 매니저는 아직 확정하지 못했고';

  return `${input.projectName}은 ${stackSummary} 코드베이스로 보입니다. ${packageManagerSummary} 현재 문서는 사용자가 먼저 읽어야 할 실행 축, 주요 경로, 확인이 더 필요한 부분만 압축해 보여줍니다.`;
}

function createQuickSummarySection(input: {
  context: ProjectAnalysisContext;
  packageManager: string | null;
}): string[] {
  const importantLayers = selectImportantLayers(input.context.layers, 5).map((layer) => layer.name);

  return [
    '## 한눈에 보기',
    '',
    ...createBulletList(
      compactStrings([
        `감지한 스택: ${formatCommaList(input.context.detectedFrameworks, '확인 중')}`,
        `신뢰도: ${Math.round(input.context.confidence * 100)}%`,
        `패키지 매니저: ${input.packageManager ?? '확인하지 못함'}`,
        `정적 분석 대상 파일: ${input.context.files.length}개`,
        `파일 참조 관계: ${input.context.fileReferences.length}건`,
        `미해결 참조: ${input.context.referenceAnalysis.unresolvedFileReferences.length}건`,
        `스캔 한도 도달: ${input.context.referenceAnalysis.scanLimits.length}건`,
        `핵심 레이어: ${formatCommaList(importantLayers, '확인 중')}`,
      ]),
      '분석 요약 정보를 아직 정리하지 못했습니다.',
    ),
  ];
}

function createOverviewDiagramSection(input: {
  context: ProjectAnalysisContext;
  projectName: string;
}): string[] {
  const entrypoints = input.context.entrypoints.slice(0, 3);
  const layers = selectImportantLayers(input.context.layers, 4).map((layer) => layer.name);
  const keyConfigs = input.context.keyConfigs.slice(0, 3);

  if (entrypoints.length === 0 && layers.length === 0 && keyConfigs.length === 0) {
    return [];
  }

  const mermaidLines = ['flowchart LR', `  project["${escapeMermaidLabel(input.projectName)}"]`];

  if (entrypoints.length > 0) {
    mermaidLines.push('  project --> entryHub["진입점"]');
    for (const [index, entrypoint] of entrypoints.entries()) {
      mermaidLines.push(`  entryHub --> entry${index}["${escapeMermaidLabel(entrypoint)}"]`);
    }
  }

  if (layers.length > 0) {
    mermaidLines.push('  project --> layerHub["핵심 레이어"]');
    for (const [index, layer] of layers.entries()) {
      mermaidLines.push(`  layerHub --> layer${index}["${escapeMermaidLabel(layer)}"]`);
    }
  }

  if (keyConfigs.length > 0) {
    mermaidLines.push('  project --> configHub["주요 설정"]');
    for (const [index, config] of keyConfigs.entries()) {
      mermaidLines.push(`  configHub --> config${index}["${escapeMermaidLabel(config)}"]`);
    }
  }

  return ['## 시각 요약', '', '```mermaid', ...mermaidLines, '```'];
}

function createOverviewHighlightsSection(context: ProjectAnalysisContext): string[] {
  const importantDirectories = selectImportantDirectories(context.directorySummaries, 4);
  const importantConnections = context.connections.slice(0, 4);
  const representativeModules = context.modules.slice(0, 4);

  return [
    '## 먼저 볼 포인트',
    '',
    ...createBulletList(
      compactStrings([
        context.projectPurpose.length > 0 ? context.projectPurpose : null,
        context.architectureSummary.length > 0 ? context.architectureSummary : null,
        representativeModules.length > 0
          ? `대표 모듈 경로: ${formatCodeList(representativeModules)}`
          : null,
        ...importantDirectories.map(
          (directory) =>
            `${formatCode(directory.path)}: ${directory.role}${directory.layer ? ` (${directory.layer})` : ''}`,
        ),
        ...importantConnections.map((connection) => describeConnection(connection)),
      ]),
      '먼저 볼 핵심 포인트를 아직 정리하지 못했습니다.',
    ),
  ];
}

function createUnknownsSection(context: ProjectAnalysisContext): string[] {
  return [
    '## 추가 확인 필요',
    '',
    ...createBulletList(
      context.unknowns,
      '현재 정적 분석 기준으로 즉시 확인이 더 필요한 항목은 크지 않습니다.',
    ),
  ];
}

function createBulletList(values: Array<string | null>, emptyMessage: string): string[] {
  const visibleValues = compactStrings(values);
  if (visibleValues.length === 0) {
    return [`- ${emptyMessage}`];
  }

  return visibleValues.slice(0, 8).map((value) => `- ${value}`);
}

function selectImportantLayers(
  layers: ProjectAnalysisLayerSummary[],
  limit: number,
): ProjectAnalysisLayerSummary[] {
  return [...layers]
    .sort((left, right) => compareLayerPriority(left.name, right.name))
    .slice(0, limit);
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
  return `${connection.from} -> ${connection.to}: ${summarizeConnectionReason(connection.reason)}`;
}

function summarizeConnectionReason(reason: string): string {
  const shortened = reason.split('. 예:')[0]?.trim() ?? reason.trim();
  return shortened.length > 0 ? shortened : reason;
}

function formatCommaList(values: string[], emptyMessage: string): string {
  if (values.length === 0) {
    return emptyMessage;
  }

  return values.join(', ');
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
