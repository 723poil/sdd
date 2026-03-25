import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { prepareDevMacApp } from './prepare-dev-mac-app.ts';

type PackageJsonWithBin = {
  bin?: string | Record<string, string>;
};

const require = createRequire(import.meta.url);
const scriptDirectoryPath = dirname(fileURLToPath(import.meta.url));
const projectRootPath = dirname(scriptDirectoryPath);

async function resolveElectronViteCliPath(): Promise<string> {
  let packageJsonPath: string;

  try {
    packageJsonPath = require.resolve('electron-vite/package.json');
  } catch (error) {
    throw new Error('electron-vite 패키지를 찾을 수 없습니다. 의존성 설치 상태를 확인해주세요.', {
      cause: error instanceof Error ? error : undefined,
    });
  }

  const packageJsonRaw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonRaw) as PackageJsonWithBin;
  const binEntry =
    typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.['electron-vite'];

  if (!binEntry) {
    throw new Error('electron-vite CLI 진입점을 확인할 수 없습니다.');
  }

  return join(dirname(packageJsonPath), binEntry);
}

async function resolveDevEnvironment(): Promise<NodeJS.ProcessEnv> {
  if (process.platform !== 'darwin') {
    return process.env;
  }

  const electronExecPath = await prepareDevMacApp();

  return {
    ...process.env,
    ELECTRON_EXEC_PATH: electronExecPath,
  };
}

async function run(): Promise<void> {
  const electronViteCliPath = await resolveElectronViteCliPath();
  const env = await resolveDevEnvironment();
  const child = spawn(process.execPath, [electronViteCliPath, 'dev', ...process.argv.slice(2)], {
    cwd: projectRootPath,
    env,
    stdio: 'inherit',
  });

  const forwardSignal = (signal: NodeJS.Signals): void => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => {
    forwardSignal('SIGINT');
  });

  process.on('SIGTERM', () => {
    forwardSignal('SIGTERM');
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
}

void run();
