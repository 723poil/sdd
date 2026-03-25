import { dirname, relative, resolve } from 'node:path';

import ts from 'typescript';

export interface PathAliasRule {
  matcher: AliasMatcher;
  replacements: AliasReplacementRule[];
}

export interface AliasMatcher {
  prefix: string;
  suffix: string;
  wildcard: boolean;
}

export interface AliasReplacementRule {
  prefix: string;
  suffix: string;
  wildcard: boolean;
}

export interface PathAliasConfig {
  rules: PathAliasRule[];
}

export interface ProjectPathAliasResolver {
  getAliasConfigForFile(filePath: string): PathAliasConfig;
}

interface ProjectAnalysisScanStateLike {
  files: Set<string>;
}

interface ScopedPathAliasConfig {
  directoryPath: string;
  rules: PathAliasRule[];
}

const VITE_CONFIG_FILE_PATTERN = /^vite\.config\./u;
const VUE_CONFIG_FILE_PATTERN = /^vue\.config\.(?:[cm]?js|ts|mts|cts)$/u;
const TS_JS_CONFIG_FILE_PATTERN = /^(?:tsconfig(?:\.[\w-]+)?|jsconfig)\.json$/u;

export function createProjectPathAliasResolver(input: {
  rootPath: string;
  scanState: ProjectAnalysisScanStateLike;
}): ProjectPathAliasResolver {
  const scopedConfigs = collectScopedPathAliasConfigs(input);
  const cache = new Map<string, PathAliasConfig>();

  return {
    getAliasConfigForFile(filePath: string): PathAliasConfig {
      const normalizedFilePath = normalizeRelativePath(filePath);
      const cached = cache.get(normalizedFilePath);
      if (cached) {
        return cached;
      }

      const mergedRules = deduplicatePathAliasRules(
        scopedConfigs
          .filter((config) => isPathWithinDirectory(normalizedFilePath, config.directoryPath))
          .flatMap((config) => config.rules),
      ).sort(
        (left, right) =>
          right.matcher.prefix.length - left.matcher.prefix.length ||
          right.matcher.suffix.length - left.matcher.suffix.length,
      );
      const aliasConfig = {
        rules: mergedRules,
      } satisfies PathAliasConfig;
      cache.set(normalizedFilePath, aliasConfig);

      return aliasConfig;
    },
  };
}

function collectScopedPathAliasConfigs(input: {
  rootPath: string;
  scanState: ProjectAnalysisScanStateLike;
}): ScopedPathAliasConfig[] {
  const configFiles = [...input.scanState.files]
    .map((filePath) => normalizeRelativePath(filePath))
    .filter((filePath) => isAliasConfigFile(filePath));
  const configDirectoriesWithSourceRoot = new Set<string>();
  const scopedConfigs: ScopedPathAliasConfig[] = [];

  for (const configPath of configFiles) {
    const configDirectoryPath = normalizeRelativePath(dirname(configPath));
    if (hasDirectSourceRoot({
      configDirectoryPath,
      files: input.scanState.files,
    })) {
      configDirectoriesWithSourceRoot.add(configDirectoryPath);
    }

    const rules = readScopedPathAliasRules({
      configPath,
      rootPath: input.rootPath,
    });
    if (rules.length === 0) {
      continue;
    }

    scopedConfigs.push({
      directoryPath: configDirectoryPath,
      rules,
    });
  }

  for (const configDirectoryPath of configDirectoriesWithSourceRoot) {
    scopedConfigs.push({
      directoryPath: configDirectoryPath,
      rules: createFrontendSourceAliasRules({
        configDirectoryPath,
      }),
    });
  }

  return scopedConfigs.sort(
    (left, right) =>
      getPathDepth(right.directoryPath) - getPathDepth(left.directoryPath) ||
      left.directoryPath.localeCompare(right.directoryPath),
  );
}

function isAliasConfigFile(path: string): boolean {
  const fileName = path.split('/').pop() ?? path;
  return (
    TS_JS_CONFIG_FILE_PATTERN.test(fileName) ||
    VUE_CONFIG_FILE_PATTERN.test(fileName) ||
    VITE_CONFIG_FILE_PATTERN.test(fileName)
  );
}

function readScopedPathAliasRules(input: {
  configPath: string;
  rootPath: string;
}): PathAliasRule[] {
  const fileName = input.configPath.split('/').pop() ?? input.configPath;
  if (TS_JS_CONFIG_FILE_PATTERN.test(fileName)) {
    return readTsJsConfigPathAliasRules(input);
  }

  return readJavaScriptConfigPathAliasRules(input);
}

function readTsJsConfigPathAliasRules(input: {
  configPath: string;
  rootPath: string;
}): PathAliasRule[] {
  const absoluteConfigPath = resolve(input.rootPath, input.configPath);
  const parsedConfig = ts.getParsedCommandLineOfConfigFile(
    absoluteConfigPath,
    {},
    createTypeScriptConfigParseHost(),
  );

  if (!parsedConfig?.options.paths) {
    return [];
  }

  const baseDirectoryPath = parsedConfig.options.baseUrl ?? dirname(absoluteConfigPath);
  const rules = Object.entries(parsedConfig.options.paths)
    .flatMap(([pattern, replacements]) => {
      const matcher = createAliasMatcher(pattern);
      if (!matcher) {
        return [];
      }

      const normalizedReplacements = replacements
        .map((replacement) =>
          createNormalizedAliasReplacementRule({
            baseDirectoryPath,
            pattern: replacement,
            rootPath: input.rootPath,
          }),
        )
        .filter((replacement): replacement is AliasReplacementRule => replacement !== null);

      if (normalizedReplacements.length === 0) {
        return [];
      }

      return [
        {
          matcher,
          replacements: normalizedReplacements,
        } satisfies PathAliasRule,
      ];
    })
    .sort((left, right) => right.matcher.prefix.length - left.matcher.prefix.length);

  return deduplicatePathAliasRules(rules);
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

function readJavaScriptConfigPathAliasRules(input: {
  configPath: string;
  rootPath: string;
}): PathAliasRule[] {
  try {
    const configText = ts.sys.readFile(resolve(input.rootPath, input.configPath), 'utf8');
    if (typeof configText !== 'string' || configText.length === 0) {
      return [];
    }

    const configDirectoryPath = normalizeRelativePath(dirname(input.configPath));
    const variableBindings = readAliasVariableBindings({
      configDirectoryPath,
      configText,
      rootPath: input.rootPath,
    });
    const aliasBlock = extractObjectBlock({
      marker: 'alias',
      text: configText,
    });
    if (!aliasBlock) {
      return [];
    }

    return deduplicatePathAliasRules(
      [...aliasBlock.matchAll(/(['"])([^'"]+)\1\s*:\s*([^,\n\r]+)\s*,?/gu)].flatMap((match) => {
        const alias = match[2];
        const expression = match[3];
        if (!alias || !expression) {
          return [];
        }

        const resolvedTarget = resolvePathExpression({
          configDirectoryPath,
          expression,
          rootPath: input.rootPath,
          variableBindings,
        });
        if (!resolvedTarget) {
          return [];
        }

        return createPrefixAliasRules({
          alias,
          targetPath: resolvedTarget,
        });
      }),
    );
  } catch {
    return [];
  }
}

function readAliasVariableBindings(input: {
  configDirectoryPath: string;
  configText: string;
  rootPath: string;
}): Map<string, string> {
  const bindings = new Map<string, string>();

  for (const match of input.configText.matchAll(
    /^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*(.+?)\s*;$/gmu,
  )) {
    const bindingName = match[1];
    const expression = match[2];
    if (!bindingName || !expression) {
      continue;
    }

    const resolvedTarget = resolvePathExpression({
      configDirectoryPath: input.configDirectoryPath,
      expression,
      rootPath: input.rootPath,
      variableBindings: bindings,
    });
    if (!resolvedTarget) {
      continue;
    }

    bindings.set(bindingName, resolvedTarget);
  }

  return bindings;
}

function resolvePathExpression(input: {
  configDirectoryPath: string;
  expression: string;
  rootPath: string;
  variableBindings: Map<string, string>;
}): string | null {
  const trimmedExpression = input.expression.trim();
  if (trimmedExpression.length === 0) {
    return null;
  }

  const boundValue = input.variableBindings.get(trimmedExpression);
  if (boundValue) {
    return boundValue;
  }

  const stringLiteral = readStringLiteral(trimmedExpression);
  if (stringLiteral !== null) {
    return normalizeRelativePath(
      relative(input.rootPath, resolve(input.rootPath, input.configDirectoryPath, stringLiteral)),
    );
  }

  const viteUrlMatch = trimmedExpression.match(
    /^fileURLToPath\s*\(\s*new\s+URL\(\s*(['"])(.*?)\1\s*,\s*import\.meta\.url\s*\)\s*\)$/u,
  );
  if (viteUrlMatch?.[2]) {
    return normalizeRelativePath(
      relative(input.rootPath, resolve(input.rootPath, input.configDirectoryPath, viteUrlMatch[2])),
    );
  }

  if (!trimmedExpression.startsWith('path.resolve(') || !trimmedExpression.endsWith(')')) {
    return null;
  }

  const argumentText = trimmedExpression.slice('path.resolve('.length, -1);
  const argumentsList = splitFunctionArguments(argumentText);
  if (argumentsList.length === 0) {
    return null;
  }

  const [baseArgument = '', ...restArguments] = argumentsList;
  const basePath = resolvePathExpressionBase({
    configDirectoryPath: input.configDirectoryPath,
    rootPath: input.rootPath,
    value: baseArgument,
    variableBindings: input.variableBindings,
  });
  if (!basePath) {
    return null;
  }

  const segments: string[] = [];
  for (const argument of restArguments) {
    const segment = readStringLiteral(argument) ?? input.variableBindings.get(argument.trim()) ?? null;
    if (segment === null) {
      return null;
    }

    segments.push(segment);
  }

  return normalizeRelativePath(relative(input.rootPath, resolve(input.rootPath, basePath, ...segments)));
}

function resolvePathExpressionBase(input: {
  configDirectoryPath: string;
  rootPath: string;
  value: string;
  variableBindings: Map<string, string>;
}): string | null {
  const normalizedValue = input.value.trim();
  if (normalizedValue === '__dirname') {
    return input.configDirectoryPath;
  }

  const stringLiteral = readStringLiteral(normalizedValue);
  if (stringLiteral !== null) {
    return normalizeRelativePath(
      relative(input.rootPath, resolve(input.rootPath, input.configDirectoryPath, stringLiteral)),
    );
  }

  return input.variableBindings.get(normalizedValue) ?? null;
}

function createFrontendSourceAliasRules(input: { configDirectoryPath: string }): PathAliasRule[] {
  const srcRoot = normalizeRelativePath(
    input.configDirectoryPath === '.' ? 'src' : `${input.configDirectoryPath}/src`,
  );

  return createPrefixAliasRules({
    alias: '@',
    targetPath: srcRoot,
  });
}

function createPrefixAliasRules(input: { alias: string; targetPath: string }): PathAliasRule[] {
  const normalizedTargetPath = normalizeRelativePath(input.targetPath).replace(/^\.\/+/u, '');
  return [
    {
      matcher: {
        prefix: input.alias,
        suffix: '',
        wildcard: false,
      },
      replacements: [
        {
          prefix: normalizedTargetPath,
          suffix: '',
          wildcard: false,
        },
      ],
    },
    {
      matcher: {
        prefix: `${input.alias}/`,
        suffix: '',
        wildcard: true,
      },
      replacements: [
        {
          prefix: `${normalizedTargetPath}/`,
          suffix: '',
          wildcard: true,
        },
      ],
    },
  ];
}

function createNormalizedAliasReplacementRule(input: {
  baseDirectoryPath: string;
  pattern: string;
  rootPath: string;
}): AliasReplacementRule | null {
  const replacement = createAliasReplacementRule(input.pattern);
  if (!replacement) {
    return null;
  }

  const hasTrailingSeparator = /[\\/]$/u.test(replacement.prefix);
  const absolutePrefixPath = resolve(input.baseDirectoryPath, replacement.prefix.length > 0 ? replacement.prefix : '.');
  const normalizedPrefix = normalizeRelativePath(relative(input.rootPath, absolutePrefixPath));

  return {
    prefix:
      replacement.prefix.length === 0
        ? ''
        : `${normalizedPrefix}${hasTrailingSeparator ? '/' : ''}`.replace(/^\.\/+/u, ''),
    suffix: replacement.suffix.replace(/\\/gu, '/'),
    wildcard: replacement.wildcard,
  };
}

function extractObjectBlock(input: { marker: string; text: string }): string | null {
  const markerIndex = input.text.indexOf(input.marker);
  if (markerIndex < 0) {
    return null;
  }

  const openingBraceIndex = input.text.indexOf('{', markerIndex);
  if (openingBraceIndex < 0) {
    return null;
  }

  let depth = 0;
  for (let index = openingBraceIndex; index < input.text.length; index += 1) {
    const character = input.text[index];
    if (character === '{') {
      depth += 1;
      continue;
    }

    if (character !== '}') {
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return input.text.slice(openingBraceIndex + 1, index);
    }
  }

  return null;
}

function splitFunctionArguments(value: string): string[] {
  const argumentsList: string[] = [];
  let current = '';
  let depth = 0;
  let stringQuote: '"' | "'" | null = null;

  for (const character of value) {
    if (stringQuote) {
      current += character;
      if (character === stringQuote) {
        stringQuote = null;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      stringQuote = character;
      current += character;
      continue;
    }

    if (character === '(') {
      depth += 1;
      current += character;
      continue;
    }

    if (character === ')') {
      depth = Math.max(0, depth - 1);
      current += character;
      continue;
    }

    if (character === ',' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        argumentsList.push(trimmed);
      }
      current = '';
      continue;
    }

    current += character;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) {
    argumentsList.push(trimmed);
  }

  return argumentsList;
}

function readStringLiteral(value: string): string | null {
  const match = value.trim().match(/^(['"])(.*?)\1$/u);
  return match?.[2] ?? null;
}

function hasDirectSourceRoot(input: {
  configDirectoryPath: string;
  files: Set<string>;
}): boolean {
  const sourceRootPrefix = input.configDirectoryPath === '.' ? 'src/' : `${input.configDirectoryPath}/src/`;

  for (const filePath of input.files) {
    const normalizedFilePath = normalizeRelativePath(filePath);
    if (normalizedFilePath.startsWith(sourceRootPrefix)) {
      return true;
    }
  }

  return false;
}

function isPathWithinDirectory(filePath: string, directoryPath: string): boolean {
  if (directoryPath === '.') {
    return true;
  }

  return filePath === directoryPath || filePath.startsWith(`${directoryPath}/`);
}

function deduplicatePathAliasRules(rules: PathAliasRule[]): PathAliasRule[] {
  const uniqueRules = new Map<string, PathAliasRule>();

  for (const rule of rules) {
    for (const replacement of rule.replacements) {
      const key = [
        rule.matcher.prefix,
        rule.matcher.suffix,
        String(rule.matcher.wildcard),
        replacement.prefix,
        replacement.suffix,
        String(replacement.wildcard),
      ].join('|');

      if (uniqueRules.has(key)) {
        continue;
      }

      uniqueRules.set(key, {
        matcher: rule.matcher,
        replacements: [replacement],
      });
    }
  }

  return [...uniqueRules.values()];
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

function getPathDepth(path: string): number {
  if (path === '.') {
    return 0;
  }

  return path.split('/').filter(Boolean).length;
}

function normalizeRelativePath(value: string): string {
  const normalizedPath = value.replace(/\\/gu, '/');
  if (normalizedPath === '.' || normalizedPath === './') {
    return '.';
  }

  return normalizedPath
    .replace(/^\.\/+/u, '')
    .replace(/\/+/gu, '/')
    .replace(/\/$/u, '');
}
