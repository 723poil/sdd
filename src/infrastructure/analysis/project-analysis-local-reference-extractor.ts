import { readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';

import ts from 'typescript';

import type {
  ProjectAnalysisConnection,
  ProjectAnalysisDirectorySummary,
  ProjectAnalysisFileClassification,
  ProjectAnalysisFileGrouping,
  ProjectAnalysisFileIndexEntry,
  ProjectAnalysisFileReference,
  ProjectAnalysisFileReferenceTarget,
  ProjectAnalysisLayerSummary,
  ProjectAnalysisReferenceAnalysis,
  ProjectAnalysisStructureDiscovery,
  ProjectAnalysisUnresolvedFileReference,
  ProjectAnalysisUnresolvedFileReferenceTarget,
} from '@/domain/project/project-analysis-model';

import {
  createFileSummary,
  describeDirectoryRole,
  describeLayerResponsibility,
  getFileCategoryDisplayName,
  getLanguageDisplayName,
  getLayerAreaDisplayName,
  type SupportedSourceLanguage,
} from '@/infrastructure/analysis/project-analysis-file-descriptions';
import {
  createProjectPathAliasResolver,
  type AliasMatcher,
  type PathAliasConfig,
  type ProjectPathAliasResolver,
} from '@/infrastructure/analysis/project-analysis-path-alias-resolver';
import {
  MAX_DIRECTORY_COUNT,
  MAX_FILE_COUNT,
  MAX_SCAN_DEPTH,
} from '@/infrastructure/analysis/project-analysis.constants';
import type { ProjectAnalysisScanState } from '@/infrastructure/analysis/project-analysis-scanner';
import {
  discoverProjectAnalysisStructure,
  resolveDiscoveredFeatureClusterPath,
  resolveDiscoveredWorkspacePackageCandidates,
  resolveNearestDiscoveredSourceRoot,
} from '@/infrastructure/analysis/project-analysis-structure-discovery';
import { parseVueSingleFileComponent } from '@/infrastructure/analysis/project-analysis-vue-sfc';

const SUPPORTED_SOURCE_EXTENSIONS = new Map<string, SupportedSourceLanguage>([
  ['.ts', 'typescript'],
  ['.tsx', 'typescript'],
  ['.mts', 'typescript'],
  ['.cts', 'typescript'],
  ['.js', 'javascript'],
  ['.jsx', 'javascript'],
  ['.mjs', 'javascript'],
  ['.cjs', 'javascript'],
  ['.vue', 'vue'],
  ['.kt', 'kotlin'],
  ['.kts', 'kotlin'],
  ['.php', 'php'],
  ['.java', 'java'],
]);

const SOURCE_RESOLUTION_EXTENSIONS = [
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
  '.json',
] as const;

const JAVASCRIPT_RUNTIME_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs']);
const MONOREPO_ROOT_DIRECTORIES = new Set(['apps', 'libs', 'modules', 'packages']);
const ROOT_AREA_NAMES = new Set([
  'api',
  'application',
  'core',
  'domain',
  'infrastructure',
  'main',
  'preload',
  'renderer',
  'shared',
  'test',
  'tests',
  'util',
  'utils',
]);
const LOW_GRANULARITY_AREAS = new Set([
  'application',
  'core',
  'infrastructure',
  'main',
  'preload',
  'renderer',
  'shared',
  'util',
]);
const TEST_PATH_SEGMENTS = new Set(['test', 'tests', '__test__', '__tests__', '__mocks__']);
const STRUCTURAL_PATH_SEGMENTS = new Set([
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
  'type',
  'types',
  'util',
  'utils',
  'validator',
  'validators',
]);
const DEFAULT_FEATURE_SCOPE_LIMIT = 2;
const DEFAULT_DIRECTORY_SUMMARY_LIMIT = 12;
const DEFAULT_CONNECTION_LIMIT = 12;
const PHP_APPLICATION_UNBOUNDED_SCOPE_ROOTS = new Set([
  'controller',
  'controllers',
  'domain',
  'model',
  'models',
  'service',
  'services',
]);
const PHP_PATH_CONSTANT_BASE_PATHS = {
  APPPATH: 'application',
  BASEPATH: 'system',
  FCPATH: '.',
} as const;
const PHPDOC_TYPE_TAGS = new Set([
  'param',
  'return',
  'var',
  'throws',
  'property',
  'property-read',
  'property-write',
  'mixin',
  'extends',
  'implements',
  'use',
  'phpstan-param',
  'phpstan-return',
  'phpstan-var',
  'phpstan-throws',
  'phpstan-property',
  'phpstan-property-read',
  'phpstan-property-write',
  'phpstan-mixin',
  'phpstan-extends',
  'phpstan-implements',
  'phpstan-use',
  'psalm-param',
  'psalm-return',
  'psalm-var',
  'psalm-throws',
  'psalm-property',
  'psalm-property-read',
  'psalm-property-write',
  'psalm-mixin',
  'psalm-extends',
  'psalm-implements',
  'psalm-use',
]);
const PHPDOC_RESERVED_TYPE_NAMES = new Set([
  '$this',
  'array',
  'array-key',
  'bool',
  'boolean',
  'callable',
  'callable-array',
  'callable-string',
  'class-string',
  'closed-resource',
  'double',
  'false',
  'float',
  'from',
  'int',
  'integer',
  'interface-string',
  'iterable',
  'key-of',
  'list',
  'literal-string',
  'lowercase-string',
  'mixed',
  'negative-int',
  'never',
  'non-empty-array',
  'non-empty-list',
  'non-empty-string',
  'non-negative-int',
  'non-positive-int',
  'null',
  'numeric',
  'numeric-string',
  'object',
  'open-resource',
  'parent',
  'positive-int',
  'resource',
  'scalar',
  'self',
  'static',
  'string',
  'this',
  'to',
  'trait-string',
  'true',
  'value-of',
  'void',
]);

type ExtractedReferenceRelationship =
  | 'imports'
  | 'requires'
  | 'dynamic-import'
  | 'includes'
  | 'loads'
  | 'uses'
  | 'phpdoc'
  | 'extends'
  | 'implements'
  | 'instantiates'
  | 'decorates'
  | 'module-imports'
  | 'provides'
  | 'registers-controller'
  | 'exports';

interface LoadedSourceFile {
  additionalReferences: Array<{
    relationship: ExtractedReferenceRelationship;
    specifier: string;
  }>;
  path: string;
  language: SupportedSourceLanguage;
  content: string;
  baseName: string;
  packageName: string | null;
  namespaceName: string | null;
  declarations: string[];
  scriptKind: ts.ScriptKind;
}

interface PhpUseImport {
  alias: string;
  kind: 'class' | 'function' | 'const';
  qualifiedName: string;
}

type PhpFrameworkLoadKind = 'config' | 'helper' | 'library' | 'model' | 'service';

interface PhpFrameworkLoadReference {
  kind: PhpFrameworkLoadKind;
  path: string;
}

interface PhpIncludeReference {
  path: string;
  rawSpecifier: string;
  rootConstant: keyof typeof PHP_PATH_CONSTANT_BASE_PATHS | null;
}

interface ExtractedReference {
  from: string;
  relationship: ExtractedReferenceRelationship;
  specifier: string;
  to: string;
}

interface UnresolvedExtractedReference extends ProjectAnalysisUnresolvedFileReference {
  relationship: ExtractedReferenceRelationship;
}

interface ExtractedStructuralHint {
  confidence: number;
  kind: string;
  reason: string;
  value: string;
}

interface ReferenceResolution {
  candidatePaths: string[];
  reason: string;
  resolutionKind: string;
  resolvedPath: string | null;
}

interface ReferenceExtractionResult {
  path: string;
  resolvedReferences: ExtractedReference[];
  structuralHints: ExtractedStructuralHint[];
  unresolvedReferences: UnresolvedExtractedReference[];
}

interface LayerConnectionAccumulator {
  count: number;
  from: string;
  samples: string[];
  to: string;
}

interface FileClassification {
  category: string;
  classification: ProjectAnalysisFileClassification;
  grouping: ProjectAnalysisFileGrouping;
  layer: string | null;
  role: string;
}

export interface LocalProjectReferenceAnalysis {
  connections: ProjectAnalysisConnection[];
  directorySummaries: ProjectAnalysisDirectorySummary[];
  fileIndex: ProjectAnalysisFileIndexEntry[];
  fileReferences: ProjectAnalysisFileReference[];
  layers: ProjectAnalysisLayerSummary[];
  referenceAnalysis: ProjectAnalysisReferenceAnalysis;
}

export async function analyzeLocalProjectReferences(input: {
  rootPath: string;
  scanState: ProjectAnalysisScanState;
}): Promise<LocalProjectReferenceAnalysis> {
  const filePaths = [...input.scanState.files].map((path) => normalizeRelativePath(path));
  const allFilePaths = new Set(filePaths);
  const caseInsensitiveFilePathIndex = buildCaseInsensitiveFilePathIndex(allFilePaths);
  const pathAliasResolver = createProjectPathAliasResolver({
    rootPath: input.rootPath,
    scanState: input.scanState,
  });
  const sourceFiles = await loadSourceFiles({
    allFilePaths,
    rootPath: input.rootPath,
  });
  const structureDiscovery = await discoverProjectAnalysisStructure({
    rootPath: input.rootPath,
    scanState: input.scanState,
    sourceFiles: sourceFiles.map((file) => ({
      content: file.content,
      path: file.path,
    })),
  });

  const packageSymbolIndex = buildPackageSymbolIndex(sourceFiles);
  const knownPackageNames = new Set(
    sourceFiles
      .map((file) => file.packageName)
      .filter((packageName): packageName is string => Boolean(packageName)),
  );
  const namespaceSymbolIndex = buildNamespaceSymbolIndex(sourceFiles);
  const knownNamespaces = new Set(
    sourceFiles
      .map((file) => file.namespaceName)
      .filter((namespaceName): namespaceName is string => Boolean(namespaceName)),
  );
  const extractionResults = sourceFiles.map((file) =>
    extractReferencesForFile({
      allFilePaths,
      caseInsensitiveFilePathIndex,
      file,
      knownNamespaces,
      knownPackageNames,
      namespaceSymbolIndex,
      pathAliasResolver,
      packageSymbolIndex,
      structureDiscovery,
    }),
  );
  const structuralHintsByPath = buildStructuralHintsByPath(extractionResults);
  const unresolvedFileReferences = deduplicateUnresolvedFileReferences(
    extractionResults.flatMap((result) => result.unresolvedReferences),
  );
  const fileReferences = deduplicateFileReferences(
    extractionResults.flatMap((result) => result.resolvedReferences),
  );
  const fileIndex = buildFileIndex({
    structureDiscovery,
    fileReferences,
    keyConfigs: input.scanState.keyConfigs,
    loadedFiles: sourceFiles,
    scanState: input.scanState,
    structuralHintsByPath,
    unresolvedFileReferences,
  });
  const layers = buildLayerSummaries({
    fileIndex,
    fileReferences,
  });
  const directorySummaries = buildDirectorySummaries({
    fileIndex,
    scanState: input.scanState,
    structureDiscovery,
  });
  const connections = buildConnections({
    fileReferences,
    layerByPath: new Map(fileIndex.map((entry) => [entry.path, entry.layer])),
  });

  return {
    connections,
    directorySummaries,
    fileIndex,
    fileReferences,
    layers,
    referenceAnalysis: {
      scanLimits: buildReferenceScanLimits(input.scanState),
      structureDiscovery,
      unresolvedFileReferences,
    },
  };
}

function buildStructuralHintsByPath(
  extractionResults: ReferenceExtractionResult[],
): Map<string, ExtractedStructuralHint[]> {
  const hintsByPath = new Map<string, ExtractedStructuralHint[]>();

  for (const extractionResult of extractionResults) {
    hintsByPath.set(extractionResult.path, extractionResult.structuralHints);
  }

  return hintsByPath;
}

function createStructuralHintsForFile(file: LoadedSourceFile): ExtractedStructuralHint[] {
  const hints: ExtractedStructuralHint[] = [];

  if (file.packageName) {
    hints.push({
      confidence: 0.82,
      kind: 'package',
      reason: `package 선언 ${file.packageName} 을 확인했습니다.`,
      value: file.packageName,
    });
  }

  if (file.namespaceName) {
    hints.push({
      confidence: 0.8,
      kind: 'namespace',
      reason: `namespace 선언 ${file.namespaceName} 을 확인했습니다.`,
      value: file.namespaceName,
    });
  }

  if (file.additionalReferences.length > 0) {
    hints.push({
      confidence: 0.68,
      kind: 'template-reference',
      reason: `추가 참조 ${file.additionalReferences.length}건을 템플릿/부가 문맥에서 추출했습니다.`,
      value: String(file.additionalReferences.length),
    });
  }

  if (file.declarations.length > 1) {
    hints.push({
      confidence: 0.64,
      kind: 'declarations',
      reason: `상위 선언 ${file.declarations.length}개를 찾았습니다.`,
      value: file.declarations.join(', '),
    });
  }

  return hints;
}

function deduplicateUnresolvedFileReferences(
  references: UnresolvedExtractedReference[],
): ProjectAnalysisUnresolvedFileReference[] {
  const deduplicated = new Map<string, ProjectAnalysisUnresolvedFileReference>();

  for (const reference of references) {
    const key = `${reference.from}|${reference.relationship}|${reference.resolutionKind}|${reference.specifier}`;
    const existing = deduplicated.get(key);
    if (existing && existing.confidence >= reference.confidence) {
      continue;
    }

    deduplicated.set(key, {
      ...reference,
      candidatePaths: reference.candidatePaths.slice(0, 8),
    });
  }

  return [...deduplicated.values()];
}

function buildReferenceScanLimits(
  scanState: ProjectAnalysisScanState,
): ProjectAnalysisReferenceAnalysis['scanLimits'] {
  return (
    [
      {
        kind: 'depth',
        limit: MAX_SCAN_DEPTH,
        message: '최대 디렉터리 깊이에 도달했습니다.',
        reached: scanState.reachedDepthLimit,
      },
      {
        kind: 'directory',
        limit: MAX_DIRECTORY_COUNT,
        message: '최대 디렉터리 수에 도달했습니다.',
        reached: scanState.reachedDirectoryLimit,
      },
      {
        kind: 'file',
        limit: MAX_FILE_COUNT,
        message: '최대 파일 수에 도달했습니다.',
        reached: scanState.reachedFileLimit,
      },
    ] satisfies ProjectAnalysisReferenceAnalysis['scanLimits']
  ).filter((scanLimit) => scanLimit.reached);
}

async function loadSourceFiles(input: {
  allFilePaths: Set<string>;
  rootPath: string;
}): Promise<LoadedSourceFile[]> {
  const loadResults = await Promise.all(
    [...input.allFilePaths].map(async (path) => {
      const language = resolveSupportedSourceLanguage(path);
      if (!language) {
        return null;
      }

      try {
        const content = await readFile(join(input.rootPath, path), 'utf8');
        return createLoadedSourceFile({
          content,
          language,
          path,
        });
      } catch {
        return null;
      }
    }),
  );

  return loadResults.filter((file): file is LoadedSourceFile => file !== null);
}

function createLoadedSourceFile(input: {
  content: string;
  language: SupportedSourceLanguage;
  path: string;
}): LoadedSourceFile {
  const baseName = getBaseNameWithoutExtension(input.path);
  const parsedVueSource =
    input.language === 'vue' ? parseVueSingleFileComponent(input.content) : null;
  const analysisContent = parsedVueSource?.scriptContent ?? input.content;

  return {
    additionalReferences:
      parsedVueSource?.additionalReferences.map((reference) => ({
        relationship: reference.relationship,
        specifier: reference.specifier,
      })) ?? [],
    path: input.path,
    language: input.language,
    content: analysisContent,
    baseName,
    packageName:
      input.language === 'java' || input.language === 'kotlin'
        ? extractPackageName(analysisContent)
        : null,
    namespaceName: input.language === 'php' ? extractPhpNamespace(analysisContent) : null,
    declarations: extractTopLevelDeclarations({
      baseName,
      content: analysisContent,
      language: input.language,
    }),
    scriptKind: parsedVueSource?.scriptKind ?? resolveScriptKind(input.path),
  };
}

function buildPackageSymbolIndex(sourceFiles: LoadedSourceFile[]): Map<string, string> {
  const index = new Map<string, string>();

  for (const file of sourceFiles) {
    if (!file.packageName || (file.language !== 'java' && file.language !== 'kotlin')) {
      continue;
    }

    index.set(`${file.packageName}.${file.baseName}`, file.path);
    for (const declaration of file.declarations) {
      index.set(`${file.packageName}.${declaration}`, file.path);
    }
  }

  return index;
}

function buildNamespaceSymbolIndex(sourceFiles: LoadedSourceFile[]): Map<string, string> {
  const index = new Map<string, string>();

  for (const file of sourceFiles) {
    if (file.language !== 'php') {
      continue;
    }

    index.set(file.baseName, file.path);
    for (const declaration of file.declarations) {
      index.set(declaration, file.path);
    }

    if (!file.namespaceName) {
      continue;
    }

    index.set(`${file.namespaceName}\\${file.baseName}`, file.path);
    for (const declaration of file.declarations) {
      index.set(`${file.namespaceName}\\${declaration}`, file.path);
    }
  }

  return index;
}

function extractReferencesForFile(input: {
  allFilePaths: Set<string>;
  caseInsensitiveFilePathIndex: Map<string, string>;
  file: LoadedSourceFile;
  knownNamespaces: Set<string>;
  knownPackageNames: Set<string>;
  namespaceSymbolIndex: Map<string, string>;
  pathAliasResolver: ProjectPathAliasResolver;
  packageSymbolIndex: Map<string, string>;
  structureDiscovery: ProjectAnalysisStructureDiscovery;
}): ReferenceExtractionResult {
  switch (input.file.language) {
    case 'typescript':
    case 'javascript':
      return extractJavaScriptLikeReferences(input);
    case 'vue':
      return extractVueReferences({
        allFilePaths: input.allFilePaths,
        file: input.file,
        pathAliasResolver: input.pathAliasResolver,
        structureDiscovery: input.structureDiscovery,
      });
    case 'java':
      return extractPackageManagedReferences({
        file: input.file,
        knownPackageNames: input.knownPackageNames,
        packageSymbolIndex: input.packageSymbolIndex,
      });
    case 'kotlin':
      return extractPackageManagedReferences({
        file: input.file,
        knownPackageNames: input.knownPackageNames,
        packageSymbolIndex: input.packageSymbolIndex,
      });
    case 'php':
      return extractPhpReferences({
        allFilePaths: input.allFilePaths,
        caseInsensitiveFilePathIndex: input.caseInsensitiveFilePathIndex,
        file: input.file,
        knownNamespaces: input.knownNamespaces,
        namespaceSymbolIndex: input.namespaceSymbolIndex,
      });
  }
}

function extractJavaScriptLikeReferences(input: {
  allFilePaths: Set<string>;
  file: LoadedSourceFile;
  pathAliasResolver: ProjectPathAliasResolver;
  structureDiscovery: ProjectAnalysisStructureDiscovery;
}): ReferenceExtractionResult {
  const references: ExtractedReference[] = [];
  const unresolvedReferences: UnresolvedExtractedReference[] = [];
  const importedSymbolTargets = new Map<string, string>();
  const sourceFile = ts.createSourceFile(
    input.file.path,
    input.file.content,
    ts.ScriptTarget.Latest,
    true,
    input.file.scriptKind,
  );

  const visitNode = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      const resolution = resolveJavaScriptReferenceTarget({
        allFilePaths: input.allFilePaths,
        file: input.file,
        pathAliasResolver: input.pathAliasResolver,
        specifier: node.moduleSpecifier.text,
        structureDiscovery: input.structureDiscovery,
      });
      pushReferenceResolution({
        file: input.file,
        references,
        resolution,
        relationship: 'imports',
        specifier: node.moduleSpecifier.text,
        unresolvedReferences,
      });
      if (ts.isImportDeclaration(node)) {
        indexJavaScriptImportBindings(
          node.importClause,
          resolution.resolvedPath,
          importedSymbolTargets,
        );
      }
    }

    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const expression = node.moduleReference.expression;
      if (expression && ts.isStringLiteralLike(expression)) {
        const resolution = resolveJavaScriptReferenceTarget({
          allFilePaths: input.allFilePaths,
          file: input.file,
          pathAliasResolver: input.pathAliasResolver,
          specifier: expression.text,
          structureDiscovery: input.structureDiscovery,
        });
        pushReferenceResolution({
          file: input.file,
          references,
          resolution,
          relationship: 'requires',
          specifier: expression.text,
          unresolvedReferences,
        });
        if (resolution.resolvedPath && resolution.resolvedPath !== input.file.path) {
          importedSymbolTargets.set(node.name.text, resolution.resolvedPath);
        }
      }
    }

    if (ts.isCallExpression(node)) {
      const firstArgument = node.arguments[0];
      if (!firstArgument || !ts.isStringLiteralLike(firstArgument)) {
        ts.forEachChild(node, visitNode);
        return;
      }

      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        pushJavaScriptReference({
          allFilePaths: input.allFilePaths,
          file: input.file,
          pathAliasResolver: input.pathAliasResolver,
          references,
          relationship: 'requires',
          specifier: firstArgument.text,
          structureDiscovery: input.structureDiscovery,
          unresolvedReferences,
        });
      }

      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        pushJavaScriptReference({
          allFilePaths: input.allFilePaths,
          file: input.file,
          pathAliasResolver: input.pathAliasResolver,
          references,
          relationship: 'dynamic-import',
          specifier: firstArgument.text,
          structureDiscovery: input.structureDiscovery,
          unresolvedReferences,
        });
      }
    }

    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      const literal = node.argument.literal;
      if (ts.isStringLiteralLike(literal)) {
        pushJavaScriptReference({
          allFilePaths: input.allFilePaths,
          file: input.file,
          pathAliasResolver: input.pathAliasResolver,
          references,
          relationship: 'imports',
          specifier: literal.text,
          structureDiscovery: input.structureDiscovery,
          unresolvedReferences,
        });
      }
    }

    pushJavaScriptHeritageReferences({
      file: input.file,
      importedSymbolTargets,
      node,
      references,
      sourceFile,
    });
    pushJavaScriptDecoratorReferences({
      file: input.file,
      importedSymbolTargets,
      node,
      references,
      sourceFile,
    });

    ts.forEachChild(node, visitNode);
  };

  visitNode(sourceFile);

  for (const additionalReference of input.file.additionalReferences) {
    pushJavaScriptReference({
      allFilePaths: input.allFilePaths,
      file: input.file,
      pathAliasResolver: input.pathAliasResolver,
      references,
      relationship: additionalReference.relationship,
      specifier: additionalReference.specifier,
      structureDiscovery: input.structureDiscovery,
      unresolvedReferences,
    });
  }

  return {
    path: input.file.path,
    resolvedReferences: references,
    structuralHints: createStructuralHintsForFile(input.file),
    unresolvedReferences,
  };
}

function extractVueReferences(input: {
  allFilePaths: Set<string>;
  file: LoadedSourceFile;
  pathAliasResolver: ProjectPathAliasResolver;
  structureDiscovery: ProjectAnalysisStructureDiscovery;
}): ReferenceExtractionResult {
  return extractJavaScriptLikeReferences({
    allFilePaths: input.allFilePaths,
    file: input.file,
    pathAliasResolver: input.pathAliasResolver,
    structureDiscovery: input.structureDiscovery,
  });
}

function pushJavaScriptHeritageReferences(input: {
  file: LoadedSourceFile;
  importedSymbolTargets: Map<string, string>;
  node: ts.Node;
  references: ExtractedReference[];
  sourceFile: ts.SourceFile;
}): void {
  if (
    !ts.isClassDeclaration(input.node) &&
    !ts.isClassExpression(input.node) &&
    !ts.isInterfaceDeclaration(input.node)
  ) {
    return;
  }

  for (const clause of input.node.heritageClauses ?? []) {
    const relationship = resolveHeritageRelationship(clause.token);
    if (!relationship) {
      continue;
    }

    for (const type of clause.types) {
      const resolvedPath = resolveJavaScriptImportedSymbolPath(
        type.expression,
        input.importedSymbolTargets,
      );
      if (!resolvedPath) {
        continue;
      }

      pushResolvedReference({
        file: input.file,
        references: input.references,
        relationship,
        resolvedPath,
        specifier: type.getText(input.sourceFile),
      });
    }
  }
}

function pushJavaScriptDecoratorReferences(input: {
  file: LoadedSourceFile;
  importedSymbolTargets: Map<string, string>;
  node: ts.Node;
  references: ExtractedReference[];
  sourceFile: ts.SourceFile;
}): void {
  const decorators = getNodeDecorators(input.node);
  if (decorators.length === 0) {
    return;
  }

  for (const decorator of decorators) {
    const handledAsModuleWiring = pushNestModuleDecoratorReferences({
      decorator,
      file: input.file,
      importedSymbolTargets: input.importedSymbolTargets,
      references: input.references,
      sourceFile: input.sourceFile,
    });
    if (handledAsModuleWiring) {
      continue;
    }

    const decoratorTargets = collectJavaScriptImportedSymbols(
      decorator.expression,
      input.importedSymbolTargets,
    );

    for (const decoratorTarget of decoratorTargets) {
      pushResolvedReference({
        file: input.file,
        references: input.references,
        relationship: 'decorates',
        resolvedPath: decoratorTarget.path,
        specifier: `${getTrimmedNodeText(decorator.expression, input.sourceFile)} -> ${decoratorTarget.name}`,
      });
    }
  }
}

function pushNestModuleDecoratorReferences(input: {
  decorator: ts.Decorator;
  file: LoadedSourceFile;
  importedSymbolTargets: Map<string, string>;
  references: ExtractedReference[];
  sourceFile: ts.SourceFile;
}): boolean {
  if (!ts.isCallExpression(input.decorator.expression)) {
    return false;
  }

  const decoratorName = resolveJavaScriptReferenceIdentifierName(
    input.decorator.expression.expression,
  );
  if (decoratorName !== 'Module') {
    return false;
  }

  const metadataArgument = input.decorator.expression.arguments[0];
  if (!metadataArgument || !ts.isObjectLiteralExpression(metadataArgument)) {
    return true;
  }

  for (const property of metadataArgument.properties) {
    const metadataProperty = resolveNestModuleMetadataProperty(property);
    if (!metadataProperty) {
      continue;
    }

    const relationship = resolveNestModuleRelationship(metadataProperty.name);
    if (!relationship) {
      continue;
    }

    const targets = collectJavaScriptImportedSymbols(
      metadataProperty.initializer,
      input.importedSymbolTargets,
    );

    for (const target of targets) {
      pushResolvedReference({
        file: input.file,
        references: input.references,
        relationship,
        resolvedPath: target.path,
        specifier: `${metadataProperty.name}: ${target.name}`,
      });
    }
  }

  return true;
}

function resolveNestModuleMetadataProperty(
  property: ts.ObjectLiteralElementLike,
): { initializer: ts.Expression; name: string } | null {
  if (ts.isPropertyAssignment(property)) {
    const propertyName = resolveObjectLiteralPropertyName(property.name);
    if (!propertyName) {
      return null;
    }

    return {
      initializer: property.initializer,
      name: propertyName,
    };
  }

  if (ts.isShorthandPropertyAssignment(property)) {
    return {
      initializer: property.name,
      name: property.name.text,
    };
  }

  return null;
}

function resolveObjectLiteralPropertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
}

function resolveNestModuleRelationship(
  propertyName: string,
): ExtractedReferenceRelationship | null {
  switch (propertyName) {
    case 'imports':
      return 'module-imports';
    case 'providers':
      return 'provides';
    case 'controllers':
      return 'registers-controller';
    case 'exports':
      return 'exports';
    default:
      return null;
  }
}

function pushJavaScriptReference(input: {
  allFilePaths: Set<string>;
  file: LoadedSourceFile;
  pathAliasResolver: ProjectPathAliasResolver;
  references: ExtractedReference[];
  relationship: ExtractedReferenceRelationship;
  specifier: string;
  structureDiscovery: ProjectAnalysisStructureDiscovery;
  unresolvedReferences: UnresolvedExtractedReference[];
}): void {
  const resolution = resolveJavaScriptReferenceTarget({
    allFilePaths: input.allFilePaths,
    file: input.file,
    pathAliasResolver: input.pathAliasResolver,
    specifier: input.specifier,
    structureDiscovery: input.structureDiscovery,
  });

  pushReferenceResolution({
    file: input.file,
    references: input.references,
    resolution,
    relationship: input.relationship,
    specifier: input.specifier,
    unresolvedReferences: input.unresolvedReferences,
  });
}

function resolveJavaScriptReferenceTarget(input: {
  allFilePaths: Set<string>;
  file: LoadedSourceFile;
  pathAliasResolver: ProjectPathAliasResolver;
  specifier: string;
  structureDiscovery: ProjectAnalysisStructureDiscovery;
}): ReferenceResolution {
  const aliasConfig = input.pathAliasResolver.getAliasConfigForFile(input.file.path);
  const workspacePackageCandidates = resolveDiscoveredWorkspacePackageCandidates({
    discovery: input.structureDiscovery,
    specifier: input.specifier,
  });

  if (input.specifier.startsWith('.')) {
    const basePath = normalizeRelativePath(join(dirname(input.file.path), input.specifier));
    const candidatePaths = createResolutionCandidates(basePath);

    return {
      candidatePaths,
      reason: `상대 경로 ${input.specifier} 를 해석하지 못했습니다.`,
      resolutionKind: 'relative-path',
      resolvedPath: resolveProjectFilePathFromCandidates({
        allFilePaths: input.allFilePaths,
        candidatePaths,
      }),
    };
  }

  const aliasCandidates = resolveAliasCandidates(aliasConfig, input.specifier);
  if (aliasCandidates.length > 0) {
    return {
      candidatePaths: aliasCandidates,
      reason: `alias 규칙은 맞았지만 ${input.specifier} 대상 파일을 찾지 못했습니다.`,
      resolutionKind: 'alias',
      resolvedPath: resolveProjectFilePathFromBasePaths({
        allFilePaths: input.allFilePaths,
        basePaths: aliasCandidates,
      }),
    };
  }

  if (workspacePackageCandidates.length > 0) {
    return {
      candidatePaths: workspacePackageCandidates,
      reason: `발견된 package root 안에서 ${input.specifier} workspace 경로를 찾지 못했습니다.`,
      resolutionKind: 'workspace-package',
      resolvedPath: resolveProjectFilePathFromBasePaths({
        allFilePaths: input.allFilePaths,
        basePaths: workspacePackageCandidates,
      }),
    };
  }

  if (input.specifier.startsWith('/')) {
    const candidatePaths = createResolutionCandidates(
      normalizeRelativePath(input.specifier.slice(1)),
    );

    return {
      candidatePaths,
      reason: `루트 기준 경로 ${input.specifier} 를 해석하지 못했습니다.`,
      resolutionKind: 'absolute-path',
      resolvedPath: resolveProjectFilePathFromCandidates({
        allFilePaths: input.allFilePaths,
        candidatePaths,
      }),
    };
  }

  if (input.specifier.startsWith('src/')) {
    const candidatePaths = createResolutionCandidates(normalizeRelativePath(input.specifier));

    return {
      candidatePaths,
      reason: `source root 기준 경로 ${input.specifier} 를 해석하지 못했습니다.`,
      resolutionKind: 'source-root',
      resolvedPath: resolveProjectFilePathFromCandidates({
        allFilePaths: input.allFilePaths,
        candidatePaths,
      }),
    };
  }

  return {
    candidatePaths: [],
    reason: '',
    resolutionKind: 'external-package',
    resolvedPath: null,
  };
}

function pushReferenceResolution(input: {
  file: LoadedSourceFile;
  references: ExtractedReference[];
  resolution: ReferenceResolution;
  relationship: ExtractedReferenceRelationship;
  specifier: string;
  unresolvedReferences: UnresolvedExtractedReference[];
}): void {
  if (input.resolution.resolvedPath) {
    pushResolvedReference({
      file: input.file,
      references: input.references,
      relationship: input.relationship,
      resolvedPath: input.resolution.resolvedPath,
      specifier: input.specifier,
    });
    return;
  }

  if (
    input.resolution.resolutionKind === 'external-package' ||
    input.resolution.reason.trim().length === 0
  ) {
    return;
  }

  input.unresolvedReferences.push({
    candidatePaths: input.resolution.candidatePaths.slice(0, 8),
    confidence: resolveUnresolvedReferenceConfidence(input.resolution.resolutionKind),
    from: input.file.path,
    language: input.file.language,
    reason: input.resolution.reason,
    relationship: input.relationship,
    resolutionKind: input.resolution.resolutionKind,
    specifier: input.specifier,
  });
}

function pushResolvedReference(input: {
  file: LoadedSourceFile;
  references: ExtractedReference[];
  relationship: ExtractedReferenceRelationship;
  resolvedPath: string | null;
  specifier: string;
}): void {
  if (!input.resolvedPath || input.resolvedPath === input.file.path) {
    return;
  }

  input.references.push({
    from: input.file.path,
    relationship: input.relationship,
    specifier: input.specifier,
    to: input.resolvedPath,
  });
}

function indexJavaScriptImportBindings(
  importClause: ts.ImportClause | undefined,
  resolvedPath: string | null,
  importedSymbolTargets: Map<string, string>,
): void {
  if (!importClause || !resolvedPath) {
    return;
  }

  if (importClause.name) {
    importedSymbolTargets.set(importClause.name.text, resolvedPath);
  }

  const namedBindings = importClause.namedBindings;
  if (!namedBindings) {
    return;
  }

  if (ts.isNamespaceImport(namedBindings)) {
    importedSymbolTargets.set(namedBindings.name.text, resolvedPath);
    return;
  }

  for (const element of namedBindings.elements) {
    importedSymbolTargets.set(element.name.text, resolvedPath);
  }
}

function resolveHeritageRelationship(token: ts.SyntaxKind): ExtractedReferenceRelationship | null {
  switch (token) {
    case ts.SyntaxKind.ExtendsKeyword:
      return 'extends';
    case ts.SyntaxKind.ImplementsKeyword:
      return 'implements';
    default:
      return null;
  }
}

function resolveJavaScriptImportedSymbolPath(
  node: ts.Node,
  importedSymbolTargets: Map<string, string>,
): string | null {
  const identifierName = resolveJavaScriptReferenceIdentifierName(node);
  if (!identifierName) {
    return null;
  }

  return importedSymbolTargets.get(identifierName) ?? null;
}

function resolveJavaScriptReferenceIdentifierName(node: ts.Node): string | null {
  if (ts.isIdentifier(node)) {
    return node.text;
  }

  if (ts.isPropertyAccessExpression(node)) {
    return resolveJavaScriptReferenceIdentifierName(node.expression);
  }

  if (ts.isElementAccessExpression(node)) {
    return resolveJavaScriptReferenceIdentifierName(node.expression);
  }

  if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
    return resolveJavaScriptReferenceIdentifierName(node.expression);
  }

  if (ts.isParenthesizedExpression(node)) {
    return resolveJavaScriptReferenceIdentifierName(node.expression);
  }

  return null;
}

function getNodeDecorators(node: ts.Node): readonly ts.Decorator[] {
  if (!ts.canHaveDecorators(node)) {
    return [];
  }

  return ts.getDecorators(node) ?? [];
}

function collectJavaScriptImportedSymbols(
  rootNode: ts.Node,
  importedSymbolTargets: Map<string, string>,
): Array<{ name: string; path: string }> {
  const resolvedTargets = new Map<string, string>();

  const visitNode = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      const resolvedPath = importedSymbolTargets.get(node.text);
      if (resolvedPath) {
        resolvedTargets.set(node.text, resolvedPath);
      }
    }

    ts.forEachChild(node, visitNode);
  };

  visitNode(rootNode);

  return [...resolvedTargets.entries()].map(([name, path]) => ({
    name,
    path,
  }));
}

function getTrimmedNodeText(node: ts.Node, sourceFile: ts.SourceFile): string {
  const collapsedText = node.getText(sourceFile).replace(/\s+/gu, ' ').trim();
  if (collapsedText.length <= 80) {
    return collapsedText;
  }

  return `${collapsedText.slice(0, 77)}...`;
}

function extractPackageManagedReferences(input: {
  file: LoadedSourceFile;
  knownPackageNames: Set<string>;
  packageSymbolIndex: Map<string, string>;
}): ReferenceExtractionResult {
  const references: ExtractedReference[] = [];
  const unresolvedReferences: UnresolvedExtractedReference[] = [];
  const importRegex =
    input.file.language === 'java'
      ? /^\s*import\s+(?:static\s+)?([\w.]+)\s*;/gmu
      : /^\s*import\s+([\w.]+)(?:\s+as\s+\w+)?\s*$/gmu;

  for (const match of input.file.content.matchAll(importRegex)) {
    const qualifiedName = match[1];
    if (!qualifiedName || qualifiedName.endsWith('.*')) {
      continue;
    }

    const resolvedPath = resolveQualifiedPackageSymbol({
      packageSymbolIndex: input.packageSymbolIndex,
      qualifiedName,
    });
    if (!resolvedPath || resolvedPath === input.file.path) {
      const packageName = qualifiedName.split('.').slice(0, -1).join('.');
      const canResolvePackage = packageName.length > 0 && input.knownPackageNames.has(packageName);
      unresolvedReferences.push({
        candidatePaths: [],
        confidence: canResolvePackage ? 0.62 : 0.48,
        from: input.file.path,
        language: input.file.language,
        reason: canResolvePackage
          ? `패키지는 확인했지만 ${qualifiedName} 심볼을 찾지 못했습니다.`
          : `패키지 루트를 확인하지 못해 ${qualifiedName} import 를 파일로 연결하지 못했습니다.`,
        relationship: 'imports',
        resolutionKind: canResolvePackage ? 'package-symbol' : 'package-root',
        specifier: qualifiedName,
      });
      continue;
    }

    references.push({
      from: input.file.path,
      relationship: 'imports',
      specifier: qualifiedName,
      to: resolvedPath,
    });
  }

  return {
    path: input.file.path,
    resolvedReferences: references,
    structuralHints: createStructuralHintsForFile(input.file),
    unresolvedReferences,
  };
}

function extractPhpReferences(input: {
  allFilePaths: Set<string>;
  caseInsensitiveFilePathIndex: Map<string, string>;
  file: LoadedSourceFile;
  knownNamespaces: Set<string>;
  namespaceSymbolIndex: Map<string, string>;
}): ReferenceExtractionResult {
  const references: ExtractedReference[] = [];
  const unresolvedReferences: UnresolvedExtractedReference[] = [];
  const phpUseImports = extractPhpUseImports(input.file.content);
  const phpImportAliases = buildPhpImportAliasMap(phpUseImports);

  for (const importPath of phpUseImports.map((phpUseImport) => phpUseImport.qualifiedName)) {
    const resolvedPath = resolveQualifiedNamespaceSymbol({
      namespaceSymbolIndex: input.namespaceSymbolIndex,
      qualifiedName: importPath,
    });
    if (!resolvedPath || resolvedPath === input.file.path) {
      const hasKnownNamespace = hasKnownNamespacePrefix({
        knownNamespaces: input.knownNamespaces,
        qualifiedName: importPath,
      });
      unresolvedReferences.push({
        candidatePaths: [],
        confidence: hasKnownNamespace ? 0.58 : 0.46,
        from: input.file.path,
        language: input.file.language,
        reason: hasKnownNamespace
          ? `네임스페이스는 확인했지만 ${importPath} 심볼 해석에 실패했습니다.`
          : `네임스페이스 루트를 찾지 못해 ${importPath} use 구문을 해석하지 못했습니다.`,
        relationship: 'uses',
        resolutionKind: hasKnownNamespace ? 'namespace-symbol' : 'namespace-root',
        specifier: importPath,
      });
      continue;
    }

    references.push({
      from: input.file.path,
      relationship: 'uses',
      specifier: importPath,
      to: resolvedPath,
    });
  }

  for (const includeReference of extractPhpIncludeReferences(input.file.content)) {
    const resolution = resolvePhpIncludeReference({
      allFilePaths: input.allFilePaths,
      caseInsensitiveFilePathIndex: input.caseInsensitiveFilePathIndex,
      fromPath: input.file.path,
      includeReference,
    });
    if (!resolution.resolvedPath || resolution.resolvedPath === input.file.path) {
      unresolvedReferences.push({
        candidatePaths: resolution.candidatePaths,
        confidence: 0.62,
        from: input.file.path,
        language: input.file.language,
        reason: resolution.reason,
        relationship: 'includes',
        resolutionKind: resolution.resolutionKind,
        specifier: includeReference.rawSpecifier,
      });
      continue;
    }

    references.push({
      from: input.file.path,
      relationship: 'includes',
      specifier: includeReference.rawSpecifier,
      to: resolution.resolvedPath,
    });
  }

  for (const loaderReference of extractPhpFrameworkLoadReferences(input.file.content)) {
    const resolution = resolvePhpFrameworkLoadReference({
      allFilePaths: input.allFilePaths,
      caseInsensitiveFilePathIndex: input.caseInsensitiveFilePathIndex,
      loaderReference,
    });
    if (!resolution.resolvedPath || resolution.resolvedPath === input.file.path) {
      unresolvedReferences.push({
        candidatePaths: resolution.candidatePaths,
        confidence: 0.56,
        from: input.file.path,
        language: input.file.language,
        reason: resolution.reason,
        relationship: 'loads',
        resolutionKind: resolution.resolutionKind,
        specifier: `${loaderReference.kind}:${loaderReference.path}`,
      });
      continue;
    }

    references.push({
      from: input.file.path,
      relationship: 'loads',
      specifier: `${loaderReference.kind}:${loaderReference.path}`,
      to: resolution.resolvedPath,
    });
  }

  for (const structuralTypeReference of extractPhpStructuralTypeReferences(input.file.content)) {
    pushResolvedPhpTypeReference({
      file: input.file,
      importAliases: phpImportAliases,
      namespaceSymbolIndex: input.namespaceSymbolIndex,
      references,
      relationship: structuralTypeReference.relationship,
      typeCandidate: structuralTypeReference.specifier,
      unresolvedReferences,
    });
  }

  for (const phpDocTypeExpression of extractPhpDocTypeExpressions(input.file.content)) {
    for (const phpDocTypeCandidate of extractPhpDocTypeCandidates(phpDocTypeExpression)) {
      pushResolvedPhpTypeReference({
        file: input.file,
        importAliases: phpImportAliases,
        namespaceSymbolIndex: input.namespaceSymbolIndex,
        references,
        relationship: 'phpdoc',
        typeCandidate: phpDocTypeCandidate,
        unresolvedReferences,
      });
    }
  }

  return {
    path: input.file.path,
    resolvedReferences: references,
    structuralHints: createStructuralHintsForFile(input.file),
    unresolvedReferences,
  };
}

function buildFileIndex(input: {
  structureDiscovery: ProjectAnalysisStructureDiscovery;
  fileReferences: ProjectAnalysisFileReference[];
  keyConfigs: Set<string>;
  loadedFiles: LoadedSourceFile[];
  scanState: ProjectAnalysisScanState;
  structuralHintsByPath: Map<string, ExtractedStructuralHint[]>;
  unresolvedFileReferences: ProjectAnalysisUnresolvedFileReference[];
}): ProjectAnalysisFileIndexEntry[] {
  const outgoingReferencesByPath = new Map<string, ProjectAnalysisFileReferenceTarget[]>();
  const incomingCountByPath = new Map<string, number>();
  const unresolvedReferencesByPath = new Map<
    string,
    ProjectAnalysisUnresolvedFileReferenceTarget[]
  >();
  const loadedFileByPath = new Map(input.loadedFiles.map((file) => [file.path, file] as const));
  const candidatePaths = new Set<string>(input.loadedFiles.map((file) => file.path));

  for (const reference of input.fileReferences) {
    candidatePaths.add(reference.from);
    candidatePaths.add(reference.to);
    incomingCountByPath.set(reference.to, (incomingCountByPath.get(reference.to) ?? 0) + 1);

    const currentTargets = outgoingReferencesByPath.get(reference.from) ?? [];
    currentTargets.push({
      path: reference.to,
      relationship: reference.relationship,
      reason: reference.reason,
    });
    outgoingReferencesByPath.set(reference.from, currentTargets);
  }

  for (const unresolvedReference of input.unresolvedFileReferences) {
    candidatePaths.add(unresolvedReference.from);

    const currentTargets = unresolvedReferencesByPath.get(unresolvedReference.from) ?? [];
    currentTargets.push({
      candidatePaths: unresolvedReference.candidatePaths,
      confidence: unresolvedReference.confidence,
      language: unresolvedReference.language,
      reason: unresolvedReference.reason,
      relationship: unresolvedReference.relationship,
      resolutionKind: unresolvedReference.resolutionKind,
      specifier: unresolvedReference.specifier,
    });
    unresolvedReferencesByPath.set(unresolvedReference.from, currentTargets);
  }

  for (const entrypoint of input.scanState.entrypoints) {
    candidatePaths.add(normalizeRelativePath(entrypoint));
  }
  for (const keyConfig of input.keyConfigs) {
    candidatePaths.add(normalizeRelativePath(keyConfig));
  }

  return [...candidatePaths]
    .filter((path) => input.scanState.files.has(path))
    .map((path) => {
      const loadedFile = loadedFileByPath.get(path);
      const references = outgoingReferencesByPath.get(path) ?? [];
      const unresolvedReferences = unresolvedReferencesByPath.get(path) ?? [];
      const incomingCount = incomingCountByPath.get(path) ?? 0;
      const classification = classifyFile({
        discoveredHints: input.structuralHintsByPath.get(path) ?? [],
        discovery: input.structureDiscovery,
        keyConfigs: input.keyConfigs,
        language: loadedFile?.language ?? null,
        scanState: input.scanState,
        path,
      });
      const layer = classification.layer;
      const category = classification.category;

      return {
        category,
        classification: classification.classification,
        grouping: classification.grouping,
        layer,
        path,
        references,
        role: classification.role,
        summary: createFileSummary({
          category,
          incomingCount,
          language: loadedFile?.language ?? null,
          outgoingCount: references.length,
          role: classification.role,
        }),
        unresolvedReferences,
      } satisfies ProjectAnalysisFileIndexEntry;
    })
    .sort((left, right) => compareFileIndexEntries(left, right, incomingCountByPath));
}

function compareFileIndexEntries(
  left: ProjectAnalysisFileIndexEntry,
  right: ProjectAnalysisFileIndexEntry,
  incomingCountByPath: Map<string, number>,
): number {
  const leftOutgoingCount = left.references?.length ?? 0;
  const rightOutgoingCount = right.references?.length ?? 0;
  if (rightOutgoingCount !== leftOutgoingCount) {
    return rightOutgoingCount - leftOutgoingCount;
  }

  const leftIncomingCount = incomingCountByPath.get(left.path) ?? 0;
  const rightIncomingCount = incomingCountByPath.get(right.path) ?? 0;
  if (rightIncomingCount !== leftIncomingCount) {
    return rightIncomingCount - leftIncomingCount;
  }

  const leftSortPriority = getFileIndexSortPriority({
    category: left.category,
    path: left.path,
  });
  const rightSortPriority = getFileIndexSortPriority({
    category: right.category,
    path: right.path,
  });
  if (rightSortPriority !== leftSortPriority) {
    return rightSortPriority - leftSortPriority;
  }

  return left.path.localeCompare(right.path);
}

function getFileIndexCategoryPriority(category: string): number {
  switch (category) {
    case 'entrypoint':
      return 150;
    case 'config':
      return 145;
    case 'module':
      return 140;
    case 'controller':
      return 135;
    case 'command-service':
      return 132;
    case 'query-service':
      return 131;
    case 'service':
      return 130;
    case 'command-handler':
      return 128;
    case 'query-handler':
      return 127;
    case 'handler':
      return 126;
    case 'repository':
      return 124;
    case 'command':
      return 123;
    case 'query':
      return 122;
    case 'validator':
      return 121;
    case 'dto':
      return 118;
    case 'mapper':
      return 117;
    case 'entity':
      return 116;
    case 'model':
      return 115;
    case 'policy':
    case 'strategy':
    case 'guard':
    case 'interceptor':
    case 'decorator':
    case 'filter':
    case 'middleware':
    case 'pipe':
    case 'factory':
    case 'exception':
    case 'type':
    case 'utility':
      return 110;
    case 'test':
      return 90;
    case 'source':
      return 10;
    default:
      return 100;
  }
}

function getFileIndexSortPriority(input: { category: string; path: string }): number {
  let priority = getFileIndexCategoryPriority(input.category);
  const areaName = resolveAreaName(input.path);

  switch (areaName) {
    case 'domain':
      priority += 40;
      break;
    case 'core':
      priority += 20;
      break;
    case 'shared':
      priority += 15;
      break;
    case 'api':
      priority += 5;
      break;
    case 'test':
      priority -= 10;
      break;
    default:
      priority += 10;
      break;
  }

  if (input.category === 'test') {
    priority -= 25;
  }

  return priority;
}

function buildLayerSummaries(input: {
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

function buildDirectorySummaries(input: {
  fileIndex: ProjectAnalysisFileIndexEntry[];
  scanState: ProjectAnalysisScanState;
  structureDiscovery: ProjectAnalysisStructureDiscovery;
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

function buildConnections(input: {
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

function deduplicateFileReferences(
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
  relationship: ExtractedReferenceRelationship,
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

function resolveAliasCandidates(aliasConfig: PathAliasConfig, specifier: string): string[] {
  const resolvedCandidates: string[] = [];

  for (const rule of aliasConfig.rules) {
    const wildcardValue = resolveMatcherWildcard(rule.matcher, specifier);
    if (wildcardValue === null) {
      continue;
    }

    for (const replacement of rule.replacements) {
      const replacedPath = replacement.wildcard
        ? `${replacement.prefix}${wildcardValue}${replacement.suffix}`
        : replacement.prefix;

      resolvedCandidates.push(normalizeRelativePath(replacedPath).replace(/^\.\/+/u, ''));
    }
  }

  return resolvedCandidates;
}

function resolveMatcherWildcard(matcher: AliasMatcher, specifier: string): string | null {
  if (!matcher.wildcard) {
    return matcher.prefix === specifier ? '' : null;
  }

  if (!specifier.startsWith(matcher.prefix) || !specifier.endsWith(matcher.suffix)) {
    return null;
  }

  return specifier.slice(matcher.prefix.length, specifier.length - matcher.suffix.length);
}

function resolveProjectFilePath(input: {
  allFilePaths: Set<string>;
  basePath: string;
}): string | null {
  const normalizedBasePath = normalizeRelativePath(input.basePath).replace(/^\.\/+/u, '');
  const candidatePaths = createResolutionCandidates(normalizedBasePath);

  return resolveProjectFilePathFromCandidates({
    allFilePaths: input.allFilePaths,
    candidatePaths,
  });
}

function resolveProjectFilePathFromBasePaths(input: {
  allFilePaths: Set<string>;
  basePaths: string[];
}): string | null {
  for (const basePath of input.basePaths) {
    const resolvedPath = resolveProjectFilePath({
      allFilePaths: input.allFilePaths,
      basePath,
    });
    if (resolvedPath) {
      return resolvedPath;
    }
  }

  return null;
}

function resolveProjectFilePathFromCandidates(input: {
  allFilePaths: Set<string>;
  candidatePaths: string[];
}): string | null {
  for (const candidatePath of input.candidatePaths) {
    if (input.allFilePaths.has(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function buildCaseInsensitiveFilePathIndex(allFilePaths: Set<string>): Map<string, string> {
  const index = new Map<string, string>();

  for (const filePath of allFilePaths) {
    const normalizedPath = normalizeRelativePath(filePath).toLowerCase();
    if (!index.has(normalizedPath)) {
      index.set(normalizedPath, filePath);
    }
  }

  return index;
}

function resolveProjectFilePathCaseInsensitive(input: {
  allFilePaths: Set<string>;
  basePath: string;
  caseInsensitiveFilePathIndex: Map<string, string>;
}): string | null {
  const directMatch = resolveProjectFilePath({
    allFilePaths: input.allFilePaths,
    basePath: input.basePath,
  });
  if (directMatch) {
    return directMatch;
  }

  const normalizedBasePath = normalizeRelativePath(input.basePath).replace(/^\.\/+/u, '');
  const candidatePaths = createResolutionCandidates(normalizedBasePath);

  return resolveProjectFilePathCaseInsensitiveFromCandidates({
    allFilePaths: input.allFilePaths,
    candidatePaths,
    caseInsensitiveFilePathIndex: input.caseInsensitiveFilePathIndex,
  });
}

function resolveProjectFilePathCaseInsensitiveFromBasePaths(input: {
  allFilePaths: Set<string>;
  basePaths: string[];
  caseInsensitiveFilePathIndex: Map<string, string>;
}): string | null {
  for (const basePath of input.basePaths) {
    const resolvedPath = resolveProjectFilePathCaseInsensitive({
      allFilePaths: input.allFilePaths,
      basePath,
      caseInsensitiveFilePathIndex: input.caseInsensitiveFilePathIndex,
    });
    if (resolvedPath) {
      return resolvedPath;
    }
  }

  return null;
}

function resolveProjectFilePathCaseInsensitiveFromCandidates(input: {
  allFilePaths: Set<string>;
  candidatePaths: string[];
  caseInsensitiveFilePathIndex: Map<string, string>;
}): string | null {
  const directMatch = resolveProjectFilePathFromCandidates({
    allFilePaths: input.allFilePaths,
    candidatePaths: input.candidatePaths,
  });
  if (directMatch) {
    return directMatch;
  }

  for (const candidatePath of input.candidatePaths) {
    const caseInsensitiveMatch = input.caseInsensitiveFilePathIndex.get(
      candidatePath.toLowerCase(),
    );
    if (caseInsensitiveMatch) {
      return caseInsensitiveMatch;
    }
  }

  return null;
}

function createResolutionCandidates(basePath: string): string[] {
  const candidates = new Set<string>();
  const normalizedBasePath = normalizeRelativePath(basePath);
  const baseExtension = extname(normalizedBasePath).toLowerCase();
  const isRecognizedSourceExtension = SOURCE_RESOLUTION_EXTENSIONS.includes(
    baseExtension as (typeof SOURCE_RESOLUTION_EXTENSIONS)[number],
  );

  candidates.add(normalizedBasePath);

  if (baseExtension && JAVASCRIPT_RUNTIME_EXTENSIONS.has(baseExtension)) {
    const withoutExtension = normalizedBasePath.slice(0, -baseExtension.length);
    for (const extension of SOURCE_RESOLUTION_EXTENSIONS) {
      candidates.add(`${withoutExtension}${extension}`);
    }
  }

  if (!baseExtension || !isRecognizedSourceExtension) {
    for (const extension of SOURCE_RESOLUTION_EXTENSIONS) {
      candidates.add(`${normalizedBasePath}${extension}`);
      candidates.add(`${normalizedBasePath}/index${extension}`);
    }
  }

  return [...candidates];
}

function resolveUnresolvedReferenceConfidence(resolutionKind: string): number {
  switch (resolutionKind) {
    case 'alias':
    case 'workspace-package':
      return 0.72;
    case 'relative-path':
    case 'absolute-path':
    case 'source-root':
    case 'php-include':
    case 'php-include-constant':
      return 0.64;
    case 'php-framework-loader':
      return 0.56;
    default:
      return 0.48;
  }
}

function hasKnownNamespacePrefix(input: {
  knownNamespaces: Set<string>;
  qualifiedName: string;
}): boolean {
  const normalizedQualifiedName = input.qualifiedName.replace(/^\\+/u, '').toLowerCase();

  return [...input.knownNamespaces].some((namespaceName) =>
    normalizedQualifiedName.startsWith(namespaceName.toLowerCase()),
  );
}

function extractPackageName(content: string): string | null {
  const match = content.match(/^\s*package\s+([\w.]+)\s*;?/mu);
  return match?.[1] ?? null;
}

function extractPhpNamespace(content: string): string | null {
  const match = content.match(/^\s*namespace\s+([^;{]+)\s*[;{]/mu);
  if (!match?.[1]) {
    return null;
  }

  return match[1].trim().replace(/\\+/gu, '\\');
}

function extractTopLevelDeclarations(input: {
  baseName: string;
  content: string;
  language: SupportedSourceLanguage;
}): string[] {
  const declarations = new Set<string>([input.baseName]);

  if (input.language === 'java') {
    addRegexMatches(
      declarations,
      input.content,
      /\b(?:class|interface|enum|record|@interface)\s+([A-Z_]\w*)/gmu,
    );
  }

  if (input.language === 'kotlin') {
    addRegexMatches(
      declarations,
      input.content,
      /\b(?:class|interface|object|typealias|enum\s+class|sealed\s+class|annotation\s+class)\s+([A-Z_]\w*)/gmu,
    );
    addRegexMatches(declarations, input.content, /\bfun\s+([a-zA-Z_]\w*)\s*\(/gmu);
  }

  if (input.language === 'php') {
    addRegexMatches(
      declarations,
      input.content,
      /\b(?:class|interface|trait|enum)\s+([A-Z_]\w*)/gmu,
    );
    addRegexMatches(declarations, input.content, /\bfunction\s+([a-zA-Z_]\w*)\s*\(/gmu);
  }

  return [...declarations];
}

function addRegexMatches(target: Set<string>, content: string, pattern: RegExp): void {
  for (const match of content.matchAll(pattern)) {
    const declarationName = match[1];
    if (declarationName) {
      target.add(declarationName);
    }
  }
}

function extractPhpUseImports(content: string): PhpUseImport[] {
  const imports: PhpUseImport[] = [];
  const useStatementRegex = /^\s*use\s+(.+?)\s*;/gmu;

  for (const match of content.matchAll(useStatementRegex)) {
    const body = match[1];
    if (!body) {
      continue;
    }

    if (body.includes('{') && body.includes('}')) {
      const braceStart = body.indexOf('{');
      const braceEnd = body.indexOf('}');
      if (braceStart < 0 || braceEnd < 0 || braceEnd <= braceStart) {
        continue;
      }

      const prefixContext = resolvePhpUsePrefix(body.slice(0, braceStart));
      const members = body
        .slice(braceStart + 1, braceEnd)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      for (const member of members) {
        const normalizedImport = normalizePhpUseImport({
          inheritedKind: prefixContext.kind,
          prefix: prefixContext.prefix,
          segment: member,
        });
        if (normalizedImport) {
          imports.push(normalizedImport);
        }
      }

      continue;
    }

    const segments = body.split(',').map((segment) => segment.trim());
    for (const segment of segments) {
      const normalizedImport = normalizePhpUseImport({
        segment,
      });
      if (normalizedImport) {
        imports.push(normalizedImport);
      }
    }
  }

  return imports;
}

function resolvePhpUsePrefix(value: string): { kind: PhpUseImport['kind']; prefix: string } {
  const normalizedValue = value.trim().replace(/\\$/u, '');
  const kindMatch = normalizedValue.match(/^(function|const)\s+(.+)$/iu);
  const kind = (kindMatch?.[1]?.toLowerCase() ?? 'class') as PhpUseImport['kind'];
  const prefix = (kindMatch?.[2] ?? normalizedValue)
    .trim()
    .replace(/^\\+/u, '')
    .replace(/\\+/gu, '\\');

  return {
    kind,
    prefix,
  };
}

function normalizePhpUseImport(input: {
  inheritedKind?: PhpUseImport['kind'];
  prefix?: string;
  segment: string;
}): PhpUseImport | null {
  const aliasMatch = input.segment.match(/\s+as\s+([a-zA-Z_]\w*)$/iu);
  const withoutAlias = input.segment.slice(0, aliasMatch?.index).trim();
  const kindMatch = withoutAlias.match(/^(function|const)\s+(.+)$/iu);
  const kind = (kindMatch?.[1]?.toLowerCase() ??
    input.inheritedKind ??
    'class') as PhpUseImport['kind'];
  const symbolName = (kindMatch?.[2] ?? withoutAlias).trim();
  if (!symbolName) {
    return null;
  }

  const prefix = input.prefix?.trim();
  const qualifiedName = [prefix, symbolName]
    .filter((segment): segment is string => Boolean(segment))
    .join('\\')
    .replace(/^\\+/u, '')
    .replace(/\\+/gu, '\\');
  if (!qualifiedName) {
    return null;
  }

  const alias = aliasMatch?.[1] ?? qualifiedName.split('\\').filter(Boolean).pop() ?? null;
  if (!alias) {
    return null;
  }

  return {
    alias,
    kind,
    qualifiedName,
  };
}

function buildPhpImportAliasMap(phpUseImports: PhpUseImport[]): Map<string, string> {
  const aliasMap = new Map<string, string>();

  for (const phpUseImport of phpUseImports) {
    if (phpUseImport.kind !== 'class') {
      continue;
    }

    aliasMap.set(phpUseImport.alias.toLowerCase(), phpUseImport.qualifiedName);
  }

  return aliasMap;
}

function extractPhpIncludeReferences(content: string): PhpIncludeReference[] {
  const includeReferences: PhpIncludeReference[] = [];
  const includeRegex =
    /\b(?:require|require_once|include|include_once)\s*\(?\s*(?:(APPPATH|BASEPATH|FCPATH)\s*\.\s*)?['"]([^'"]+)['"]\s*\)?/gmu;

  for (const match of content.matchAll(includeRegex)) {
    const rootConstant = match[1];
    const path = match[2]?.trim();
    if (!path) {
      continue;
    }

    includeReferences.push({
      path,
      rawSpecifier: `${rootConstant ? `${rootConstant}:` : ''}${path}`,
      rootConstant:
        rootConstant && rootConstant in PHP_PATH_CONSTANT_BASE_PATHS
          ? (rootConstant as keyof typeof PHP_PATH_CONSTANT_BASE_PATHS)
          : null,
    });
  }

  return includeReferences;
}

function extractPhpFrameworkLoadReferences(content: string): PhpFrameworkLoadReference[] {
  const references: PhpFrameworkLoadReference[] = [];
  const patterns: Array<{ kind: PhpFrameworkLoadKind; regex: RegExp }> = [
    {
      kind: 'service',
      regex: /\$this->load_service\(\s*['"]([^'"]+)['"]/gmu,
    },
    {
      kind: 'model',
      regex: /\$this->load_model\(\s*['"]([^'"]+)['"]/gmu,
    },
    {
      kind: 'library',
      regex: /\$this->load_library\(\s*['"]([^'"]+)['"]/gmu,
    },
    {
      kind: 'model',
      regex: /\$this->load->model\(\s*['"]([^'"]+)['"]/gmu,
    },
    {
      kind: 'library',
      regex: /\$this->load->library\(\s*['"]([^'"]+)['"]/gmu,
    },
    {
      kind: 'helper',
      regex: /\$this->load->helper\(\s*['"]([^'"]+)['"]/gmu,
    },
    {
      kind: 'config',
      regex: /\$this->load->config\(\s*['"]([^'"]+)['"]/gmu,
    },
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern.regex)) {
      const path = match[1]?.trim();
      if (!path) {
        continue;
      }

      references.push({
        kind: pattern.kind,
        path,
      });
    }
  }

  return references;
}

function extractPhpStructuralTypeReferences(
  content: string,
): Array<{ relationship: 'extends' | 'implements' | 'instantiates'; specifier: string }> {
  const references: Array<{
    relationship: 'extends' | 'implements' | 'instantiates';
    specifier: string;
  }> = [];

  const newRegex = /\bnew\s+(\\?[a-zA-Z_][a-zA-Z0-9_\\]*)\s*\(/gmu;
  for (const match of content.matchAll(newRegex)) {
    const specifier = match[1]?.trim();
    if (!specifier || !isLikelyPhpTypeReference(specifier)) {
      continue;
    }

    references.push({
      relationship: 'instantiates',
      specifier,
    });
  }

  const classLikeDeclarationRegex =
    /\b(?:class|interface|trait|enum)\s+[A-Z_][a-zA-Z0-9_]*(?:\s+extends\s+([\\a-zA-Z_][a-zA-Z0-9_\\]*(?:\s*,\s*[\\a-zA-Z_][a-zA-Z0-9_\\]*)*))?(?:\s+implements\s+([\\a-zA-Z_][a-zA-Z0-9_\\]*(?:\s*,\s*[\\a-zA-Z_][a-zA-Z0-9_\\]*)*))?/gmu;
  for (const match of content.matchAll(classLikeDeclarationRegex)) {
    const extendsClause = match[1];
    const implementsClause = match[2];

    if (extendsClause) {
      for (const specifier of splitPhpTypeList(extendsClause)) {
        references.push({
          relationship: 'extends',
          specifier,
        });
      }
    }

    if (implementsClause) {
      for (const specifier of splitPhpTypeList(implementsClause)) {
        references.push({
          relationship: 'implements',
          specifier,
        });
      }
    }
  }

  return references;
}

function splitPhpTypeList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && isLikelyPhpTypeReference(item));
}

function isLikelyPhpTypeReference(value: string): boolean {
  const normalizedValue = value.trim().replace(/^\\+/u, '');
  if (!normalizedValue || isPhpDocReservedTypeName(normalizedValue)) {
    return false;
  }

  const lastSegment = normalizedValue.split('\\').pop();
  if (!lastSegment) {
    return false;
  }

  return startsWithUppercase(lastSegment);
}

function extractPhpDocTypeExpressions(content: string): string[] {
  const typeExpressions: string[] = [];
  const docBlockRegex = /\/\*\*[\s\S]*?\*\//gmu;

  for (const match of content.matchAll(docBlockRegex)) {
    const docBlock = match[0];
    if (!docBlock) {
      continue;
    }

    const docBlockLines = docBlock.split('\n').map((line) => line.trim().replace(/^\*+\s?/u, ''));

    for (const docBlockLine of docBlockLines) {
      const tagMatch = docBlockLine.match(/^@([a-z0-9_-]+)\s+(.+)$/iu);
      if (!tagMatch?.[1] || !tagMatch[2]) {
        continue;
      }

      const tagName = tagMatch[1].toLowerCase();
      const tagBody = tagMatch[2].trim();
      if (!tagBody) {
        continue;
      }

      const typeExpression = resolvePhpDocTypeExpression({
        tagBody,
        tagName,
      });
      if (typeExpression) {
        typeExpressions.push(typeExpression);
      }
    }
  }

  return typeExpressions;
}

function resolvePhpDocTypeExpression(input: { tagBody: string; tagName: string }): string | null {
  if (
    input.tagName === 'method' ||
    input.tagName === 'phpstan-method' ||
    input.tagName === 'psalm-method'
  ) {
    const methodMatch = input.tagBody.match(/^(?:static\s+)?([^\s(]+)\s+[a-zA-Z_]\w*\s*\(/u);
    return methodMatch?.[1] ?? null;
  }

  if (
    input.tagName === 'param' ||
    input.tagName === 'phpstan-param' ||
    input.tagName === 'psalm-param' ||
    input.tagName === 'property' ||
    input.tagName === 'property-read' ||
    input.tagName === 'property-write' ||
    input.tagName === 'phpstan-property' ||
    input.tagName === 'phpstan-property-read' ||
    input.tagName === 'phpstan-property-write' ||
    input.tagName === 'psalm-property' ||
    input.tagName === 'psalm-property-read' ||
    input.tagName === 'psalm-property-write'
  ) {
    const propertyMatch = input.tagBody.match(/^(.+?)(?:\s+\$[a-zA-Z_]\w*|\s*$)/u);
    return propertyMatch?.[1]?.trim() ?? null;
  }

  if (!PHPDOC_TYPE_TAGS.has(input.tagName)) {
    return null;
  }

  const [typeExpression] = input.tagBody.split(/\s+/u);
  return typeExpression?.trim() ? typeExpression.trim() : null;
}

function extractPhpDocTypeCandidates(typeExpression: string): string[] {
  const candidates = new Set<string>();
  const typeReferenceRegex = /\\?[a-zA-Z_][a-zA-Z0-9_]*(?:\\[a-zA-Z_][a-zA-Z0-9_]*)*/gmu;

  for (const match of typeExpression.matchAll(typeReferenceRegex)) {
    const candidate = match[0]?.replace(/\\+/gu, '\\');
    if (!candidate) {
      continue;
    }

    const normalizedCandidate = candidate.replace(/^\\+/u, '');
    if (!normalizedCandidate || isPhpDocReservedTypeName(normalizedCandidate)) {
      continue;
    }

    const candidateEndIndex = (match.index ?? 0) + candidate.length;
    if (typeExpression[candidateEndIndex] === ':' && !candidate.includes('\\')) {
      continue;
    }

    const lastSegment = normalizedCandidate.split('\\').pop();
    if (!lastSegment) {
      continue;
    }

    if (!candidate.includes('\\') && !startsWithUppercase(lastSegment)) {
      continue;
    }

    candidates.add(candidate);
  }

  return [...candidates];
}

function isPhpDocReservedTypeName(typeName: string): boolean {
  return PHPDOC_RESERVED_TYPE_NAMES.has(typeName.toLowerCase());
}

function startsWithUppercase(value: string): boolean {
  const firstCharacter = value.slice(0, 1);
  return firstCharacter.length > 0 && firstCharacter === firstCharacter.toUpperCase();
}

function pushResolvedPhpTypeReference(input: {
  file: LoadedSourceFile;
  importAliases: Map<string, string>;
  namespaceSymbolIndex: Map<string, string>;
  references: ExtractedReference[];
  relationship: ExtractedReferenceRelationship;
  typeCandidate: string;
  unresolvedReferences: UnresolvedExtractedReference[];
}): void {
  const resolvedPath = resolvePhpTypeReference({
    importAliases: input.importAliases,
    namespaceName: input.file.namespaceName,
    namespaceSymbolIndex: input.namespaceSymbolIndex,
    typeCandidate: input.typeCandidate,
  });
  if (!resolvedPath || resolvedPath === input.file.path) {
    input.unresolvedReferences.push({
      candidatePaths: [],
      confidence: 0.4,
      from: input.file.path,
      language: input.file.language,
      reason: `타입 후보 ${input.typeCandidate} 를 현재 namespace/import 정보만으로 해석하지 못했습니다.`,
      relationship: input.relationship,
      resolutionKind: 'php-type',
      specifier: input.typeCandidate,
    });
    return;
  }

  input.references.push({
    from: input.file.path,
    relationship: input.relationship,
    specifier: input.typeCandidate,
    to: resolvedPath,
  });
}

function resolvePhpIncludeReference(input: {
  allFilePaths: Set<string>;
  caseInsensitiveFilePathIndex: Map<string, string>;
  fromPath: string;
  includeReference: PhpIncludeReference;
}): ReferenceResolution {
  if (input.includeReference.rootConstant) {
    const basePath = join(
      PHP_PATH_CONSTANT_BASE_PATHS[input.includeReference.rootConstant],
      input.includeReference.path,
    );
    const candidatePaths = createResolutionCandidates(basePath);

    return {
      candidatePaths,
      reason: `${input.includeReference.rootConstant} 기반 include 경로를 찾지 못했습니다.`,
      resolutionKind: 'php-include-constant',
      resolvedPath: resolveProjectFilePathCaseInsensitiveFromCandidates({
        allFilePaths: input.allFilePaths,
        candidatePaths,
        caseInsensitiveFilePathIndex: input.caseInsensitiveFilePathIndex,
      }),
    };
  }

  const candidatePaths = createResolutionCandidates(
    normalizeRelativePath(join(dirname(input.fromPath), input.includeReference.path)),
  );

  return {
    candidatePaths,
    reason: `상대 include 경로 ${input.includeReference.rawSpecifier} 를 해석하지 못했습니다.`,
    resolutionKind: 'php-include',
    resolvedPath: resolveProjectFilePathCaseInsensitiveFromCandidates({
      allFilePaths: input.allFilePaths,
      caseInsensitiveFilePathIndex: input.caseInsensitiveFilePathIndex,
      candidatePaths,
    }),
  };
}

function resolvePhpFrameworkLoadReference(input: {
  allFilePaths: Set<string>;
  caseInsensitiveFilePathIndex: Map<string, string>;
  loaderReference: PhpFrameworkLoadReference;
}): ReferenceResolution {
  const basePaths = resolvePhpFrameworkLoadBasePaths(input.loaderReference);

  return {
    candidatePaths: basePaths,
    reason: `${input.loaderReference.kind} loader 후보를 탐색했지만 대상 파일을 찾지 못했습니다.`,
    resolutionKind: 'php-framework-loader',
    resolvedPath: resolveProjectFilePathCaseInsensitiveFromBasePaths({
      allFilePaths: input.allFilePaths,
      basePaths,
      caseInsensitiveFilePathIndex: input.caseInsensitiveFilePathIndex,
    }),
  };
}

function resolvePhpFrameworkLoadBasePaths(loaderReference: PhpFrameworkLoadReference): string[] {
  const normalizedPath = loaderReference.path.replace(/\.php$/iu, '').replace(/^\/+/u, '');

  switch (loaderReference.kind) {
    case 'config':
      return [join('application/config', normalizedPath)];
    case 'helper':
      return [
        join('application/helpers', `${normalizedPath}_helper`),
        join('system/helpers', `${normalizedPath}_helper`),
      ];
    case 'library':
      return [
        join('application/libraries', normalizedPath),
        join('system/libraries', normalizedPath),
      ];
    case 'model':
      return [join('application/models', normalizedPath)];
    case 'service':
      return [join('application/services', normalizedPath)];
  }
}

function resolvePhpTypeReference(input: {
  importAliases: Map<string, string>;
  namespaceName: string | null;
  namespaceSymbolIndex: Map<string, string>;
  typeCandidate: string;
}): string | null {
  const normalizedCandidate = input.typeCandidate
    .trim()
    .replace(/^\\+/u, '')
    .replace(/\\+/gu, '\\');
  if (!normalizedCandidate) {
    return null;
  }

  if (input.typeCandidate.startsWith('\\')) {
    return resolveQualifiedNamespaceSymbol({
      namespaceSymbolIndex: input.namespaceSymbolIndex,
      qualifiedName: normalizedCandidate,
    });
  }

  const candidateSegments = normalizedCandidate.split('\\').filter(Boolean);
  const aliasName = candidateSegments[0]?.toLowerCase();
  if (aliasName) {
    const aliasTarget = input.importAliases.get(aliasName);
    if (aliasTarget) {
      const aliasedQualifiedName = [aliasTarget, ...candidateSegments.slice(1)].join('\\');
      const aliasedMatch = resolveQualifiedNamespaceSymbol({
        namespaceSymbolIndex: input.namespaceSymbolIndex,
        qualifiedName: aliasedQualifiedName,
      });
      if (aliasedMatch) {
        return aliasedMatch;
      }
    }
  }

  if (input.namespaceName) {
    const namespacedMatch = resolveQualifiedNamespaceSymbol({
      namespaceSymbolIndex: input.namespaceSymbolIndex,
      qualifiedName: `${input.namespaceName}\\${normalizedCandidate}`,
    });
    if (namespacedMatch) {
      return namespacedMatch;
    }
  }

  return resolveQualifiedNamespaceSymbol({
    namespaceSymbolIndex: input.namespaceSymbolIndex,
    qualifiedName: normalizedCandidate,
  });
}

function resolveQualifiedPackageSymbol(input: {
  packageSymbolIndex: Map<string, string>;
  qualifiedName: string;
}): string | null {
  return resolveQualifiedSymbol({
    delimiter: '.',
    qualifiedName: input.qualifiedName,
    symbolIndex: input.packageSymbolIndex,
  });
}

function resolveQualifiedNamespaceSymbol(input: {
  namespaceSymbolIndex: Map<string, string>;
  qualifiedName: string;
}): string | null {
  return resolveQualifiedSymbol({
    delimiter: '\\',
    qualifiedName: input.qualifiedName,
    symbolIndex: input.namespaceSymbolIndex,
  });
}

function resolveQualifiedSymbol(input: {
  delimiter: '.' | '\\';
  qualifiedName: string;
  symbolIndex: Map<string, string>;
}): string | null {
  let candidate = input.qualifiedName;

  while (candidate.length > 0) {
    const directMatch = input.symbolIndex.get(candidate);
    if (directMatch) {
      return directMatch;
    }

    const lastDelimiterIndex = candidate.lastIndexOf(input.delimiter);
    if (lastDelimiterIndex < 0) {
      break;
    }

    candidate = candidate.slice(0, lastDelimiterIndex);
  }

  return null;
}

function resolveScriptKind(path: string): ts.ScriptKind {
  const extension = extname(path).toLowerCase();

  switch (extension) {
    case '.ts':
      return ts.ScriptKind.TS;
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.mts':
    case '.cts':
      return ts.ScriptKind.TS;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.mjs':
    case '.cjs':
    case '.js':
    default:
      return ts.ScriptKind.JS;
  }
}

function resolveSupportedSourceLanguage(path: string): SupportedSourceLanguage | null {
  return SUPPORTED_SOURCE_EXTENSIONS.get(extname(path).toLowerCase()) ?? null;
}

function classifyFile(input: {
  discoveredHints: ExtractedStructuralHint[];
  discovery: ProjectAnalysisStructureDiscovery;
  keyConfigs: Set<string>;
  language: SupportedSourceLanguage | null;
  path: string;
  scanState: ProjectAnalysisScanState;
}): FileClassification {
  const path = normalizeRelativePath(input.path);
  const isEntrypoint = input.scanState.entrypoints.has(path);
  const isKeyConfig = input.keyConfigs.has(path);
  const isTestFile = isTestFilePath(path);
  const inferredCategory = isEntrypoint
    ? 'entrypoint'
    : isKeyConfig
      ? 'config'
      : inferFileCategory({
          language: input.language,
          path,
        });
  const subjectCategory = isTestFile
    ? resolveTestSubjectCategory(path, inferredCategory)
    : inferredCategory;
  const fallbackLayer = inferLayerName({
    category: subjectCategory,
    language: input.language,
    path,
  });
  const grouping = resolveFileGrouping({
    discovery: input.discovery,
    fallbackLayer,
    path,
    subjectCategory,
  });
  const subjectLayer = resolveDiscoveredLayerName({
    category: subjectCategory,
    discovery: input.discovery,
    fallbackLayer,
    grouping,
    language: input.language,
    path,
  });
  const subjectRole = inferFileRole({
    category: subjectCategory,
    language: input.language,
    layer: subjectLayer,
    path,
  });
  const classification = resolveFileClassificationMeta({
    discoveredHints: input.discoveredHints,
    fallbackLayer,
    grouping,
    isEntrypoint,
    isKeyConfig,
    isTestFile,
    path,
    subjectCategory,
  });

  if (!isTestFile) {
    return {
      category: subjectCategory,
      classification,
      grouping,
      layer: subjectLayer,
      role: subjectRole,
    };
  }

  return {
    category: 'test',
    classification: {
      category: {
        confidence: 0.95,
        reasons: [`테스트 경로 또는 파일명 규칙에서 ${path} 를 테스트로 분류했습니다.`],
        status: 'confirmed',
      },
      layer: classification.layer,
    },
    grouping,
    layer: inferTestLayerName(path, input.language),
    role: inferTestRole(path, subjectCategory),
  };
}

function resolveFileGrouping(input: {
  discovery: ProjectAnalysisStructureDiscovery;
  fallbackLayer: string | null;
  path: string;
  subjectCategory: string;
}): ProjectAnalysisFileGrouping {
  const discoveredSourceRoot = resolveNearestDiscoveredSourceRoot(input.discovery, input.path);
  const discoveredClusterPath = resolveDiscoveredFeatureClusterPath(input.discovery, input.path);
  const fallbackGrouping = resolveGroupingFromLayer(input.fallbackLayer);

  if (!discoveredSourceRoot) {
    return fallbackGrouping;
  }

  const relativePath = trimPathPrefix(input.path, discoveredSourceRoot.path);
  const relativeSegments = relativePath.split('/').filter(Boolean);
  const firstSegment = relativeSegments[0]?.toLowerCase() ?? null;
  const sourceRootPackageRoot = normalizeRelativePath(discoveredSourceRoot.packageRoot ?? '.');
  const area =
    sourceRootPackageRoot !== '.'
      ? sourceRootPackageRoot
      : firstSegment && firstSegment !== input.subjectCategory
        ? normalizeAreaName(firstSegment)
        : fallbackGrouping.area;
  const cluster =
    discoveredClusterPath ??
    (area && firstSegment && firstSegment !== input.subjectCategory
      ? joinPathSegments(area, firstSegment)
      : fallbackGrouping.cluster);

  return {
    area,
    cluster,
  };
}

function resolveDiscoveredLayerName(input: {
  category: string;
  discovery: ProjectAnalysisStructureDiscovery;
  fallbackLayer: string | null;
  grouping: ProjectAnalysisFileGrouping;
  language: SupportedSourceLanguage | null;
  path: string;
}): string | null {
  if (input.category === 'config') {
    return 'config';
  }

  if (!input.grouping.area) {
    return input.fallbackLayer;
  }

  if (input.category === 'entrypoint') {
    if (input.grouping.cluster && input.grouping.cluster !== input.grouping.area) {
      return `${input.grouping.cluster}/entrypoint`;
    }

    return `${input.grouping.area}/entrypoint`;
  }

  if (isTestFilePath(input.path)) {
    if (input.grouping.cluster && input.grouping.cluster !== input.grouping.area) {
      return `${input.grouping.cluster}/test`;
    }

    return `${input.grouping.area}/test`;
  }

  if (input.grouping.cluster && input.grouping.cluster !== input.grouping.area) {
    return `${input.grouping.cluster}/${input.category}`;
  }

  if (
    shouldUseFeatureScopedLayer({
      areaName: input.grouping.area,
      language: input.language,
    })
  ) {
    return `${input.grouping.area}/${input.category}`;
  }

  return input.fallbackLayer ?? input.grouping.area;
}

function resolveFileClassificationMeta(input: {
  discoveredHints: ExtractedStructuralHint[];
  fallbackLayer: string | null;
  grouping: ProjectAnalysisFileGrouping;
  isEntrypoint: boolean;
  isKeyConfig: boolean;
  isTestFile: boolean;
  path: string;
  subjectCategory: string;
}): ProjectAnalysisFileClassification {
  if (input.isEntrypoint) {
    return {
      category: {
        confidence: 0.98,
        reasons: [`진입점 후보 목록에 ${input.path} 가 포함되었습니다.`],
        status: 'confirmed',
      },
      layer: {
        confidence: 0.86,
        reasons: ['진입점 후보를 독립 레이어로 유지합니다.'],
        status: 'confirmed',
      },
    };
  }

  if (input.isKeyConfig) {
    return {
      category: {
        confidence: 0.98,
        reasons: [`주요 설정 파일 목록에 ${input.path} 가 포함되었습니다.`],
        status: 'confirmed',
      },
      layer: {
        confidence: 0.92,
        reasons: ['설정 파일은 config 레이어로 고정합니다.'],
        status: 'confirmed',
      },
    };
  }

  const categoryStatus =
    input.subjectCategory === 'source'
      ? input.grouping.cluster
        ? 'inferred'
        : 'fallback'
      : input.isTestFile
        ? 'confirmed'
        : input.grouping.cluster
          ? 'inferred'
          : 'confirmed';
  const categoryReasons = [
    input.subjectCategory === 'source'
      ? '명시적 역할명은 없지만 구조 발견 결과를 기준으로 소스 파일로 유지합니다.'
      : `파일명과 경로 규칙에서 ${input.subjectCategory} 역할을 추정했습니다.`,
    ...input.discoveredHints.slice(0, 2).map((hint) => hint.reason),
  ];
  const layerReasons = compactTextList([
    input.grouping.area ? `발견된 그룹 영역 ${input.grouping.area}` : null,
    input.grouping.cluster ? `반복 cluster ${input.grouping.cluster}` : null,
    input.fallbackLayer ? `fallback layer ${input.fallbackLayer}` : null,
  ]);

  return {
    category: {
      confidence:
        categoryStatus === 'confirmed' ? 0.88 : categoryStatus === 'inferred' ? 0.68 : 0.44,
      reasons: categoryReasons,
      status: categoryStatus,
    },
    layer: input.grouping.area
      ? {
          confidence: input.grouping.cluster ? 0.78 : 0.62,
          reasons:
            layerReasons.length > 0 ? layerReasons : ['구조 발견 결과를 레이어에 반영했습니다.'],
          status: input.grouping.cluster ? 'inferred' : 'fallback',
        }
      : null,
  };
}

function resolveGroupingFromLayer(layer: string | null): ProjectAnalysisFileGrouping {
  if (!layer) {
    return {
      area: null,
      cluster: null,
    };
  }

  const segments = layer.split('/').filter(Boolean);
  if (segments.length === 0) {
    return {
      area: null,
      cluster: null,
    };
  }

  if (segments.length === 1) {
    return {
      area: segments[0] ?? layer,
      cluster: segments[0] ?? layer,
    };
  }

  const cluster = segments.slice(0, -1).join('/');
  const area = cluster.includes('/')
    ? (resolveMonorepoAreaContext(cluster)?.areaName ?? cluster.split('/')[0] ?? cluster)
    : cluster;

  return {
    area,
    cluster,
  };
}

function trimPathPrefix(path: string, prefix: string): string {
  const normalizedPath = normalizeRelativePath(path);
  const normalizedPrefix = normalizeRelativePath(prefix);
  if (normalizedPrefix === '.' || normalizedPrefix.length === 0) {
    return normalizedPath;
  }

  return normalizedPath.slice(normalizedPrefix.length).replace(/^\/+/u, '');
}

function joinPathSegments(...segments: Array<string | null | undefined>): string {
  return segments.filter((segment): segment is string => Boolean(segment)).join('/');
}

function compactTextList(values: Array<string | null>): string[] {
  return values.filter((value): value is string => typeof value === 'string' && value.length > 0);
}

function inferFileCategory(input: {
  language: SupportedSourceLanguage | null;
  path: string;
}): string {
  const normalizedPath = normalizeRelativePath(input.path).toLowerCase();
  const fileName = normalizedPath.split('/').pop() ?? normalizedPath;
  const segments = normalizedPath.split('/').filter(Boolean);

  if (
    fileName.endsWith('.d.ts') ||
    fileName.includes('.type.') ||
    segments.includes('type') ||
    segments.includes('types')
  ) {
    return 'type';
  }

  if (input.language === 'php') {
    if (hasPhpFileNameSuffix(fileName, ['controller'])) {
      return 'controller';
    }

    if (hasPhpFileNameSuffix(fileName, ['service'])) {
      return 'service';
    }

    if (hasPhpFileNameSuffix(fileName, ['repository'])) {
      return 'repository';
    }

    if (hasPhpFileNameSuffix(fileName, ['mapper'])) {
      return 'mapper';
    }

    if (hasPhpFileNameSuffix(fileName, ['policy'])) {
      return 'policy';
    }

    if (hasPhpFileNameSuffix(fileName, ['strategy'])) {
      return 'strategy';
    }

    if (hasPhpFileNameSuffix(fileName, ['factory'])) {
      return 'factory';
    }

    if (hasPhpFileNameSuffix(fileName, ['validator'])) {
      return 'validator';
    }

    if (hasPhpFileNameSuffix(fileName, ['guard'])) {
      return 'guard';
    }

    if (hasPhpFileNameSuffix(fileName, ['model'])) {
      return 'model';
    }

    if (hasPhpFileNameSuffix(fileName, ['exception'])) {
      return 'exception';
    }
  }

  if (fileName.includes('.query.service.')) {
    return 'query-service';
  }

  if (fileName.includes('.command.service.')) {
    return 'command-service';
  }

  if (fileName.includes('.module.')) {
    return 'module';
  }

  if (fileName.includes('.controller.')) {
    return 'controller';
  }

  if (fileName.includes('.service.')) {
    return 'service';
  }

  if (fileName.includes('.handler.')) {
    if (segments.includes('query')) {
      return 'query-handler';
    }
    if (segments.includes('command')) {
      return 'command-handler';
    }
    return 'handler';
  }

  if (fileName.includes('.query.')) {
    return 'query';
  }

  if (fileName.includes('.command.')) {
    return 'command';
  }

  if (fileName.includes('.repository.')) {
    return 'repository';
  }

  if (fileName.includes('.dto.')) {
    return 'dto';
  }

  if (fileName.includes('.mapper.')) {
    return 'mapper';
  }

  if (fileName.includes('.policy.')) {
    return 'policy';
  }

  if (fileName.includes('.strategy.')) {
    return 'strategy';
  }

  if (fileName.includes('.guard.')) {
    return 'guard';
  }

  if (fileName.includes('.interceptor.')) {
    return 'interceptor';
  }

  if (fileName.includes('.decorator.')) {
    return 'decorator';
  }

  if (fileName.includes('.filter.')) {
    return 'filter';
  }

  if (fileName.includes('.middleware.')) {
    return 'middleware';
  }

  if (fileName.includes('.pipe.')) {
    return 'pipe';
  }

  if (fileName.includes('.factory.')) {
    return 'factory';
  }

  if (fileName.includes('.validator.')) {
    return 'validator';
  }

  if (fileName.includes('.entity.')) {
    return 'entity';
  }

  if (fileName.includes('.model.')) {
    return 'model';
  }

  if (fileName.includes('.exception.')) {
    return 'exception';
  }

  if (hasAnyPathSegment(segments, ['module', 'modules'])) {
    return 'module';
  }

  if (hasAnyPathSegment(segments, ['controller', 'controllers'])) {
    return 'controller';
  }

  if (hasAnyPathSegment(segments, ['repository', 'repositories'])) {
    return 'repository';
  }

  if (hasAnyPathSegment(segments, ['dto', 'dtos'])) {
    return 'dto';
  }

  if (hasAnyPathSegment(segments, ['service', 'services'])) {
    if (hasAnyPathSegment(segments, ['query', 'queries'])) {
      return 'query-service';
    }
    if (hasAnyPathSegment(segments, ['command', 'commands'])) {
      return 'command-service';
    }
    return 'service';
  }

  if (hasAnyPathSegment(segments, ['handler', 'handlers'])) {
    if (hasAnyPathSegment(segments, ['query', 'queries'])) {
      return 'query-handler';
    }
    if (hasAnyPathSegment(segments, ['command', 'commands'])) {
      return 'command-handler';
    }
    return 'handler';
  }

  if (hasAnyPathSegment(segments, ['query', 'queries'])) {
    return 'query';
  }

  if (hasAnyPathSegment(segments, ['command', 'commands'])) {
    return 'command';
  }

  if (hasAnyPathSegment(segments, ['mapper', 'mappers'])) {
    return 'mapper';
  }

  if (hasAnyPathSegment(segments, ['policy', 'policies'])) {
    return 'policy';
  }

  if (hasAnyPathSegment(segments, ['strategy', 'strategies'])) {
    return 'strategy';
  }

  if (hasAnyPathSegment(segments, ['guard', 'guards'])) {
    return 'guard';
  }

  if (hasAnyPathSegment(segments, ['interceptor', 'interceptors'])) {
    return 'interceptor';
  }

  if (hasAnyPathSegment(segments, ['decorator', 'decorators'])) {
    return 'decorator';
  }

  if (hasAnyPathSegment(segments, ['filter', 'filters'])) {
    return 'filter';
  }

  if (hasAnyPathSegment(segments, ['middleware', 'middlewares'])) {
    return 'middleware';
  }

  if (hasAnyPathSegment(segments, ['pipe', 'pipes'])) {
    return 'pipe';
  }

  if (hasAnyPathSegment(segments, ['factory', 'factories'])) {
    return 'factory';
  }

  if (hasAnyPathSegment(segments, ['validator', 'validators'])) {
    return 'validator';
  }

  if (hasAnyPathSegment(segments, ['entity', 'entities'])) {
    return 'entity';
  }

  if (hasAnyPathSegment(segments, ['model', 'models'])) {
    return 'model';
  }

  if (hasAnyPathSegment(segments, ['exception', 'exceptions'])) {
    return 'exception';
  }

  if (hasAnyPathSegment(segments, ['helper', 'helpers', 'util', 'utils'])) {
    return 'utility';
  }

  return 'source';
}

function hasAnyPathSegment(segments: string[], candidates: string[]): boolean {
  return candidates.some((candidate) => segments.includes(candidate));
}

function hasPhpFileNameSuffix(fileName: string, suffixes: string[]): boolean {
  return suffixes.some((suffix) => {
    if (fileName.endsWith(`${suffix}.php`)) {
      return true;
    }

    return new RegExp(`(?:^|[_.-])${suffix}\\.php$`, 'u').test(fileName);
  });
}

function inferFileRole(input: {
  category: string;
  language: SupportedSourceLanguage | null;
  layer: string | null;
  path: string;
}): string {
  if (input.category === 'entrypoint') {
    return '진입점 후보';
  }

  if (input.category === 'config') {
    return '설정 파일';
  }

  if (input.category === 'test') {
    return '테스트 파일';
  }

  const areaName = resolveAreaName(input.path);
  const areaLabel = areaName ? getLayerAreaDisplayName(areaName) : null;
  const categoryLabel = getFileCategoryDisplayName(input.category);

  if (areaLabel && categoryLabel) {
    if (areaLabel === categoryLabel) {
      return areaLabel;
    }

    return `${areaLabel} ${categoryLabel}`;
  }

  if (areaLabel) {
    return `${areaLabel} 영역`;
  }

  if (categoryLabel) {
    return categoryLabel;
  }

  if (input.language) {
    return `${getLanguageDisplayName(input.language)} 소스`;
  }

  return '소스 파일';
}

function resolveTestSubjectCategory(path: string, fallbackCategory: string): string {
  if (fallbackCategory !== 'source') {
    return fallbackCategory;
  }

  const normalizedSegments = resolveNormalizedPathSegments(path).map((segment) =>
    segment.toLowerCase(),
  );
  const areaName = resolveAreaName(path);

  if (normalizedSegments.includes('controller') || normalizedSegments.includes('controllers')) {
    return 'controller';
  }

  if (normalizedSegments.includes('module') || normalizedSegments.includes('modules')) {
    return 'module';
  }

  if (normalizedSegments.includes('service') || normalizedSegments.includes('services')) {
    if (normalizedSegments.includes('command') || normalizedSegments.includes('commands')) {
      return areaName === 'api' ? 'command-service' : 'command-handler';
    }
    if (normalizedSegments.includes('query') || normalizedSegments.includes('queries')) {
      return areaName === 'api' ? 'query-service' : 'query-handler';
    }
    return 'service';
  }

  if (normalizedSegments.includes('handler') || normalizedSegments.includes('handlers')) {
    if (normalizedSegments.includes('command') || normalizedSegments.includes('commands')) {
      return 'command-handler';
    }
    if (normalizedSegments.includes('query') || normalizedSegments.includes('queries')) {
      return 'query-handler';
    }
    return 'handler';
  }

  if (normalizedSegments.includes('repository') || normalizedSegments.includes('repositories')) {
    return 'repository';
  }

  if (normalizedSegments.includes('query') || normalizedSegments.includes('queries')) {
    return areaName === 'api' ? 'query-service' : 'query-handler';
  }

  if (normalizedSegments.includes('command') || normalizedSegments.includes('commands')) {
    return areaName === 'api' ? 'command-service' : 'command-handler';
  }

  if (normalizedSegments.includes('dto') || normalizedSegments.includes('dtos')) {
    return 'dto';
  }

  if (normalizedSegments.includes('mapper') || normalizedSegments.includes('mappers')) {
    return 'mapper';
  }

  if (normalizedSegments.includes('strategy') || normalizedSegments.includes('strategies')) {
    return 'strategy';
  }

  if (normalizedSegments.includes('guard') || normalizedSegments.includes('guards')) {
    return 'guard';
  }

  return 'feature';
}

function inferTestRole(path: string, subjectCategory: string): string {
  const areaName = resolveAreaName(path);
  const areaLabel = areaName ? getLayerAreaDisplayName(areaName) : '테스트';
  const categoryLabel =
    subjectCategory === 'feature'
      ? '기능'
      : (getFileCategoryDisplayName(subjectCategory) ?? '기능');

  return `${areaLabel} ${categoryLabel} 테스트`;
}

function inferLayerName(input: {
  category: string;
  language: SupportedSourceLanguage | null;
  path: string;
}): string | null {
  if (input.category === 'config') {
    return 'config';
  }

  const areaName = resolveAreaName(input.path);
  if (!areaName) {
    return null;
  }

  if (input.category === 'entrypoint') {
    const featureScopeSegments = resolveFeatureScopeSegments({
      areaName,
      path: input.path,
    });
    if (
      shouldUseFeatureScopedLayer({
        areaName,
        language: input.language,
      }) &&
      featureScopeSegments.length > 0
    ) {
      return `${areaName}/${featureScopeSegments.join('/')}/entrypoint`;
    }

    if (isMonorepoAreaName(areaName)) {
      return `${areaName}/entrypoint`;
    }

    return 'entrypoint';
  }

  if (
    !shouldUseFeatureScopedLayer({
      areaName,
      language: input.language,
    })
  ) {
    return areaName;
  }

  const featureScopeSegments = resolveFeatureScopeSegments({
    areaName,
    path: input.path,
  });
  if (featureScopeSegments.length === 0) {
    return `${areaName}/${input.category}`;
  }

  return `${areaName}/${featureScopeSegments.join('/')}/${input.category}`;
}

function inferTestLayerName(path: string, language: SupportedSourceLanguage | null): string {
  const areaName = resolveAreaName(path);
  if (!areaName || areaName === 'test' || areaName === 'entrypoint') {
    return 'test';
  }

  if (
    !shouldUseFeatureScopedLayer({
      areaName,
      language,
    })
  ) {
    return areaName;
  }

  const featureScopeSegments = resolveFeatureScopeSegments({
    areaName,
    path,
  });
  if (featureScopeSegments.length === 0) {
    return `${areaName}/test`;
  }

  return `${areaName}/${featureScopeSegments.join('/')}/test`;
}

function resolveAreaName(path: string): string | null {
  const areaContext = resolveAreaContext(path);
  return areaContext?.areaName ?? null;
}

function resolveAreaContext(path: string): {
  areaName: string;
  scopeStartIndex: number;
  sourceSegments: string[];
} | null {
  const monorepoAreaContext = resolveMonorepoAreaContext(path);
  if (monorepoAreaContext) {
    return monorepoAreaContext;
  }

  const segments = resolveSourceRelativeSegments(path);
  if (segments.length === 0) {
    return null;
  }

  const firstSegment = segments[0]?.toLowerCase();
  if (!firstSegment) {
    return null;
  }

  if (TEST_PATH_SEGMENTS.has(firstSegment)) {
    return {
      areaName: 'test',
      scopeStartIndex: 1,
      sourceSegments: segments,
    };
  }

  if (firstSegment.includes('.')) {
    return {
      areaName: 'entrypoint',
      scopeStartIndex: 1,
      sourceSegments: segments,
    };
  }

  const phpApplicationAreaContext = resolvePhpApplicationAreaContext(segments, path);
  if (phpApplicationAreaContext) {
    return phpApplicationAreaContext;
  }

  if (ROOT_AREA_NAMES.has(firstSegment)) {
    return {
      areaName: normalizeAreaName(firstSegment),
      scopeStartIndex: 1,
      sourceSegments: segments,
    };
  }

  return {
    areaName: normalizeAreaName(firstSegment),
    scopeStartIndex: 1,
    sourceSegments: segments,
  };
}

function resolvePhpApplicationAreaContext(
  segments: string[],
  path: string,
): { areaName: string; scopeStartIndex: number; sourceSegments: string[] } | null {
  if (extname(path).toLowerCase() !== '.php') {
    return null;
  }

  if (segments[0]?.toLowerCase() !== 'application') {
    return null;
  }

  const structuralSegment = segments[1]?.toLowerCase();
  if (!structuralSegment) {
    return {
      areaName: 'application',
      scopeStartIndex: 1,
      sourceSegments: segments,
    };
  }

  switch (structuralSegment) {
    case 'config':
    case 'configs':
      return {
        areaName: 'config',
        scopeStartIndex: 2,
        sourceSegments: segments,
      };
    case 'controller':
    case 'controllers': {
      const controllerSubArea = segments[2]?.toLowerCase();
      if (controllerSubArea === 'api') {
        return {
          areaName: 'api',
          scopeStartIndex: 3,
          sourceSegments: segments,
        };
      }

      return {
        areaName: 'controller',
        scopeStartIndex: 2,
        sourceSegments: segments,
      };
    }
    case 'core':
      return {
        areaName: 'core',
        scopeStartIndex: 2,
        sourceSegments: segments,
      };
    case 'domain':
    case 'domains':
      return {
        areaName: 'domain',
        scopeStartIndex: 2,
        sourceSegments: segments,
      };
    case 'helper':
    case 'helpers':
      return {
        areaName: 'util',
        scopeStartIndex: 2,
        sourceSegments: segments,
      };
    case 'libraries':
    case 'library':
      return {
        areaName: 'library',
        scopeStartIndex: 2,
        sourceSegments: segments,
      };
    case 'model':
    case 'models':
      return {
        areaName: 'model',
        scopeStartIndex: 2,
        sourceSegments: segments,
      };
    case 'service':
    case 'services':
      return {
        areaName: 'service',
        scopeStartIndex: 2,
        sourceSegments: segments,
      };
    default:
      return {
        areaName: 'application',
        scopeStartIndex: 1,
        sourceSegments: segments,
      };
  }
}

function resolveMonorepoAreaContext(path: string): {
  areaName: string;
  scopeStartIndex: number;
  sourceSegments: string[];
} | null {
  const normalizedSegments = resolveNormalizedPathSegments(path);
  const packageRootSegments = resolveMonorepoPackageRootSegments(normalizedSegments);
  if (!packageRootSegments) {
    return null;
  }

  const sourceSegments = resolveMonorepoSourceSegments({
    normalizedSegments,
    packageRootSegments,
  });
  const packageAreaName = packageRootSegments.map((segment) => segment.toLowerCase()).join('/');

  return {
    areaName: packageAreaName,
    scopeStartIndex: 0,
    sourceSegments,
  };
}

function resolveMonorepoPackageRootSegments(normalizedSegments: string[]): string[] | null {
  if (normalizedSegments.length < 2) {
    return null;
  }

  const monorepoRoot = normalizedSegments[0]?.toLowerCase();
  if (!monorepoRoot || !MONOREPO_ROOT_DIRECTORIES.has(monorepoRoot)) {
    return null;
  }

  let packageRootLength = 2;
  for (const segment of normalizedSegments.slice(2)) {
    const normalizedSegment = segment.toLowerCase();
    if (
      normalizedSegment === 'src' ||
      TEST_PATH_SEGMENTS.has(normalizedSegment) ||
      ROOT_AREA_NAMES.has(normalizedSegment) ||
      STRUCTURAL_PATH_SEGMENTS.has(normalizedSegment) ||
      segment.includes('.')
    ) {
      break;
    }

    packageRootLength += 1;
  }

  return normalizedSegments.slice(0, packageRootLength);
}

function resolveMonorepoSourceSegments(input: {
  normalizedSegments: string[];
  packageRootSegments: string[];
}): string[] {
  const sourceRootIndex = input.normalizedSegments.lastIndexOf('src');
  if (sourceRootIndex >= 0) {
    return input.normalizedSegments.slice(sourceRootIndex + 1);
  }

  return input.normalizedSegments.slice(input.packageRootSegments.length);
}

function resolveSourceRelativeSegments(path: string): string[] {
  const normalizedSegments = resolveNormalizedPathSegments(path);
  const sourceRootIndex = normalizedSegments.lastIndexOf('src');
  if (sourceRootIndex >= 0 && sourceRootIndex < normalizedSegments.length - 1) {
    return normalizedSegments.slice(sourceRootIndex + 1);
  }

  return normalizedSegments;
}

function resolveNormalizedPathSegments(path: string): string[] {
  return normalizeRelativePath(path)
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function normalizeAreaName(areaName: string): string {
  switch (areaName) {
    case 'tests':
      return 'test';
    case 'utils':
      return 'util';
    default:
      return areaName;
  }
}

function shouldUseFeatureScopedLayer(input: {
  areaName: string;
  language: SupportedSourceLanguage | null;
}): boolean {
  if (input.areaName === 'application' && input.language === 'php') {
    return true;
  }

  return (
    !LOW_GRANULARITY_AREAS.has(input.areaName) &&
    input.areaName !== 'entrypoint' &&
    input.areaName !== 'test'
  );
}

function resolveFeatureScopeSegments(input: { areaName: string; path: string }): string[] {
  const areaContext = resolveAreaContext(input.path);
  const sourceSegments = areaContext?.sourceSegments ?? resolveSourceRelativeSegments(input.path);
  if (sourceSegments.length <= 1) {
    return [];
  }

  if (input.areaName === 'entrypoint' || input.areaName === 'test') {
    return [];
  }

  const scopeStartIndex = areaContext?.scopeStartIndex ?? 1;
  const directorySegments = sourceSegments.slice(scopeStartIndex, -1);
  const featureScopeSegments: string[] = [];
  const shouldSkipLeadingStructuralSegments =
    (input.areaName === 'application' && scopeStartIndex <= 1) ||
    (isMonorepoAreaName(input.areaName) && scopeStartIndex <= 0);
  const featureScopeLimit = resolveFeatureScopeLimit({
    areaName: input.areaName,
    directorySegments,
  });

  for (const directorySegment of directorySegments) {
    const normalizedSegment = directorySegment.toLowerCase();
    if (TEST_PATH_SEGMENTS.has(normalizedSegment)) {
      break;
    }

    if (STRUCTURAL_PATH_SEGMENTS.has(normalizedSegment)) {
      if (shouldSkipLeadingStructuralSegments && featureScopeSegments.length === 0) {
        continue;
      }
      break;
    }

    featureScopeSegments.push(normalizedSegment);
    if (featureScopeLimit !== null && featureScopeSegments.length >= featureScopeLimit) {
      break;
    }
  }

  return featureScopeSegments;
}

function isMonorepoAreaName(areaName: string): boolean {
  const [rootSegment, packageName] = areaName.split('/').filter(Boolean);
  return Boolean(rootSegment && packageName && MONOREPO_ROOT_DIRECTORIES.has(rootSegment));
}

function resolveFeatureScopeLimit(input: {
  areaName: string;
  directorySegments: string[];
}): number | null {
  if (input.areaName !== 'application') {
    return DEFAULT_FEATURE_SCOPE_LIMIT;
  }

  const firstDirectorySegment = input.directorySegments[0]?.toLowerCase();
  if (firstDirectorySegment && PHP_APPLICATION_UNBOUNDED_SCOPE_ROOTS.has(firstDirectorySegment)) {
    return null;
  }

  return DEFAULT_FEATURE_SCOPE_LIMIT;
}

function isTestFilePath(path: string): boolean {
  return /(?:^|\/)(?:test|tests|__tests__|__test__|__mocks__)(?:\/|$)|\.(?:test|spec)\.[^.]+$/u.test(
    path,
  );
}

function getBaseNameWithoutExtension(path: string): string {
  const normalizedPath = normalizeRelativePath(path);
  const fileName = normalizedPath.split('/').pop() ?? normalizedPath;
  const extension = extname(fileName);

  return extension.length > 0 ? fileName.slice(0, -extension.length) : fileName;
}

function normalizeRelativePath(value: string): string {
  return value.replaceAll('\\', '/');
}
