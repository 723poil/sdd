import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

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

    if (input.scanState.files.size >= MAX_FILE_COUNT) {
      input.scanState.reachedFileLimit = true;
      break;
    }

    const filePath = join(input.currentPath, entry.name);
    const relativePath = normalizeRelativePath(relative(input.rootPath, filePath));

    input.scanState.files.add(relativePath);
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
      input.scanState.packageJson = await readPackageJson(filePath);
      const packageMain = input.scanState.packageJson?.main;
      if (typeof packageMain === 'string' && packageMain.length > 0) {
        input.scanState.entrypoints.add(normalizeRelativePath(packageMain));
      }
    }
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

function getLanguageName(extension: string): string | null {
  if (extension === '.ts' || extension === '.tsx') {
    return 'TypeScript';
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

  if ((firstSegment === 'packages' || firstSegment === 'apps') && secondSegment) {
    input.modules.add(`${firstSegment}/${secondSegment}`);
    return;
  }

  input.modules.add(firstSegment);
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

function normalizeRelativePath(value: string): string {
  return value.replaceAll('\\', '/');
}
