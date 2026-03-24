import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { prepareDevMacApp } from './prepare-dev-mac-app.ts';

const scriptDirectoryPath = dirname(fileURLToPath(import.meta.url));
const projectRootPath = dirname(scriptDirectoryPath);
const electronViteCliPath = join(projectRootPath, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js');

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
