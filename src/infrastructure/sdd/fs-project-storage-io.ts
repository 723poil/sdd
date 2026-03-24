import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';

import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

import { writeJsonAtomically, writeTextAtomically } from '@/infrastructure/fs/write-json-atomically';

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile(filePath: string, errorMessage: string): Promise<Result<unknown>> {
  try {
    return ok(JSON.parse(await readFile(filePath, 'utf8')) as unknown);
  } catch {
    return err(createProjectError('INVALID_PROJECT_STORAGE', errorMessage, filePath));
  }
}

export async function readTextFile(filePath: string, errorMessage: string): Promise<Result<string>> {
  try {
    return ok(await readFile(filePath, 'utf8'));
  } catch {
    return err(createProjectError('INVALID_PROJECT_STORAGE', errorMessage, filePath));
  }
}

export async function ensureJsonFile(filePath: string, value: unknown): Promise<void> {
  if (await pathExists(filePath)) {
    return;
  }

  await writeJsonAtomically(filePath, value);
}

export async function ensureTextFile(filePath: string, content: string): Promise<void> {
  if (await pathExists(filePath)) {
    return;
  }

  await writeTextAtomically(filePath, content);
}
