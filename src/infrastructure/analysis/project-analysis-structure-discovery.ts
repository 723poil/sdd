import { dirname, relative, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

import ts from 'typescript';

import type {
  ProjectAnalysisStructureDiscovery,
  ProjectAnalysisStructureDiscoveryFeatureCluster,
  ProjectAnalysisStructureDiscoveryPackageRoot,
  ProjectAnalysisStructureDiscoverySourceRoot,
} from '@/domain/project/project-analysis-model';
import type { ProjectAnalysisScanState } from '@/infrastructure/analysis/project-analysis-scanner';

const SOURCE_FILE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.vue',
  '.kt',
  '.kts',
  '.php',
  '.java',
]);
const SOURCE_ROOT_DIRECTORY_NAMES = [
  'src',
  'app',
  'apps',
  'client',
  'lib',
  'libs',
  'main',
  'preload',
  'renderer',
  'server',
  'services',
  'source',
  'web',
];
const ALIAS_CONFIG_FILE_PATTERN =
  /(?:^|\/)(?:tsconfig(?:\.[\w-]+)?|jsconfig)\.json$|(?:^|\/)(?:vite|vue)\.config\./u;
const PACKAGE_MANIFEST_FILES = new Map<string, { confidence: number; reason: string }>([
  ['package.json', { confidence: 0.95, reason: 'package.json 으로 패키지 루트를 확인했습니다.' }],
  ['composer.json', { confidence: 0.9, reason: 'composer.json 으로 패키지 루트를 확인했습니다.' }],
  ['pom.xml', { confidence: 0.88, reason: 'pom.xml 로 빌드 루트를 확인했습니다.' }],
  ['build.gradle', { confidence: 0.88, reason: 'build.gradle 로 빌드 루트를 확인했습니다.' }],
  [
    'build.gradle.kts',
    { confidence: 0.88, reason: 'build.gradle.kts 로 빌드 루트를 확인했습니다.' },
  ],
  [
    'settings.gradle',
    { confidence: 0.84, reason: 'settings.gradle 로 멀티 모듈 루트를 확인했습니다.' },
  ],
  [
    'settings.gradle.kts',
    { confidence: 0.84, reason: 'settings.gradle.kts 로 멀티 모듈 루트를 확인했습니다.' },
  ],
]);
const STRUCTURAL_SEGMENTS = new Set([
  'command',
  'commands',
  'controller',
  'controllers',
  'decorator',
  'decorators',
  'domain',
  'domains',
  'dto',
  'dtos',
  'entity',
  'entities',
  'exception',
  'exceptions',
  'factory',
  'factories',
  'filter',
  'filters',
  'guard',
  'guards',
  'handler',
  'handlers',
  'helper',
  'helpers',
  'interceptor',
  'interceptors',
  'mapper',
  'mappers',
  'middleware',
  'middlewares',
  'model',
  'models',
  'module',
  'modules',
  'pipe',
  'pipes',
  'policy',
  'policies',
  'query',
  'queries',
  'repository',
  'repositories',
  'service',
  'services',
  'strategy',
  'strategies',
  'test',
  'tests',
  'type',
  'types',
  'util',
  'utils',
  'validator',
  'validators',
]);
const GENERIC_CLUSTER_SEGMENTS = new Set([
  'app',
  'apps',
  'client',
  'core',
  'main',
  'preload',
  'renderer',
  'server',
  'shared',
  'src',
  'web',
]);
const TEST_SEGMENTS = new Set(['test', 'tests', '__test__', '__tests__', '__mocks__']);

interface SourceSignalFile {
  content: string;
  path: string;
}

interface PackageManifestMetadata {
  main?: string;
  name?: string;
}

export async function discoverProjectAnalysisStructure(input: {
  rootPath: string;
  scanState: ProjectAnalysisScanState;
  sourceFiles: SourceSignalFile[];
}): Promise<ProjectAnalysisStructureDiscovery> {
  const filePaths = [...input.scanState.files].map((path) => normalizeRelativePath(path));
  const sourceSignalByPath = new Map(
    input.sourceFiles.map((file) => [normalizeRelativePath(file.path), file.content] as const),
  );
  const aliasConfigPaths = filePaths.filter((path) => ALIAS_CONFIG_FILE_PATTERN.test(path)).sort();
  const packageRootCandidates = await collectPackageRoots({
    filePaths,
    rootPath: input.rootPath,
  });
  const packageRoots = packageRootCandidates.map((candidate) => {
    const sourceRoots = discoverSourceRootsForPackage({
      aliasConfigPaths,
      filePaths,
      packageRootPath: candidate.path,
      rootPath: input.rootPath,
      sourceSignalByPath,
    });

    return {
      confidence: candidate.confidence,
      packageName: candidate.packageName,
      path: candidate.path,
      reason: candidate.reason,
      sourceRoots: sourceRoots.map((sourceRoot) => sourceRoot.path),
    } satisfies ProjectAnalysisStructureDiscoveryPackageRoot;
  });
  const sourceRoots = deduplicateSourceRoots(
    packageRoots.flatMap((packageRoot) =>
      packageRoot.sourceRoots.map((sourceRootPath) => ({
        confidence: resolveSourceRootConfidence({
          aliasConfigPaths,
          packageRootPath: packageRoot.path,
          path: sourceRootPath,
        }),
        kind: resolveSourceRootKind({
          aliasConfigPaths,
          packageRootPath: packageRoot.path,
          path: sourceRootPath,
        }),
        packageRoot: packageRoot.path,
        path: sourceRootPath,
        reason: resolveSourceRootReason({
          aliasConfigPaths,
          packageRootPath: packageRoot.path,
          path: sourceRootPath,
        }),
      })),
    ),
  );
  const featureClusters = discoverFeatureClusters({
    filePaths,
    sourceRoots,
  });
  const notes = buildStructureDiscoveryNotes({
    aliasConfigPaths,
    featureClusters,
    packageRoots,
    sourceRoots,
  });

  return {
    aliasConfigPaths,
    featureClusters,
    notes,
    packageRoots: packageRoots.sort((left, right) => left.path.localeCompare(right.path)),
    sourceRoots,
  };
}

export function resolveNearestDiscoveredSourceRoot(
  discovery: ProjectAnalysisStructureDiscovery,
  path: string,
): ProjectAnalysisStructureDiscoverySourceRoot | null {
  const normalizedPath = normalizeRelativePath(path);

  return (
    [...discovery.sourceRoots]
      .filter((sourceRoot) => isPathInside(sourceRoot.path, normalizedPath))
      .sort((left, right) => right.path.length - left.path.length)[0] ?? null
  );
}

export function resolveDiscoveredFeatureClusterPath(
  discovery: ProjectAnalysisStructureDiscovery,
  path: string,
): string | null {
  const normalizedPath = normalizeRelativePath(path);

  return (
    [...discovery.featureClusters]
      .filter((cluster) => isPathInside(cluster.path, normalizedPath))
      .sort((left, right) => right.path.length - left.path.length)[0]?.path ?? null
  );
}

export function resolveDiscoveredWorkspacePackageCandidates(input: {
  discovery: ProjectAnalysisStructureDiscovery;
  specifier: string;
}): string[] {
  const candidates = new Set<string>();

  for (const packageRoot of input.discovery.packageRoots) {
    if (!packageRoot.packageName) {
      continue;
    }

    if (
      input.specifier !== packageRoot.packageName &&
      !input.specifier.startsWith(`${packageRoot.packageName}/`)
    ) {
      continue;
    }

    const subpath = input.specifier.slice(packageRoot.packageName.length).replace(/^\/+/u, '');

    for (const sourceRoot of packageRoot.sourceRoots) {
      if (subpath.length === 0) {
        candidates.add(sourceRoot);
        candidates.add(joinNormalized(sourceRoot, 'index'));
        continue;
      }

      candidates.add(joinNormalized(sourceRoot, subpath));
      candidates.add(joinNormalized(sourceRoot, subpath, 'index'));
    }

    if (subpath.length > 0) {
      candidates.add(joinNormalized(packageRoot.path, subpath));
    }
  }

  return [...candidates];
}

async function collectPackageRoots(input: {
  filePaths: string[];
  rootPath: string;
}): Promise<ProjectAnalysisStructureDiscoveryPackageRoot[]> {
  const candidates = new Map<string, ProjectAnalysisStructureDiscoveryPackageRoot>();

  for (const filePath of input.filePaths) {
    const fileName = filePath.split('/').pop();
    if (!fileName) {
      continue;
    }

    const manifestMetadata = PACKAGE_MANIFEST_FILES.get(fileName);
    if (!manifestMetadata) {
      continue;
    }

    const packageRootPath = normalizeRelativePath(dirname(filePath));
    const packageMetadata =
      fileName === 'package.json'
        ? await readPackageManifest({
            manifestPath: filePath,
            rootPath: input.rootPath,
          })
        : null;
    const existing = candidates.get(packageRootPath);

    if (existing && existing.confidence >= manifestMetadata.confidence) {
      continue;
    }

    candidates.set(packageRootPath, {
      confidence: manifestMetadata.confidence,
      packageName: packageMetadata?.name ?? existing?.packageName ?? null,
      path: packageRootPath,
      reason: manifestMetadata.reason,
      sourceRoots: [],
    });
  }

  if (candidates.size === 0) {
    candidates.set('.', {
      confidence: 0.55,
      packageName: null,
      path: '.',
      reason: '전용 빌드 루트를 찾지 못해 저장소 루트를 기본 패키지 경계로 사용합니다.',
      sourceRoots: [],
    });
  }

  return [...candidates.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function discoverSourceRootsForPackage(input: {
  aliasConfigPaths: string[];
  filePaths: string[];
  packageRootPath: string;
  rootPath: string;
  sourceSignalByPath: Map<string, string>;
}): ProjectAnalysisStructureDiscoverySourceRoot[] {
  const packageSourceFiles = input.filePaths.filter((filePath) => {
    if (!SOURCE_FILE_EXTENSIONS.has(getExtension(filePath))) {
      return false;
    }

    return isPathInside(input.packageRootPath, filePath);
  });
  const candidates = new Map<string, ProjectAnalysisStructureDiscoverySourceRoot>();

  for (const aliasConfigPath of input.aliasConfigPaths) {
    if (!isPathInside(input.packageRootPath, aliasConfigPath)) {
      continue;
    }

    const baseUrlCandidate = readBaseUrlSourceRoot({
      configPath: aliasConfigPath,
      rootPath: input.rootPath,
    });
    if (!baseUrlCandidate) {
      continue;
    }

    if (!hasFilesWithinDirectory(packageSourceFiles, baseUrlCandidate)) {
      continue;
    }

    candidates.set(baseUrlCandidate, {
      confidence: 0.92,
      kind: 'config',
      packageRoot: input.packageRootPath,
      path: baseUrlCandidate,
      reason: `${aliasConfigPath} 의 baseUrl 설정에서 소스 루트를 찾았습니다.`,
    });
  }

  for (const directoryName of SOURCE_ROOT_DIRECTORY_NAMES) {
    const conventionalRoot = joinNormalized(input.packageRootPath, directoryName);
    if (!hasFilesWithinDirectory(packageSourceFiles, conventionalRoot)) {
      continue;
    }

    if (!candidates.has(conventionalRoot)) {
      candidates.set(conventionalRoot, {
        confidence: 0.84,
        kind: 'convention',
        packageRoot: input.packageRootPath,
        path: conventionalRoot,
        reason: `${directoryName} 경로에 소스 파일이 집중되어 있습니다.`,
      });
    }
  }

  const densityCandidate = resolveDensitySourceRoot({
    packageRootPath: input.packageRootPath,
    packageSourceFiles,
    sourceSignalByPath: input.sourceSignalByPath,
  });
  if (densityCandidate && !candidates.has(densityCandidate.path)) {
    candidates.set(densityCandidate.path, densityCandidate);
  }

  if (candidates.size === 0 && packageSourceFiles.length > 0) {
    candidates.set(input.packageRootPath, {
      confidence: 0.58,
      kind: 'fallback',
      packageRoot: input.packageRootPath,
      path: input.packageRootPath,
      reason: '명시적 소스 루트를 찾지 못해 패키지 루트를 기본 소스 경계로 사용합니다.',
    });
  }

  return [...candidates.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function resolveDensitySourceRoot(input: {
  packageRootPath: string;
  packageSourceFiles: string[];
  sourceSignalByPath: Map<string, string>;
}): ProjectAnalysisStructureDiscoverySourceRoot | null {
  if (input.packageSourceFiles.length === 0) {
    return null;
  }

  const directFiles = input.packageSourceFiles.filter((filePath) => {
    const relativePath = trimPackagePrefix(filePath, input.packageRootPath);
    return !relativePath.includes('/');
  });
  if (directFiles.length >= 3) {
    return {
      confidence: 0.7,
      kind: 'density',
      packageRoot: input.packageRootPath,
      path: input.packageRootPath,
      reason: '소스 파일이 패키지 루트 바로 아래에 반복적으로 나타납니다.',
    };
  }

  const scores = new Map<string, number>();
  for (const filePath of input.packageSourceFiles) {
    const relativePath = trimPackagePrefix(filePath, input.packageRootPath);
    const topLevelSegment = relativePath.split('/')[0];
    if (!topLevelSegment) {
      continue;
    }

    const signalScore = estimateSourceSignalScore(input.sourceSignalByPath.get(filePath));
    scores.set(topLevelSegment, (scores.get(topLevelSegment) ?? 0) + signalScore);
  }

  const bestCandidate = [...scores.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  )[0];
  if (!bestCandidate || bestCandidate[1] < 3) {
    return null;
  }

  return {
    confidence: 0.67,
    kind: 'density',
    packageRoot: input.packageRootPath,
    path: joinNormalized(input.packageRootPath, bestCandidate[0]),
    reason: `${bestCandidate[0]} 경로 아래에 import/use/include 신호가 반복됩니다.`,
  };
}

function discoverFeatureClusters(input: {
  filePaths: string[];
  sourceRoots: ProjectAnalysisStructureDiscoverySourceRoot[];
}): ProjectAnalysisStructureDiscoveryFeatureCluster[] {
  const counts = new Map<string, { count: number; sourceRoot: string }>();

  for (const sourceRoot of input.sourceRoots) {
    const sourceFiles = input.filePaths.filter((filePath) =>
      isPathInside(sourceRoot.path, filePath),
    );
    for (const filePath of sourceFiles) {
      const clusterSegments = resolveClusterSegments(
        trimPackagePrefix(filePath, sourceRoot.path).split('/').filter(Boolean).slice(0, -1),
      );
      if (clusterSegments.length === 0) {
        continue;
      }

      const clusterPath = joinNormalized(sourceRoot.path, ...clusterSegments);
      const current = counts.get(clusterPath) ?? {
        count: 0,
        sourceRoot: sourceRoot.path,
      };
      current.count += 1;
      counts.set(clusterPath, current);
    }
  }

  return [...counts.entries()]
    .filter(([, value]) => value.count >= 2)
    .map(([path, value]) => ({
      confidence: Math.min(0.9, 0.45 + value.count * 0.08),
      path,
      reason: `같은 경로 축 아래에서 ${value.count}개 이상의 소스 파일이 반복됩니다.`,
      sourceRoot: value.sourceRoot,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function resolveClusterSegments(segments: string[]): string[] {
  const clusterSegments: string[] = [];

  for (const segment of segments) {
    const normalizedSegment = segment.toLowerCase();
    if (TEST_SEGMENTS.has(normalizedSegment)) {
      break;
    }

    if (STRUCTURAL_SEGMENTS.has(normalizedSegment)) {
      if (clusterSegments.length === 0) {
        continue;
      }
      break;
    }

    if (GENERIC_CLUSTER_SEGMENTS.has(normalizedSegment) && clusterSegments.length === 0) {
      continue;
    }

    clusterSegments.push(normalizedSegment);
    if (clusterSegments.length >= 2) {
      break;
    }
  }

  return clusterSegments;
}

function buildStructureDiscoveryNotes(input: {
  aliasConfigPaths: string[];
  featureClusters: ProjectAnalysisStructureDiscoveryFeatureCluster[];
  packageRoots: ProjectAnalysisStructureDiscoveryPackageRoot[];
  sourceRoots: ProjectAnalysisStructureDiscoverySourceRoot[];
}): string[] {
  const notes = new Set<string>();

  if (input.packageRoots.length > 1) {
    notes.add(`패키지 루트 ${input.packageRoots.length}개를 분리해 해석합니다.`);
  }

  if (input.sourceRoots.length > 0) {
    notes.add(`소스 루트 ${input.sourceRoots.length}개를 기준으로 분류와 참조 해석을 수행합니다.`);
  }

  if (input.aliasConfigPaths.length > 0) {
    notes.add(`alias 설정 파일 ${input.aliasConfigPaths.length}개를 구조 발견에 반영했습니다.`);
  }

  if (input.featureClusters.length > 0) {
    notes.add(`반복 feature cluster 후보 ${input.featureClusters.length}개를 찾았습니다.`);
  }

  if (notes.size === 0) {
    notes.add(
      '고정 루트 규칙 대신 저장소에 실제로 존재하는 경로 밀도를 기준으로 구조를 추정했습니다.',
    );
  }

  return [...notes];
}

async function readPackageManifest(input: {
  manifestPath: string;
  rootPath: string;
}): Promise<PackageManifestMetadata | null> {
  try {
    const raw = await readFile(resolve(input.rootPath, input.manifestPath), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const candidate = parsed as Record<string, unknown>;

    return {
      ...(typeof candidate.name === 'string' ? { name: candidate.name } : {}),
      ...(typeof candidate.main === 'string' ? { main: candidate.main } : {}),
    };
  } catch {
    return null;
  }
}

function readBaseUrlSourceRoot(input: { configPath: string; rootPath: string }): string | null {
  const fileName = input.configPath.split('/').pop() ?? input.configPath;
  if (!/^(?:tsconfig(?:\.[\w-]+)?|jsconfig)\.json$/u.test(fileName)) {
    return null;
  }

  const parsedConfig = ts.getParsedCommandLineOfConfigFile(
    resolve(input.rootPath, input.configPath),
    {},
    createTypeScriptConfigParseHost(),
  );
  if (!parsedConfig?.options.baseUrl) {
    return null;
  }

  return normalizeRelativePath(relative(input.rootPath, parsedConfig.options.baseUrl));
}

function createTypeScriptConfigParseHost(): ts.ParseConfigFileHost {
  const realpath = (path: string): string => ts.sys.realpath?.(path) ?? path;

  return {
    directoryExists: (path) => ts.sys.directoryExists(path),
    fileExists: (path) => ts.sys.fileExists(path),
    getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
    onUnRecoverableConfigFileDiagnostic: () => {},
    readDirectory: (rootDir, extensions, excludes, includes, depth) =>
      ts.sys.readDirectory(rootDir, extensions, excludes, includes, depth),
    readFile: (path) => ts.sys.readFile(path),
    realpath,
    trace: () => {},
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
  };
}

function resolveSourceRootKind(input: {
  aliasConfigPaths: string[];
  packageRootPath: string;
  path: string;
}): string {
  if (
    input.aliasConfigPaths.some((configPath) => {
      return (
        isPathInside(input.packageRootPath, configPath) &&
        normalizeRelativePath(dirname(configPath)) === normalizeRelativePath(dirname(input.path))
      );
    })
  ) {
    return 'config';
  }

  const lastSegment = input.path.split('/').pop() ?? input.path;
  return SOURCE_ROOT_DIRECTORY_NAMES.includes(lastSegment) ? 'convention' : 'density';
}

function resolveSourceRootConfidence(input: {
  aliasConfigPaths: string[];
  packageRootPath: string;
  path: string;
}): number {
  const kind = resolveSourceRootKind(input);
  if (kind === 'config') {
    return 0.92;
  }
  if (kind === 'convention') {
    return 0.84;
  }

  return 0.67;
}

function resolveSourceRootReason(input: {
  aliasConfigPaths: string[];
  packageRootPath: string;
  path: string;
}): string {
  const kind = resolveSourceRootKind(input);
  if (kind === 'config') {
    const configPath =
      input.aliasConfigPaths.find((candidatePath) =>
        isPathInside(input.packageRootPath, candidatePath),
      ) ?? input.aliasConfigPaths[0];
    return configPath
      ? `${configPath} 설정을 따라 소스 루트를 확인했습니다.`
      : '설정 파일 기준으로 소스 루트를 확인했습니다.';
  }
  if (kind === 'convention') {
    return '대표적인 소스 디렉터리 이름과 실제 파일 분포가 일치합니다.';
  }

  return '실제 소스 파일 밀도와 import/use/include 신호를 기준으로 소스 루트를 추정했습니다.';
}

function estimateSourceSignalScore(content: string | undefined): number {
  if (!content) {
    return 1;
  }

  const importMatches =
    content.match(/\b(?:import|require|use|include|include_once|require_once)\b/gu)?.length ?? 0;

  return Math.max(1, Math.min(importMatches + 1, 8));
}

function hasFilesWithinDirectory(filePaths: string[], directoryPath: string): boolean {
  return filePaths.some((filePath) => isPathInside(directoryPath, filePath));
}

function isPathInside(directoryPath: string, filePath: string): boolean {
  const normalizedDirectoryPath = normalizeRelativePath(directoryPath);
  const normalizedFilePath = normalizeRelativePath(filePath);

  if (normalizedDirectoryPath === '.' || normalizedDirectoryPath.length === 0) {
    return true;
  }

  return (
    normalizedFilePath === normalizedDirectoryPath ||
    normalizedFilePath.startsWith(`${normalizedDirectoryPath}/`)
  );
}

function trimPackagePrefix(path: string, prefix: string): string {
  const normalizedPath = normalizeRelativePath(path);
  const normalizedPrefix = normalizeRelativePath(prefix);

  if (normalizedPrefix === '.' || normalizedPrefix.length === 0) {
    return normalizedPath;
  }

  return normalizedPath.slice(normalizedPrefix.length).replace(/^\/+/u, '');
}

function joinNormalized(...segments: string[]): string {
  return normalizeRelativePath(
    segments.filter((segment) => segment.length > 0 && segment !== '.').join('/'),
  );
}

function getExtension(path: string): string {
  const fileName = path.split('/').pop() ?? path;
  const dotIndex = fileName.lastIndexOf('.');

  return dotIndex < 0 ? '' : fileName.slice(dotIndex).toLowerCase();
}

function deduplicateSourceRoots(
  sourceRoots: ProjectAnalysisStructureDiscoverySourceRoot[],
): ProjectAnalysisStructureDiscoverySourceRoot[] {
  const deduplicated = new Map<string, ProjectAnalysisStructureDiscoverySourceRoot>();

  for (const sourceRoot of sourceRoots) {
    const existing = deduplicated.get(sourceRoot.path);
    if (!existing || existing.confidence < sourceRoot.confidence) {
      deduplicated.set(sourceRoot.path, sourceRoot);
    }
  }

  return [...deduplicated.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function normalizeRelativePath(value: string): string {
  return value.replaceAll('\\', '/');
}
