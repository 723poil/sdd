import { readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';

import ts from 'typescript';

import type {
  ProjectAnalysisConnection,
  ProjectAnalysisDirectorySummary,
  ProjectAnalysisFileIndexEntry,
  ProjectAnalysisFileReference,
  ProjectAnalysisFileReferenceTarget,
  ProjectAnalysisLayerSummary,
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
import type { ProjectAnalysisScanState } from '@/infrastructure/analysis/project-analysis-scanner';

const SUPPORTED_SOURCE_EXTENSIONS = new Map<string, SupportedSourceLanguage>([
  ['.ts', 'typescript'],
  ['.tsx', 'typescript'],
  ['.mts', 'typescript'],
  ['.cts', 'typescript'],
  ['.js', 'javascript'],
  ['.jsx', 'javascript'],
  ['.mjs', 'javascript'],
  ['.cjs', 'javascript'],
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
  '.kt',
  '.kts',
  '.php',
  '.java',
  '.json',
] as const;

const JAVASCRIPT_RUNTIME_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs']);
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
  path: string;
  language: SupportedSourceLanguage;
  content: string;
  baseName: string;
  packageName: string | null;
  namespaceName: string | null;
  declarations: string[];
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

interface PathAliasRule {
  matcher: AliasMatcher;
  replacements: AliasReplacementRule[];
}

interface AliasMatcher {
  prefix: string;
  suffix: string;
  wildcard: boolean;
}

interface AliasReplacementRule {
  prefix: string;
  suffix: string;
  wildcard: boolean;
}

interface PathAliasConfig {
  baseUrl: string;
  rules: PathAliasRule[];
}

interface ExtractedReference {
  from: string;
  relationship: ExtractedReferenceRelationship;
  specifier: string;
  to: string;
}

interface LayerConnectionAccumulator {
  count: number;
  from: string;
  samples: string[];
  to: string;
}

interface FileClassification {
  category: string;
  layer: string | null;
  role: string;
}

export interface LocalProjectReferenceAnalysis {
  connections: ProjectAnalysisConnection[];
  directorySummaries: ProjectAnalysisDirectorySummary[];
  fileIndex: ProjectAnalysisFileIndexEntry[];
  fileReferences: ProjectAnalysisFileReference[];
  layers: ProjectAnalysisLayerSummary[];
}

export async function analyzeLocalProjectReferences(input: {
  rootPath: string;
  scanState: ProjectAnalysisScanState;
}): Promise<LocalProjectReferenceAnalysis> {
  const filePaths = [...input.scanState.files].map((path) => normalizeRelativePath(path));
  const allFilePaths = new Set(filePaths);
  const caseInsensitiveFilePathIndex = buildCaseInsensitiveFilePathIndex(allFilePaths);
  const aliasConfig = await readPathAliasConfig(input.rootPath);
  const sourceFiles = await loadSourceFiles({
    allFilePaths,
    rootPath: input.rootPath,
  });

  const packageSymbolIndex = buildPackageSymbolIndex(sourceFiles);
  const namespaceSymbolIndex = buildNamespaceSymbolIndex(sourceFiles);
  const fileReferences = deduplicateFileReferences(
    sourceFiles.flatMap((file) =>
      extractReferencesForFile({
        aliasConfig,
        allFilePaths,
        caseInsensitiveFilePathIndex,
        file,
        namespaceSymbolIndex,
        packageSymbolIndex,
      }),
    ),
  );
  const fileIndex = buildFileIndex({
    fileReferences,
    keyConfigs: input.scanState.keyConfigs,
    loadedFiles: sourceFiles,
    scanState: input.scanState,
  });
  const layers = buildLayerSummaries({
    fileIndex,
    fileReferences,
  });
  const directorySummaries = buildDirectorySummaries({
    fileIndex,
    scanState: input.scanState,
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
  };
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

  return {
    path: input.path,
    language: input.language,
    content: input.content,
    baseName,
    packageName:
      input.language === 'java' || input.language === 'kotlin'
        ? extractPackageName(input.content)
        : null,
    namespaceName: input.language === 'php' ? extractPhpNamespace(input.content) : null,
    declarations: extractTopLevelDeclarations({
      baseName,
      content: input.content,
      language: input.language,
    }),
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
  aliasConfig: PathAliasConfig;
  allFilePaths: Set<string>;
  caseInsensitiveFilePathIndex: Map<string, string>;
  file: LoadedSourceFile;
  namespaceSymbolIndex: Map<string, string>;
  packageSymbolIndex: Map<string, string>;
}): ExtractedReference[] {
  switch (input.file.language) {
    case 'typescript':
    case 'javascript':
      return extractJavaScriptLikeReferences(input);
    case 'java':
      return extractPackageManagedReferences({
        file: input.file,
        packageSymbolIndex: input.packageSymbolIndex,
      });
    case 'kotlin':
      return extractPackageManagedReferences({
        file: input.file,
        packageSymbolIndex: input.packageSymbolIndex,
      });
    case 'php':
      return extractPhpReferences({
        allFilePaths: input.allFilePaths,
        caseInsensitiveFilePathIndex: input.caseInsensitiveFilePathIndex,
        file: input.file,
        namespaceSymbolIndex: input.namespaceSymbolIndex,
      });
  }
}

function extractJavaScriptLikeReferences(input: {
  aliasConfig: PathAliasConfig;
  allFilePaths: Set<string>;
  file: LoadedSourceFile;
}): ExtractedReference[] {
  const references: ExtractedReference[] = [];
  const importedSymbolTargets = new Map<string, string>();
  const sourceFile = ts.createSourceFile(
    input.file.path,
    input.file.content,
    ts.ScriptTarget.Latest,
    true,
    resolveScriptKind(input.file.path),
  );

  const visitNode = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      const resolvedPath = resolveJavaScriptReferencePath({
        aliasConfig: input.aliasConfig,
        allFilePaths: input.allFilePaths,
        file: input.file,
        specifier: node.moduleSpecifier.text,
      });
      pushResolvedReference({
        file: input.file,
        references,
        relationship: 'imports',
        resolvedPath,
        specifier: node.moduleSpecifier.text,
      });
      if (ts.isImportDeclaration(node)) {
        indexJavaScriptImportBindings(node.importClause, resolvedPath, importedSymbolTargets);
      }
    }

    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const expression = node.moduleReference.expression;
      if (expression && ts.isStringLiteralLike(expression)) {
        const resolvedPath = resolveJavaScriptReferencePath({
          aliasConfig: input.aliasConfig,
          allFilePaths: input.allFilePaths,
          file: input.file,
          specifier: expression.text,
        });
        pushResolvedReference({
          file: input.file,
          references,
          relationship: 'requires',
          resolvedPath,
          specifier: expression.text,
        });
        if (resolvedPath && resolvedPath !== input.file.path) {
          importedSymbolTargets.set(node.name.text, resolvedPath);
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
          aliasConfig: input.aliasConfig,
          allFilePaths: input.allFilePaths,
          file: input.file,
          references,
          relationship: 'requires',
          specifier: firstArgument.text,
        });
      }

      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        pushJavaScriptReference({
          aliasConfig: input.aliasConfig,
          allFilePaths: input.allFilePaths,
          file: input.file,
          references,
          relationship: 'dynamic-import',
          specifier: firstArgument.text,
        });
      }
    }

    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      const literal = node.argument.literal;
      if (ts.isStringLiteralLike(literal)) {
        pushJavaScriptReference({
          aliasConfig: input.aliasConfig,
          allFilePaths: input.allFilePaths,
          file: input.file,
          references,
          relationship: 'imports',
          specifier: literal.text,
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

  return references;
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
  aliasConfig: PathAliasConfig;
  allFilePaths: Set<string>;
  file: LoadedSourceFile;
  references: ExtractedReference[];
  relationship: ExtractedReferenceRelationship;
  specifier: string;
}): void {
  const resolvedPath = resolveJavaScriptReferencePath({
    aliasConfig: input.aliasConfig,
    allFilePaths: input.allFilePaths,
    file: input.file,
    specifier: input.specifier,
  });

  pushResolvedReference({
    file: input.file,
    references: input.references,
    relationship: input.relationship,
    resolvedPath,
    specifier: input.specifier,
  });
}

function resolveJavaScriptReferencePath(input: {
  aliasConfig: PathAliasConfig;
  allFilePaths: Set<string>;
  file: LoadedSourceFile;
  specifier: string;
}): string | null {
  return resolveModuleSpecifier({
    aliasConfig: input.aliasConfig,
    allFilePaths: input.allFilePaths,
    fromPath: input.file.path,
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
  packageSymbolIndex: Map<string, string>;
}): ExtractedReference[] {
  const references: ExtractedReference[] = [];
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
      continue;
    }

    references.push({
      from: input.file.path,
      relationship: 'imports',
      specifier: qualifiedName,
      to: resolvedPath,
    });
  }

  return references;
}

function extractPhpReferences(input: {
  allFilePaths: Set<string>;
  caseInsensitiveFilePathIndex: Map<string, string>;
  file: LoadedSourceFile;
  namespaceSymbolIndex: Map<string, string>;
}): ExtractedReference[] {
  const references: ExtractedReference[] = [];
  const phpUseImports = extractPhpUseImports(input.file.content);
  const phpImportAliases = buildPhpImportAliasMap(phpUseImports);

  for (const importPath of phpUseImports.map((phpUseImport) => phpUseImport.qualifiedName)) {
    const resolvedPath = resolveQualifiedNamespaceSymbol({
      namespaceSymbolIndex: input.namespaceSymbolIndex,
      qualifiedName: importPath,
    });
    if (!resolvedPath || resolvedPath === input.file.path) {
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
    const resolvedPath = resolvePhpIncludeReference({
      allFilePaths: input.allFilePaths,
      caseInsensitiveFilePathIndex: input.caseInsensitiveFilePathIndex,
      fromPath: input.file.path,
      includeReference,
    });
    if (!resolvedPath || resolvedPath === input.file.path) {
      continue;
    }

    references.push({
      from: input.file.path,
      relationship: 'includes',
      specifier: includeReference.rawSpecifier,
      to: resolvedPath,
    });
  }

  for (const loaderReference of extractPhpFrameworkLoadReferences(input.file.content)) {
    const resolvedPath = resolvePhpFrameworkLoadReference({
      allFilePaths: input.allFilePaths,
      caseInsensitiveFilePathIndex: input.caseInsensitiveFilePathIndex,
      loaderReference,
    });
    if (!resolvedPath || resolvedPath === input.file.path) {
      continue;
    }

    references.push({
      from: input.file.path,
      relationship: 'loads',
      specifier: `${loaderReference.kind}:${loaderReference.path}`,
      to: resolvedPath,
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
      });
    }
  }

  return references;
}

function buildFileIndex(input: {
  fileReferences: ProjectAnalysisFileReference[];
  keyConfigs: Set<string>;
  loadedFiles: LoadedSourceFile[];
  scanState: ProjectAnalysisScanState;
}): ProjectAnalysisFileIndexEntry[] {
  const outgoingReferencesByPath = new Map<string, ProjectAnalysisFileReferenceTarget[]>();
  const incomingCountByPath = new Map<string, number>();
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
      const incomingCount = incomingCountByPath.get(path) ?? 0;
      const classification = classifyFile({
        keyConfigs: input.keyConfigs,
        language: loadedFile?.language ?? null,
        scanState: input.scanState,
        path,
      });
      const layer = classification.layer;
      const category = classification.category;

      return {
        category,
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
}): ProjectAnalysisDirectorySummary[] {
  const modulePaths = [...input.scanState.modules].map((path) => normalizeRelativePath(path));
  const directoryPaths =
    modulePaths.length > 0
      ? modulePaths
      : [...input.scanState.directories].map((path) => normalizeRelativePath(path));

  return directoryPaths
    .map((path) => ({
      layer: inferLayerName({
        category: 'source',
        language: null,
        path,
      }),
      path,
      role: describeDirectoryRole(input.fileIndex.filter((entry) => entry.path.startsWith(`${path}/`))),
    }))
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

function resolveModuleSpecifier(input: {
  aliasConfig: PathAliasConfig;
  allFilePaths: Set<string>;
  fromPath: string;
  specifier: string;
}): string | null {
  if (input.specifier.startsWith('.')) {
    return resolveProjectFilePath({
      allFilePaths: input.allFilePaths,
      basePath: normalizeRelativePath(join(dirname(input.fromPath), input.specifier)),
    });
  }

  for (const aliasCandidate of resolveAliasCandidates(input.aliasConfig, input.specifier)) {
    const resolvedPath = resolveProjectFilePath({
      allFilePaths: input.allFilePaths,
      basePath: aliasCandidate,
    });
    if (resolvedPath) {
      return resolvedPath;
    }
  }

  if (input.specifier.startsWith('/')) {
    return resolveProjectFilePath({
      allFilePaths: input.allFilePaths,
      basePath: normalizeRelativePath(input.specifier.slice(1)),
    });
  }

  if (input.specifier.startsWith('src/')) {
    return resolveProjectFilePath({
      allFilePaths: input.allFilePaths,
      basePath: normalizeRelativePath(input.specifier),
    });
  }

  return null;
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

      resolvedCandidates.push(
        normalizeRelativePath(join(aliasConfig.baseUrl, replacedPath)).replace(/^\.\/+/u, ''),
      );
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

  for (const candidatePath of candidatePaths) {
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

  for (const candidatePath of candidatePaths) {
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

async function readPathAliasConfig(rootPath: string): Promise<PathAliasConfig> {
  const configFileNames = ['tsconfig.json', 'jsconfig.json'];

  for (const fileName of configFileNames) {
    try {
      const filePath = join(rootPath, fileName);
      const text = await readFile(filePath, 'utf8');
      const parsed = ts.parseConfigFileTextToJson(filePath, text);
      const rawConfig: unknown = parsed.config;
      if (parsed.error || !rawConfig || typeof rawConfig !== 'object') {
        continue;
      }

      const config = rawConfig as Record<string, unknown>;
      const compilerOptions =
        'compilerOptions' in config &&
        config.compilerOptions &&
        typeof config.compilerOptions === 'object'
          ? (config.compilerOptions as Record<string, unknown>)
          : {};
      const baseUrl =
        typeof compilerOptions.baseUrl === 'string' && compilerOptions.baseUrl.length > 0
          ? normalizeRelativePath(compilerOptions.baseUrl)
          : '.';
      const rawPaths =
        compilerOptions.paths && typeof compilerOptions.paths === 'object'
          ? (compilerOptions.paths as Record<string, unknown>)
          : {};

      return {
        baseUrl,
        rules: Object.entries(rawPaths)
          .flatMap(([key, value]) => {
            if (!Array.isArray(value)) {
              return [];
            }

            const matcher = createAliasMatcher(key);
            if (!matcher) {
              return [];
            }

            const replacements = value
              .filter((item): item is string => typeof item === 'string')
              .map((item) => createAliasReplacementRule(item))
              .filter((item): item is AliasReplacementRule => item !== null);
            if (replacements.length === 0) {
              return [];
            }

            return [
              {
                matcher,
                replacements,
              } satisfies PathAliasRule,
            ];
          })
          .sort((left, right) => right.matcher.prefix.length - left.matcher.prefix.length),
      };
    } catch {
      continue;
    }
  }

  return {
    baseUrl: '.',
    rules: [],
  };
}

function createAliasMatcher(pattern: string): AliasMatcher | null {
  const wildcardIndex = pattern.indexOf('*');
  if (wildcardIndex < 0) {
    return {
      prefix: pattern,
      suffix: '',
      wildcard: false,
    };
  }

  if (pattern.indexOf('*', wildcardIndex + 1) >= 0) {
    return null;
  }

  return {
    prefix: pattern.slice(0, wildcardIndex),
    suffix: pattern.slice(wildcardIndex + 1),
    wildcard: true,
  };
}

function createAliasReplacementRule(pattern: string): AliasReplacementRule | null {
  const wildcardIndex = pattern.indexOf('*');
  if (wildcardIndex < 0) {
    return {
      prefix: pattern,
      suffix: '',
      wildcard: false,
    };
  }

  if (pattern.indexOf('*', wildcardIndex + 1) >= 0) {
    return null;
  }

  return {
    prefix: pattern.slice(0, wildcardIndex),
    suffix: pattern.slice(wildcardIndex + 1),
    wildcard: true,
  };
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
}): void {
  const resolvedPath = resolvePhpTypeReference({
    importAliases: input.importAliases,
    namespaceName: input.file.namespaceName,
    namespaceSymbolIndex: input.namespaceSymbolIndex,
    typeCandidate: input.typeCandidate,
  });
  if (!resolvedPath || resolvedPath === input.file.path) {
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
}): string | null {
  if (input.includeReference.rootConstant) {
    const basePath = join(
      PHP_PATH_CONSTANT_BASE_PATHS[input.includeReference.rootConstant],
      input.includeReference.path,
    );
    return resolveProjectFilePathCaseInsensitive({
      allFilePaths: input.allFilePaths,
      basePath,
      caseInsensitiveFilePathIndex: input.caseInsensitiveFilePathIndex,
    });
  }

  return resolveModuleSpecifier({
    aliasConfig: {
      baseUrl: '.',
      rules: [],
    },
    allFilePaths: input.allFilePaths,
    fromPath: input.fromPath,
    specifier: input.includeReference.path,
  });
}

function resolvePhpFrameworkLoadReference(input: {
  allFilePaths: Set<string>;
  caseInsensitiveFilePathIndex: Map<string, string>;
  loaderReference: PhpFrameworkLoadReference;
}): string | null {
  const basePaths = resolvePhpFrameworkLoadBasePaths(input.loaderReference);

  for (const basePath of basePaths) {
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
  const subjectLayer = inferLayerName({
    category: subjectCategory,
    language: input.language,
    path,
  });
  const subjectRole = inferFileRole({
    category: subjectCategory,
    language: input.language,
    layer: subjectLayer,
    path,
  });

  if (!isTestFile) {
    return {
      category: subjectCategory,
      layer: subjectLayer,
      role: subjectRole,
    };
  }

  return {
    category: 'test',
    layer: inferTestLayerName(path, input.language),
    role: inferTestRole(path, subjectCategory),
  };
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

function resolveAreaContext(path: string): { areaName: string; scopeStartIndex: number } | null {
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
    };
  }

  if (firstSegment.includes('.')) {
    return {
      areaName: 'entrypoint',
      scopeStartIndex: 1,
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
    };
  }

  return {
    areaName: normalizeAreaName(firstSegment),
    scopeStartIndex: 1,
  };
}

function resolvePhpApplicationAreaContext(
  segments: string[],
  path: string,
): { areaName: string; scopeStartIndex: number } | null {
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
    };
  }

  switch (structuralSegment) {
    case 'config':
    case 'configs':
      return {
        areaName: 'config',
        scopeStartIndex: 2,
      };
    case 'controller':
    case 'controllers': {
      const controllerSubArea = segments[2]?.toLowerCase();
      if (controllerSubArea === 'api') {
        return {
          areaName: 'api',
          scopeStartIndex: 3,
        };
      }

      return {
        areaName: 'controller',
        scopeStartIndex: 2,
      };
    }
    case 'core':
      return {
        areaName: 'core',
        scopeStartIndex: 2,
      };
    case 'domain':
    case 'domains':
      return {
        areaName: 'domain',
        scopeStartIndex: 2,
      };
    case 'helper':
    case 'helpers':
      return {
        areaName: 'util',
        scopeStartIndex: 2,
      };
    case 'libraries':
    case 'library':
      return {
        areaName: 'library',
        scopeStartIndex: 2,
      };
    case 'model':
    case 'models':
      return {
        areaName: 'model',
        scopeStartIndex: 2,
      };
    case 'service':
    case 'services':
      return {
        areaName: 'service',
        scopeStartIndex: 2,
      };
    default:
      return {
        areaName: 'application',
        scopeStartIndex: 1,
      };
  }
}

function resolveSourceRelativeSegments(path: string): string[] {
  const normalizedSegments = resolveNormalizedPathSegments(path);
  if (normalizedSegments[0] === 'src') {
    return normalizedSegments.slice(1);
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
  const sourceSegments = resolveSourceRelativeSegments(input.path);
  if (sourceSegments.length <= 1) {
    return [];
  }

  if (input.areaName === 'entrypoint' || input.areaName === 'test') {
    return [];
  }

  const areaContext = resolveAreaContext(input.path);
  const scopeStartIndex = areaContext?.scopeStartIndex ?? 1;
  const directorySegments = sourceSegments.slice(scopeStartIndex, -1);
  const featureScopeSegments: string[] = [];
  const shouldSkipLeadingStructuralSegments =
    input.areaName === 'application' && scopeStartIndex <= 1;
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
