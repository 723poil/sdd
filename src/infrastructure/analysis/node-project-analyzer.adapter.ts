import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, join, relative, resolve } from 'node:path';

import type { ProjectAnalyzerPort } from '@/application/project/project.ports';
import { createProjectError } from '@/domain/project/project-errors';
import type {
  ProjectAnalysisContext,
  ProjectAnalysisDraft,
} from '@/domain/project/project-analysis-model';
import { ANALYSIS_CONTEXT_SCHEMA_VERSION } from '@/domain/project/project-model';
import { err, ok } from '@/shared/contracts/result';

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.idea',
  '.next',
  '.nuxt',
  '.sdd',
  '.turbo',
  '.vscode',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'target',
]);

const MODULE_ROOT_DIRECTORIES = new Set([
  'app',
  'apps',
  'client',
  'main',
  'packages',
  'renderer',
  'server',
  'services',
  'src',
  'web',
]);

const KEY_CONFIG_MATCHERS = [
  /^package\.json$/u,
  /^tsconfig(?:\.[\w-]+)?\.json$/u,
  /^vite\.config\./u,
  /^vitest\.config\./u,
  /^next\.config\./u,
  /^nuxt\.config\./u,
  /^electron\.vite\.config\./u,
  /^eslint\.config\./u,
  /^prettier\.config\./u,
  /^tailwind\.config\./u,
  /^postcss\.config\./u,
  /^turbo\.json$/u,
  /^pnpm-workspace\.yaml$/u,
];

const ENTRYPOINT_CANDIDATES = new Set([
  'index.js',
  'index.jsx',
  'index.ts',
  'index.tsx',
  'main.js',
  'main.jsx',
  'main.ts',
  'main.tsx',
  'server.js',
  'server.ts',
  'app.js',
  'app.ts',
]);

const LOCKFILE_TO_PACKAGE_MANAGER: Record<string, string> = {
  'pnpm-lock.yaml': 'pnpm',
  'package-lock.json': 'npm',
  'yarn.lock': 'yarn',
  'bun.lockb': 'bun',
  'bun.lock': 'bun',
};

const MAX_SCAN_DEPTH = 4;
const MAX_DIRECTORY_COUNT = 160;
const MAX_FILE_COUNT = 420;

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  main?: string;
}

interface ScanState {
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

export function createNodeProjectAnalyzerAdapter(): ProjectAnalyzerPort {
  return {
    async analyzeProject(input) {
      const rootPath = resolve(input.rootPath);

      try {
        const scanState: ScanState = {
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

        await scanDirectory({
          currentPath: rootPath,
          depth: 0,
          rootPath,
          scanState,
        });

        const detectedFrameworks = detectFrameworks(scanState);
        const detectedStack = buildDetectedStack({
          detectedFrameworks,
          languageExtensions: scanState.languageExtensions,
          packageManager: scanState.packageManager,
        });

        const unknowns = buildUnknowns({
          detectedFrameworks,
          entrypoints: scanState.entrypoints,
          hasPackageJson: scanState.packageJson !== null,
          reachedDirectoryLimit: scanState.reachedDirectoryLimit,
          reachedFileLimit: scanState.reachedFileLimit,
        });

        const context: ProjectAnalysisContext = {
          schemaVersion: ANALYSIS_CONTEXT_SCHEMA_VERSION,
          files: toSortedArray(scanState.files),
          directories: toSortedArray(scanState.directories),
          detectedFrameworks,
          entrypoints: toSortedArray(scanState.entrypoints),
          keyConfigs: toSortedArray(scanState.keyConfigs),
          modules: toSortedArray(scanState.modules),
          unknowns,
          confidence: calculateConfidence({
            detectedFrameworks,
            entrypoints: scanState.entrypoints,
            hasPackageJson: scanState.packageJson !== null,
            keyConfigs: scanState.keyConfigs,
            modules: scanState.modules,
            unknowns,
          }),
        };

        return ok({
          context,
          detectedStack,
          summaryMarkdown: createSummaryMarkdown({
            context,
            packageManager: scanState.packageManager,
            projectName: input.projectName,
          }),
        } satisfies ProjectAnalysisDraft);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '프로젝트 분석 중 알 수 없는 오류가 발생했습니다.';

        return err(createProjectError('INVALID_PROJECT_STORAGE', '프로젝트 분석에 실패했습니다.', message));
      }
    },
  };
}

async function scanDirectory(input: {
  currentPath: string;
  depth: number;
  rootPath: string;
  scanState: ScanState;
}): Promise<void> {
  if (input.depth > MAX_SCAN_DEPTH) {
    return;
  }

  const entries = await readdir(input.currentPath, {
    withFileTypes: true,
  });

  const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of sortedEntries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
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
        directories: input.scanState.directories,
        modules: input.scanState.modules,
        relativePath,
      });

      await scanDirectory({
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
  directories: Set<string>;
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

function detectFrameworks(scanState: ScanState): string[] {
  const frameworks = new Set<string>();
  const dependencies = {
    ...scanState.packageJson?.dependencies,
    ...scanState.packageJson?.devDependencies,
  };

  if (scanState.packageJson !== null) {
    frameworks.add('Node.js');
  }

  if ('typescript' in dependencies || hasNamedConfig(scanState.keyConfigs, 'tsconfig')) {
    frameworks.add('TypeScript');
  }

  if ('electron' in dependencies || hasNamedConfig(scanState.keyConfigs, 'electron.vite.config')) {
    frameworks.add('Electron');
  }

  if ('react' in dependencies) {
    frameworks.add('React');
  }

  if ('vite' in dependencies || hasNamedConfig(scanState.keyConfigs, 'vite.config')) {
    frameworks.add('Vite');
  }

  if ('next' in dependencies || hasNamedConfig(scanState.keyConfigs, 'next.config')) {
    frameworks.add('Next.js');
  }

  if ('express' in dependencies) {
    frameworks.add('Express');
  }

  if ('@nestjs/core' in dependencies) {
    frameworks.add('NestJS');
  }

  if ('vue' in dependencies) {
    frameworks.add('Vue');
  }

  if ('svelte' in dependencies) {
    frameworks.add('Svelte');
  }

  if ('@tauri-apps/api' in dependencies || '@tauri-apps/cli' in dependencies) {
    frameworks.add('Tauri');
  }

  if ('turbo' in dependencies || hasNamedConfig(scanState.keyConfigs, 'turbo.json')) {
    frameworks.add('Turborepo');
  }

  return toSortedArray(frameworks);
}

function hasNamedConfig(keyConfigs: Set<string>, segment: string): boolean {
  return [...keyConfigs].some((configPath) => basename(configPath).startsWith(segment));
}

function buildDetectedStack(input: {
  detectedFrameworks: string[];
  languageExtensions: Set<string>;
  packageManager: string | null;
}): string[] {
  const detectedStack = new Set<string>(input.detectedFrameworks);

  for (const language of input.languageExtensions) {
    if (language === 'TypeScript' || language === 'JavaScript') {
      detectedStack.add(language);
    }
  }

  if (input.packageManager) {
    detectedStack.add(input.packageManager);
  }

  return toSortedArray(detectedStack);
}

function buildUnknowns(input: {
  detectedFrameworks: string[];
  entrypoints: Set<string>;
  hasPackageJson: boolean;
  reachedDirectoryLimit: boolean;
  reachedFileLimit: boolean;
}): string[] {
  const unknowns = new Set<string>();

  if (!input.hasPackageJson) {
    unknowns.add('package.json 을 찾지 못했습니다.');
  }

  if (input.detectedFrameworks.length === 0) {
    unknowns.add('사용 중인 프레임워크를 확신하기 어렵습니다.');
  }

  if (input.entrypoints.size === 0) {
    unknowns.add('명확한 진입점을 자동으로 찾지 못했습니다.');
  }

  if (input.reachedDirectoryLimit || input.reachedFileLimit) {
    unknowns.add('스캔 범위를 제한해 일부 폴더는 분석에서 제외되었습니다.');
  }

  return toSortedArray(unknowns);
}

function calculateConfidence(input: {
  detectedFrameworks: string[];
  entrypoints: Set<string>;
  hasPackageJson: boolean;
  keyConfigs: Set<string>;
  modules: Set<string>;
  unknowns: string[];
}): number {
  let confidence = 0.2;

  if (input.hasPackageJson) {
    confidence += 0.2;
  }

  if (input.detectedFrameworks.length > 0) {
    confidence += 0.2;
  }

  if (input.entrypoints.size > 0) {
    confidence += 0.15;
  }

  if (input.keyConfigs.size > 0) {
    confidence += 0.1;
  }

  if (input.modules.size > 0) {
    confidence += 0.1;
  }

  if (input.unknowns.length === 0) {
    confidence += 0.05;
  }

  return Number(Math.min(0.95, confidence).toFixed(2));
}

function createSummaryMarkdown(input: {
  context: ProjectAnalysisContext;
  packageManager: string | null;
  projectName: string;
}): string {
  const lines = [
    `# ${input.projectName}`,
    '',
    '## 프로젝트 개요',
    '',
    createBullet(
      '감지한 스택',
      input.context.detectedFrameworks.length > 0 ? input.context.detectedFrameworks.join(', ') : '확인 중',
    ),
    createBullet('신뢰도', `${Math.round(input.context.confidence * 100)}%`),
    createBullet('패키지 매니저', input.packageManager ?? '확인하지 못함'),
    '',
    '## 핵심 모듈',
    '',
    ...createBulletList(input.context.modules, '구조상 눈에 띄는 모듈을 찾지 못했습니다.'),
    '',
    '## 엔트리포인트 후보',
    '',
    ...createBulletList(input.context.entrypoints, '자동으로 찾은 진입점이 없습니다.'),
    '',
    '## 주요 설정 파일',
    '',
    ...createBulletList(input.context.keyConfigs, '주요 설정 파일을 찾지 못했습니다.'),
    '',
    '## 추가 확인 필요',
    '',
    ...createBulletList(input.context.unknowns, '추가 확인이 필요한 항목은 아직 없습니다.'),
    '',
  ];

  return lines.join('\n');
}

function createBullet(label: string, value: string): string {
  return `- ${label}: ${value}`;
}

function createBulletList(values: string[], emptyMessage: string): string[] {
  if (values.length === 0) {
    return [`- ${emptyMessage}`];
  }

  return values.slice(0, 6).map((value) => `- ${value}`);
}

function toSortedArray(values: Set<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function normalizeRelativePath(value: string): string {
  return value.replaceAll('\\', '/');
}
