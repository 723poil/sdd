import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';

import type { AgentCliId } from '@/domain/app-settings/agent-cli-connection-model';

const MACOS_COMMON_EXECUTABLE_DIRECTORIES = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
] as const;

export async function resolveAgentCliExecutablePath(input: {
  agentId?: AgentCliId;
  executablePath: string;
}): Promise<string | null> {
  const normalizedExecutablePath = normalizeExecutablePath(input.executablePath);
  if (!normalizedExecutablePath) {
    return null;
  }

  if (isExplicitExecutablePath(normalizedExecutablePath)) {
    return (await isExecutableFile(normalizedExecutablePath)) ? normalizedExecutablePath : null;
  }

  const executableFromPath = await resolveExecutableFromPathDirectories(
    normalizedExecutablePath,
    process.env.PATH,
  );
  if (executableFromPath) {
    return executableFromPath;
  }

  for (const candidatePath of listPlatformExecutableFallbackPaths({
    agentId: input.agentId,
    executableName: normalizedExecutablePath,
  })) {
    if (await isExecutableFile(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function normalizeExecutablePath(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed === '~') {
    return homedir();
  }

  if (trimmed.startsWith('~/')) {
    return join(homedir(), trimmed.slice(2));
  }

  return trimmed;
}

function isExplicitExecutablePath(value: string): boolean {
  return isAbsolute(value) || value.includes('/');
}

async function resolveExecutableFromPathDirectories(
  executableName: string,
  rawPathValue: string | undefined,
): Promise<string | null> {
  const pathDirectories = rawPathValue
    ?.split(delimiter)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (!pathDirectories || pathDirectories.length === 0) {
    return null;
  }

  for (const directoryPath of pathDirectories) {
    const candidatePath = join(directoryPath, executableName);
    if (await isExecutableFile(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function listPlatformExecutableFallbackPaths(input: {
  agentId: AgentCliId | undefined;
  executableName: string;
}): string[] {
  const fallbackPaths = new Set<string>();

  if (process.platform === 'darwin') {
    for (const directoryPath of MACOS_COMMON_EXECUTABLE_DIRECTORIES) {
      fallbackPaths.add(join(directoryPath, input.executableName));
    }

    if (input.agentId === 'codex' || input.executableName === 'codex') {
      fallbackPaths.add('/Applications/Codex.app/Contents/Resources/codex');
      fallbackPaths.add(
        join(homedir(), 'Applications', 'Codex.app', 'Contents', 'Resources', 'codex'),
      );
    }
  }

  return [...fallbackPaths];
}

async function isExecutableFile(candidatePath: string): Promise<boolean> {
  try {
    const candidateStats = await stat(candidatePath);
    if (!candidateStats.isFile()) {
      return false;
    }

    await access(candidatePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
