import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

import { pathExists } from '@/infrastructure/sdd/fs-project-storage-io';

interface ProjectAnalysisBackup {
  backupAnalysisDirectoryPath: string | null;
  backupRootPath: string | null;
  hadExistingAnalysisDirectory: boolean;
}

export type { ProjectAnalysisBackup };

export async function createProjectAnalysisBackup(input: {
  analysisDirectoryPath: string;
}): Promise<Result<ProjectAnalysisBackup>> {
  const hadExistingAnalysisDirectory = await pathExists(input.analysisDirectoryPath);
  if (!hadExistingAnalysisDirectory) {
    return ok({
      backupAnalysisDirectoryPath: null,
      backupRootPath: null,
      hadExistingAnalysisDirectory: false,
    });
  }

  const backupRootPath = await mkdtemp(join(tmpdir(), 'sdd-analysis-backup-'));
  const backupAnalysisDirectoryPath = join(backupRootPath, 'analysis');

  try {
    await cp(input.analysisDirectoryPath, backupAnalysisDirectoryPath, {
      force: true,
      recursive: true,
    });
    await rm(input.analysisDirectoryPath, { force: true, recursive: true });

    return ok({
      backupAnalysisDirectoryPath,
      backupRootPath,
      hadExistingAnalysisDirectory: true,
    });
  } catch (error) {
    await rm(backupRootPath, { force: true, recursive: true });

    return err(
      createProjectError(
        'INVALID_PROJECT_STORAGE',
        '기존 분석 파일을 백업하지 못했습니다.',
        describeUnknownError(error),
      ),
    );
  }
}

export async function restoreProjectAnalysisBackup(input: {
  analysisBackup: ProjectAnalysisBackup;
  analysisDirectoryPath: string;
}): Promise<Result<void>> {
  try {
    await rm(input.analysisDirectoryPath, { force: true, recursive: true });

    if (
      input.analysisBackup.hadExistingAnalysisDirectory &&
      input.analysisBackup.backupAnalysisDirectoryPath
    ) {
      await cp(input.analysisBackup.backupAnalysisDirectoryPath, input.analysisDirectoryPath, {
        force: true,
        recursive: true,
      });
    }

    return ok(undefined);
  } catch (error) {
    return err(
      createProjectError(
        'INVALID_PROJECT_STORAGE',
        '기존 분석 백업을 복구하지 못했습니다.',
        describeUnknownError(error),
      ),
    );
  }
}

export async function cleanupProjectAnalysisBackup(backup: ProjectAnalysisBackup): Promise<void> {
  if (!backup.backupRootPath) {
    return;
  }

  try {
    await rm(backup.backupRootPath, { force: true, recursive: true });
  } catch {
    return;
  }
}

export function buildProjectAnalysisWriteFailureDetails(input: {
  backupPath: string | null;
  error: unknown;
  restoreError: string;
}): string {
  const details = [
    `write=${describeUnknownError(input.error)}`,
    `restore=${input.restoreError}`,
    input.backupPath ? `backup=${input.backupPath}` : null,
  ].filter((value): value is string => value !== null);

  return details.join('\n');
}

function describeUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
