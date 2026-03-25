import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

import {
  ENTRYPOINT_CANDIDATES,
  IGNORED_DIRECTORIES,
  KEY_CONFIG_MATCHERS,
  LOCKFILE_TO_PACKAGE_MANAGER,
  MAX_DIRECTORY_COUNT,
  MAX_FILE_COUNT,
  MAX_SCAN_DEPTH,
  MODULE_ROOT_DIRECTORIES,
} from '@/infrastructure/analysis/project-analysis.constants';

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  main?: string;
}

export interface ProjectAnalysisScanState {
  directories: Set<string>;
  entrypoints: Set<string>;
  files: Set<string>;
  keyConfigs: Set<string>;
  languageExtensions: Set<string>;
  modules: Set<string>;
  packageJson: PackageJsonShape | null;
  packageManager: string | null;
  reachedDirectoryLimit: boolean;
  reachedFileLimit: boolean;
}

export function createEmptyProjectAnalysisScanState(): ProjectAnalysisScanState {
  return {
    directories: new Set<string>(),
    entrypoints: new Set<string>(),
    files: new Set<string>(),
    keyConfigs: new Set<string>(),
    languageExtensions: new Set<string>(),
    modules: new Set<string>(),
    packageJson: null,
    packageManager: null,
    reachedDirectoryLimit: false,
    reachedFileLimit: false,
  };
}

export async function scanProjectAnalysis(input: {
  currentPath: string;
  depth: number;
  rootPath: string;
  scanState: ProjectAnalysisScanState;
}): Promise<void> {
  if (input.depth > MAX_SCAN_DEPTH) {
    return;
  }

  const entries = await readdir(input.currentPath, {
    withFileTypes: true,
  });

  const sortedEntries = [...entries].sort((left, right) =>
    compareScanEntries({
      currentPath: input.currentPath,
      left,
      right,
      rootPath: input.rootPath,
    }),
  );

  for (const entry of sortedEntries) {
    if (entry.isDirectory()) {
      if (shouldIgnoreDirectory(entry.name)) {
        continue;
      }

      if (input.scanState.directories.size >= MAX_DIRECTORY_COUNT) {
        input.scanState.reachedDirectoryLimit = true;
        break;
      }

      const nextPath = join(input.currentPath, entry.name);
      const relativePath = normalizeRelativePath(relative(input.rootPath, nextPath));
      input.scanState.directories.add(relativePath);
      collectModulePath({
        modules: input.scanState.modules,
        relativePath,
      });

      await scanProjectAnalysis({
        currentPath: nextPath,
        depth: input.depth + 1,
        rootPath: input.rootPath,
        scanState: input.scanState,
      });
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const filePath = join(input.currentPath, entry.name);
    const relativePath = normalizeRelativePath(relative(input.rootPath, filePath));
    const shouldTrackFile = shouldTrackAnalysisFile({
      fileName: entry.name,
      relativePath,
    });

    collectLanguageExtension({
      fileName: entry.name,
      languageExtensions: input.scanState.languageExtensions,
    });

    if (matchesKeyConfig(entry.name)) {
      input.scanState.keyConfigs.add(relativePath);
    }

    if (isEntrypointCandidate(relativePath, entry.name)) {
      input.scanState.entrypoints.add(relativePath);
    }

    const packageManager = LOCKFILE_TO_PACKAGE_MANAGER[entry.name];
    if (packageManager) {
      input.scanState.packageManager = packageManager;
    }

    if (entry.name === 'package.json') {
      const parsedPackageJson = await readPackageJson(filePath);
      input.scanState.packageJson = mergePackageJsonShapes({
        existing: input.scanState.packageJson,
        next: parsedPackageJson,
        preferMain: relativePath === 'package.json',
      });
      const packageMain = parsedPackageJson?.main;
      if (typeof packageMain === 'string' && packageMain.length > 0) {
        input.scanState.entrypoints.add(
          normalizeRelativePath(relative(input.rootPath, resolve(input.currentPath, packageMain))),
        );
      }
    }

    if (!shouldTrackFile) {
      continue;
    }

    if (input.scanState.files.size >= MAX_FILE_COUNT) {
      input.scanState.reachedFileLimit = true;
      break;
    }

    input.scanState.files.add(relativePath);
  }
}

function collectLanguageExtension(input: {
  fileName: string;
  languageExtensions: Set<string>;
}): void {
  const extension = extname(input.fileName).toLowerCase();
  if (!extension) {
    return;
  }

  const language = getLanguageName(extension);
  if (language) {
    input.languageExtensions.add(language);
  }
}

function compareScanEntries(input: {
  currentPath: string;
  left: Dirent;
  right: Dirent;
  rootPath: string;
}): number {
  const leftPriority = getScanEntryPriority({
    currentPath: input.currentPath,
    entry: input.left,
    rootPath: input.rootPath,
  });
  const rightPriority = getScanEntryPriority({
    currentPath: input.currentPath,
    entry: input.right,
    rootPath: input.rootPath,
  });

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return input.left.name.localeCompare(input.right.name);
}

function getScanEntryPriority(input: {
  currentPath: string;
  entry: Dirent;
  rootPath: string;
}): number {
  const relativePath = normalizeRelativePath(
    relative(input.rootPath, join(input.currentPath, input.entry.name)),
  );

  if (input.entry.isFile() && matchesKeyConfig(input.entry.name)) {
    return 0;
  }

  if (input.entry.isFile() && isEntrypointCandidate(relativePath, input.entry.name)) {
    return 1;
  }

  if (input.entry.isFile() && isSupportedSourceFile(input.entry.name)) {
    return 2;
  }

  if (input.entry.isDirectory() && MODULE_ROOT_DIRECTORIES.has(input.entry.name)) {
    return 3;
  }

  if (input.entry.isDirectory()) {
    return 4;
  }

  if (input.entry.isFile()) {
    return 5;
  }

  return 6;
}

function shouldIgnoreDirectory(name: string): boolean {
  if (IGNORED_DIRECTORIES.has(name)) {
    return true;
  }

  return name.startsWith('.');
}

function isSupportedSourceFile(fileName: string): boolean {
  return getLanguageName(extname(fileName).toLowerCase()) !== null;
}

function shouldTrackAnalysisFile(input: {
  fileName: string;
  relativePath: string;
}): boolean {
  if (matchesKeyConfig(input.fileName)) {
    return true;
  }

  if (LOCKFILE_TO_PACKAGE_MANAGER[input.fileName]) {
    return true;
  }

  if (isEntrypointCandidate(input.relativePath, input.fileName)) {
    return true;
  }

  const extension = extname(input.fileName).toLowerCase();
  return (
    extension === '.cjs' ||
    extension === '.cts' ||
    extension === '.json' ||
    extension === '.java' ||
    extension === '.js' ||
    extension === '.jsx' ||
    extension === '.kt' ||
    extension === '.kts' ||
    extension === '.mjs' ||
    extension === '.mts' ||
    extension === '.php' ||
    extension === '.ts' ||
    extension === '.tsx' ||
    extension === '.vue'
  );
}

function getLanguageName(extension: string): string | null {
  if (extension === '.ts' || extension === '.tsx' || extension === '.mts' || extension === '.cts') {
    return 'TypeScript';
  }

  if (extension === '.vue') {
    return 'Vue';
  }

  if (extension === '.js' || extension === '.jsx' || extension === '.mjs' || extension === '.cjs') {
    return 'JavaScript';
  }

  if (extension === '.css' || extension === '.scss' || extension === '.sass') {
    return 'CSS';
  }

  if (extension === '.json') {
    return 'JSON';
  }

  if (extension === '.kt' || extension === '.kts') {
    return 'Kotlin';
  }

  if (extension === '.php') {
    return 'PHP';
  }

  if (extension === '.java') {
    return 'Java';
  }

  if (extension === '.md') {
    return 'Markdown';
  }

  return null;
}

function matchesKeyConfig(fileName: string): boolean {
  return KEY_CONFIG_MATCHERS.some((matcher) => matcher.test(fileName));
}

function isEntrypointCandidate(relativePath: string, fileName: string): boolean {
  if (ENTRYPOINT_CANDIDATES.has(fileName)) {
    return true;
  }

  return (
    relativePath.startsWith('src/') &&
    (fileName.startsWith('main.') || fileName.startsWith('index.') || fileName.startsWith('app.'))
  );
}

function collectModulePath(input: {
  modules: Set<string>;
  relativePath: string;
}): void {
  const segments = input.relativePath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  const [firstSegment, secondSegment] = segments;
  if (!firstSegment) {
    return;
  }

  if (!MODULE_ROOT_DIRECTORIES.has(firstSegment)) {
    return;
  }

  if (firstSegment === 'src' && secondSegment) {
    input.modules.add(`src/${secondSegment}`);
    return;
  }

  if (
    (firstSegment === 'apps' ||
      firstSegment === 'libs' ||
      firstSegment === 'modules' ||
      firstSegment === 'packages') &&
    secondSegment
  ) {
    const moduleRootPath = resolveMonorepoModulePath(segments);
    if (moduleRootPath) {
      input.modules.add(moduleRootPath);
      return;
    }

    input.modules.add(`${firstSegment}/${secondSegment}`);
    return;
  }

  input.modules.add(firstSegment);
}

function resolveMonorepoModulePath(segments: string[]): string | null {
  if (segments.length < 2) {
    return null;
  }

  let moduleRootLength = 2;
  for (const segment of segments.slice(2)) {
    const normalizedSegment = segment.toLowerCase();
    if (
      normalizedSegment === 'src' ||
      normalizedSegment === 'test' ||
      normalizedSegment === 'tests' ||
      segment.includes('.')
    ) {
      break;
    }

    moduleRootLength += 1;
  }

  return segments.slice(0, moduleRootLength).join('/');
}

async function readPackageJson(filePath: string): Promise<PackageJsonShape | null> {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return parsed as PackageJsonShape;
  } catch {
    return null;
  }
}

function mergePackageJsonShapes(input: {
  existing: PackageJsonShape | null;
  next: PackageJsonShape | null;
  preferMain: boolean;
}): PackageJsonShape | null {
  if (!input.existing) {
    return input.next;
  }

  if (!input.next) {
    return input.existing;
  }

  const mergedMain =
    input.preferMain && typeof input.next.main === 'string' && input.next.main.length > 0
      ? input.next.main
      : input.existing.main;

  return {
    dependencies: {
      ...input.existing.dependencies,
      ...input.next.dependencies,
    },
    devDependencies: {
      ...input.existing.devDependencies,
      ...input.next.devDependencies,
    },
    ...(typeof mergedMain === 'string' && mergedMain.length > 0 ? { main: mergedMain } : {}),
  };
}

function normalizeRelativePath(value: string): string {
  return value.replaceAll('\\', '/');
}
