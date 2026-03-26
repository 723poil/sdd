import type {
  ProjectAnalysisConnection,
  ProjectAnalysisDirectorySummary,
  ProjectAnalysisFileIndexEntry,
  ProjectAnalysisFileReference,
  ProjectAnalysisLayerSummary,
} from '@/domain/project/project-analysis-model';
import {
  DEFAULT_CONNECTION_LIMIT,
  DEFAULT_DIRECTORY_SUMMARY_LIMIT,
} from '@/infrastructure/analysis/project-analysis-local-reference-extractor.constants';
import type {
  ExtractedReference,
  LayerConnectionAccumulator,
} from '@/infrastructure/analysis/project-analysis-local-reference-extractor.types';
import {
  describeDirectoryRole,
  describeLayerResponsibility,
} from '@/infrastructure/analysis/project-analysis-file-descriptions';

export function buildLayerSummaries(input: {
  fileIndex: ProjectAnalysisFileIndexEntry[];
  fileReferences: ProjectAnalysisFileReference[];
}): ProjectAnalysisLayerSummary[] {
  const fileCountByLayer = new Map<string, number>();
  const layerDependencyMap = new Map<string, Set<string>>();

  for (const entry of input.fileIndex) {
    const layerName = entry.layer ?? '기타';
    fileCountByLayer.set(layerName, (fileCountByLayer.get(layerName) ?? 0) + 1);
    if (!layerDependencyMap.has(layerName)) {
      layerDependencyMap.set(layerName, new Set<string>());
    }
  }

  const layerByPath = new Map(
    input.fileIndex.map((entry) => [entry.path, entry.layer ?? '기타'] as const),
  );

  for (const reference of input.fileReferences) {
    const fromLayer = layerByPath.get(reference.from) ?? '기타';
    const toLayer = layerByPath.get(reference.to) ?? '기타';
    if (fromLayer === toLayer) {
      continue;
    }

    const dependencySet = layerDependencyMap.get(fromLayer);
    dependencySet?.add(toLayer);
  }

  return [...fileCountByLayer.entries()]
    .map(([layerName, fileCount]) => ({
      dependsOn: [...(layerDependencyMap.get(layerName) ?? new Set<string>())].sort(),
      directories: [],
      name: layerName,
      responsibility: describeLayerResponsibility(layerName, fileCount),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function buildDirectorySummaries(input: {
  fileIndex: ProjectAnalysisFileIndexEntry[];
  scanState: {
    directories: Set<string>;
    modules: Set<string>;
  };
  structureDiscovery: {
    featureClusters: Array<{ path: string }>;
    packageRoots: Array<{ path: string }>;
    sourceRoots: Array<{ path: string }>;
  };
}): ProjectAnalysisDirectorySummary[] {
  const discoveredPaths = new Set<string>([
    ...input.structureDiscovery.packageRoots.map((packageRoot) => packageRoot.path),
    ...input.structureDiscovery.sourceRoots.map((sourceRoot) => sourceRoot.path),
    ...input.structureDiscovery.featureClusters.map((featureCluster) => featureCluster.path),
  ]);
  const modulePaths = [...input.scanState.modules].map((path) => normalizeRelativePath(path));
  const directoryPaths =
    discoveredPaths.size > 0
      ? [...discoveredPaths]
      : modulePaths.length > 0
        ? modulePaths
        : [...input.scanState.directories].map((path) => normalizeRelativePath(path));

  return directoryPaths
    .map((path) => {
      const indexedEntries =
        path === '.'
          ? input.fileIndex
          : input.fileIndex.filter(
              (entry) => entry.path.startsWith(`${path}/`) || entry.path === path,
            );

      return {
        layer: indexedEntries[0]?.grouping?.area ?? null,
        path,
        role: describeDirectoryRole(indexedEntries),
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path))
    .slice(0, DEFAULT_DIRECTORY_SUMMARY_LIMIT);
}

export function buildConnections(input: {
  fileReferences: ProjectAnalysisFileReference[];
  layerByPath: Map<string, string | null>;
}): ProjectAnalysisConnection[] {
  const connectionMap = new Map<string, LayerConnectionAccumulator>();

  for (const reference of input.fileReferences) {
    const fromLayer = input.layerByPath.get(reference.from) ?? '기타';
    const toLayer = input.layerByPath.get(reference.to) ?? '기타';
    const key = `${fromLayer}->${toLayer}`;
    const accumulator = connectionMap.get(key) ?? {
      count: 0,
      from: fromLayer,
      samples: [],
      to: toLayer,
    };

    accumulator.count += 1;
    if (accumulator.samples.length < 3) {
      accumulator.samples.push(`${reference.from} -> ${reference.to}`);
    }
    connectionMap.set(key, accumulator);
  }

  return [...connectionMap.values()]
    .sort((left, right) => right.count - left.count || left.from.localeCompare(right.from))
    .slice(0, DEFAULT_CONNECTION_LIMIT)
    .map((accumulator) => ({
      from: accumulator.from,
      reason:
        accumulator.samples.length > 0
          ? `정적 참조 ${accumulator.count}건. 예: ${accumulator.samples.join(', ')}`
          : `정적 참조 ${accumulator.count}건`,
      relationship: '정적 참조',
      to: accumulator.to,
    }));
}

export function deduplicateFileReferences(
  references: ExtractedReference[],
): ProjectAnalysisFileReference[] {
  const deduplicated = new Map<string, ProjectAnalysisFileReference>();

  for (const reference of references) {
    const key = `${reference.from}|${reference.to}|${reference.relationship}`;
    if (deduplicated.has(key)) {
      continue;
    }

    deduplicated.set(key, {
      from: reference.from,
      reason: describeReferenceReason(reference.relationship, reference.specifier),
      relationship: reference.relationship,
      to: reference.to,
    });
  }

  return [...deduplicated.values()];
}

function describeReferenceReason(
  relationship: ExtractedReference['relationship'],
  specifier: string,
): string {
  switch (relationship) {
    case 'decorates':
      return `데코레이터 사용: ${specifier}`;
    case 'dynamic-import':
      return `동적 import: ${specifier}`;
    case 'extends':
      return `상속: ${specifier}`;
    case 'exports':
      return `모듈 exports: ${specifier}`;
    case 'implements':
      return `구현: ${specifier}`;
    case 'instantiates':
      return `객체 생성: ${specifier}`;
    case 'module-imports':
      return `모듈 imports: ${specifier}`;
    case 'loads':
      return `CI 로더: ${specifier}`;
    case 'provides':
      return `모듈 providers: ${specifier}`;
    case 'registers-controller':
      return `모듈 controllers: ${specifier}`;
    case 'requires':
      return `require: ${specifier}`;
    case 'includes':
      return `include/require: ${specifier}`;
    case 'uses':
      return `PHP use: ${specifier}`;
    case 'phpdoc':
      return `PHPDoc 타입: ${specifier}`;
    case 'imports':
      return `정적 import: ${specifier}`;
    default:
      return `정적 참조: ${specifier}`;
  }
}

function normalizeRelativePath(value: string): string {
  return value.replaceAll('\\', '/');
}
