import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';

const testsDirectoryPath = dirname(fileURLToPath(import.meta.url));
const projectRootPath = resolve(testsDirectoryPath, '..');
const sourceRootPath = resolve(projectRootPath, 'src');

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('@/')) {
      return nextResolve(specifier, context);
    }

    const relativePath = specifier.slice(2);
    const basePath = resolve(sourceRootPath, relativePath);
    const candidates = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.tsx`,
      resolve(basePath, 'index.ts'),
      resolve(basePath, 'index.tsx'),
    ];

    const matchedPath = candidates.find((candidatePath) => existsSync(candidatePath));
    if (!matchedPath) {
      return nextResolve(specifier, context);
    }

    return {
      shortCircuit: true,
      url: pathToFileURL(matchedPath).href,
    };
  },
});
