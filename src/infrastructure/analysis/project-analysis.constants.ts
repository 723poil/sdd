export const IGNORED_DIRECTORIES = new Set([
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
  'docs',
  'logs',
  'node_modules',
  'out',
  'specs',
  'target',
]);

export const MODULE_ROOT_DIRECTORIES = new Set([
  'app',
  'apps',
  'client',
  'libs',
  'main',
  'modules',
  'packages',
  'renderer',
  'server',
  'services',
  'src',
  'web',
]);

export const KEY_CONFIG_MATCHERS = [
  /^composer\.json$/u,
  /^jsconfig(?:\.[\w-]+)?\.json$/u,
  /^pom\.xml$/u,
  /^build\.gradle(?:\.kts)?$/u,
  /^settings\.gradle(?:\.kts)?$/u,
  /^gradle\.properties$/u,
  /^lerna\.json$/u,
  /^nest-cli\.json$/u,
  /^package\.json$/u,
  /^tsconfig(?:\.[\w-]+)?\.json$/u,
  /^vite\.config\./u,
  /^vitest\.config\./u,
  /^next\.config\./u,
  /^nuxt\.config\./u,
  /^vue\.config\./u,
  /^electron\.vite\.config\./u,
  /^eslint\.config\./u,
  /^prettier\.config\./u,
  /^tailwind\.config\./u,
  /^postcss\.config\./u,
  /^turbo\.json$/u,
  /^pnpm-workspace\.yaml$/u,
];

export const ENTRYPOINT_CANDIDATES = new Set([
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

export const LOCKFILE_TO_PACKAGE_MANAGER: Record<string, string> = {
  'bun.lock': 'bun',
  'bun.lockb': 'bun',
  'package-lock.json': 'npm',
  'pnpm-lock.yaml': 'pnpm',
  'yarn.lock': 'yarn',
};

export const MAX_SCAN_DEPTH = 16;
export const MAX_DIRECTORY_COUNT = 10000;
export const MAX_FILE_COUNT = 30000;
