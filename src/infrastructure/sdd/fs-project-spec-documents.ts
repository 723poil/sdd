import { readdir } from 'node:fs/promises';

import {
  isProjectSpecMeta,
  toProjectSpecSummary,
  type ProjectSpecDocument,
  type ProjectSpecMeta,
} from '@/domain/project/project-spec-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

import {
  getProjectStoragePaths,
  getSpecMetaPath,
  getSpecVersionPath,
} from '@/infrastructure/sdd/fs-project-storage-paths';
import {
  pathExists,
  readJsonFile,
  readTextFile,
} from '@/infrastructure/sdd/fs-project-storage-io';

export async function readProjectSpecDocuments(input: {
  rootPath: string;
}): Promise<Result<ProjectSpecDocument[]>> {
  const { specsDirectoryPath } = getProjectStoragePaths(input.rootPath);
  if (!(await pathExists(specsDirectoryPath))) {
    return ok([]);
  }

  const specIds = await readSpecIds(specsDirectoryPath);
  const specs: ProjectSpecDocument[] = [];

  for (const specId of specIds) {
    const metaResult = await readSpecMetaDocument({
      rootPath: input.rootPath,
      specId,
    });
    if (!metaResult.ok) {
      return metaResult;
    }

    if (!metaResult.value) {
      continue;
    }

    const markdownPath = getSpecVersionPath({
      latestVersion: metaResult.value.latestVersion,
      rootPath: input.rootPath,
      specId,
    });
    const markdownResult = await readTextFile(
      markdownPath,
      '명세 본문 파일을 읽을 수 없습니다.',
    );
    if (!markdownResult.ok) {
      return err(markdownResult.error);
    }

    specs.push({
      meta: metaResult.value,
      markdown: markdownResult.value,
    });
  }

  return ok(
    specs.sort((left, right) => right.meta.updatedAt.localeCompare(left.meta.updatedAt)),
  );
}

export async function readSpecMetaDocument(input: {
  rootPath: string;
  specId: string;
}): Promise<Result<ProjectSpecMeta | null>> {
  const metaPath = getSpecMetaPath(input.rootPath, input.specId);
  if (!(await pathExists(metaPath))) {
    return ok(null);
  }

  const parsedResult = await readJsonFile(metaPath, '명세 메타 파일을 읽거나 파싱할 수 없습니다.');
  if (!parsedResult.ok) {
    return err(parsedResult.error);
  }

  if (!isProjectSpecMeta(parsedResult.value)) {
    return err(
      createProjectError(
        'INVALID_PROJECT_STORAGE',
        '명세 메타 파일이 현재 계약을 만족하지 않습니다.',
        metaPath,
      ),
    );
  }

  return ok(parsedResult.value);
}

export function toProjectSpecIndexEntries(specs: ProjectSpecDocument[]) {
  return specs.map((spec) => toProjectSpecSummary(spec.meta));
}

async function readSpecIds(specsDirectoryPath: string): Promise<string[]> {
  const entries = await readdir(specsDirectoryPath, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}
