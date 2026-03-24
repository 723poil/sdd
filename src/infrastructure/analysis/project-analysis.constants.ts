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
  'node_modules',
  'out',
  'target',
]);

export const MODULE_ROOT_DIRECTORIES = new Set([
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

export const KEY_CONFIG_MATCHERS = [
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

export const MAX_SCAN_DEPTH = 4;
export const MAX_DIRECTORY_COUNT = 160;
export const MAX_FILE_COUNT = 420;
