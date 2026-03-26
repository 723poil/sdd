import { readdir, stat } from 'node:fs/promises';

import {
  createProjectSpecDocument,
  createProjectSpecVersionDiff,
  extractProjectSpecSummary,
  extractProjectSpecTitle,
  isLegacyProjectSpecMeta,
  isPreviousProjectSpecMeta,
  isProjectSpecMeta,
  toProjectSpecSummary,
  type ProjectSpecDocument,
  type ProjectSpecMeta,
  type ProjectSpecVersionDiff,
  type ProjectSpecVersionDocument,
  type ProjectSpecVersionHistoryEntry,
} from '@/domain/project/project-spec-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

import {
  getProjectStoragePaths,
  getSpecMetaPath,
  getSpecVersionPath,
  getSpecVersionsDirectoryPath,
} from '@/infrastructure/sdd/fs-project-storage-paths';
import { pathExists, readJsonFile, readTextFile } from '@/infrastructure/sdd/fs-project-storage-io';

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

    specs.push(createProjectSpecDocument(metaResult.value));
  }

  return ok(specs.sort((left, right) => right.meta.updatedAt.localeCompare(left.meta.updatedAt)));
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

  if (isProjectSpecMeta(parsedResult.value)) {
    return ok(parsedResult.value);
  }

  if (isPreviousProjectSpecMeta(parsedResult.value)) {
    return ok({
      schemaVersion: 3,
      id: parsedResult.value.id,
      slug: parsedResult.value.slug,
      title: parsedResult.value.title,
      status: parsedResult.value.status,
      createdAt: parsedResult.value.createdAt,
      updatedAt: parsedResult.value.updatedAt,
      revision: parsedResult.value.revision,
      latestVersion: parsedResult.value.latestVersion,
      currentVersion: parsedResult.value.currentVersion,
      draftMarkdown: parsedResult.value.draftMarkdown,
      summary: parsedResult.value.summary,
      relations: [],
    });
  }

  if (isLegacyProjectSpecMeta(parsedResult.value)) {
    const legacyDraftResult = await readTextFile(
      getSpecVersionPath({
        rootPath: input.rootPath,
        specId: input.specId,
        versionId: parsedResult.value.latestVersion,
      }),
      '기존 명세 버전 파일을 읽을 수 없습니다.',
    );
    if (!legacyDraftResult.ok) {
      return err(legacyDraftResult.error);
    }

    return ok({
      schemaVersion: 3,
      id: parsedResult.value.id,
      slug: parsedResult.value.slug,
      title: parsedResult.value.title,
      status: parsedResult.value.status,
      createdAt: parsedResult.value.createdAt,
      updatedAt: parsedResult.value.updatedAt,
      revision: parsedResult.value.revision,
      latestVersion: parsedResult.value.latestVersion,
      currentVersion: parsedResult.value.latestVersion,
      draftMarkdown: legacyDraftResult.value,
      summary: parsedResult.value.summary,
      relations: [],
    });
  }

  return err(
    createProjectError(
      'INVALID_PROJECT_STORAGE',
      '명세 메타 파일이 현재 계약을 만족하지 않습니다.',
      metaPath,
    ),
  );
}

export async function readProjectSpecVersionHistory(input: {
  rootPath: string;
  specId: string;
}): Promise<Result<ProjectSpecVersionHistoryEntry[]>> {
  const metaResult = await readSpecMetaDocument(input);
  if (!metaResult.ok) {
    return metaResult;
  }

  if (!metaResult.value) {
    return err(
      createProjectError(
        'INVALID_PROJECT_STORAGE',
        '버전 이력을 읽을 명세를 찾지 못했습니다.',
        input.specId,
      ),
    );
  }

  const versionIdsResult = await readProjectSpecVersionIds(input);
  if (!versionIdsResult.ok) {
    return versionIdsResult;
  }

  const history: ProjectSpecVersionHistoryEntry[] = [];

  for (const versionId of versionIdsResult.value) {
    const versionResult = await readProjectSpecVersionDocumentWithMeta({
      ...input,
      meta: metaResult.value,
      versionId,
    });
    if (!versionResult.ok) {
      return versionResult;
    }

    history.push({
      versionId: versionResult.value.versionId,
      title: versionResult.value.title,
      createdAt: versionResult.value.createdAt,
      summary: versionResult.value.summary,
      isCurrent: versionResult.value.isCurrent,
      isLatest: versionResult.value.isLatest,
      canApply: !versionResult.value.isCurrent,
      canDelete:
        versionIdsResult.value.length > 1 &&
        !versionResult.value.isCurrent &&
        !versionResult.value.isLatest,
    });
  }

  return ok(history.sort((left, right) => compareVersionId(right.versionId, left.versionId)));
}

export async function readProjectSpecVersionDocument(input: {
  rootPath: string;
  specId: string;
  versionId: string;
}): Promise<Result<ProjectSpecVersionDocument>> {
  const metaResult = await readSpecMetaDocument({
    rootPath: input.rootPath,
    specId: input.specId,
  });
  if (!metaResult.ok) {
    return metaResult;
  }

  if (!metaResult.value) {
    return err(
      createProjectError(
        'INVALID_PROJECT_STORAGE',
        '버전을 읽을 명세를 찾지 못했습니다.',
        input.specId,
      ),
    );
  }

  return readProjectSpecVersionDocumentWithMeta({
    ...input,
    meta: metaResult.value,
  });
}

export async function readProjectSpecVersionDiffDocument(input: {
  currentMarkdown?: string | null;
  currentTitle?: string | null;
  rootPath: string;
  specId: string;
  versionId: string;
}): Promise<Result<ProjectSpecVersionDiff>> {
  const metaResult = await readSpecMetaDocument({
    rootPath: input.rootPath,
    specId: input.specId,
  });
  if (!metaResult.ok) {
    return metaResult;
  }

  if (!metaResult.value) {
    return err(
      createProjectError(
        'INVALID_PROJECT_STORAGE',
        '버전 비교를 위한 명세를 찾지 못했습니다.',
        input.specId,
      ),
    );
  }

  const versionResult = await readProjectSpecVersionDocumentWithMeta({
    rootPath: input.rootPath,
    specId: input.specId,
    versionId: input.versionId,
    meta: metaResult.value,
  });
  if (!versionResult.ok) {
    return versionResult;
  }

  return ok(
    createProjectSpecVersionDiff({
      currentMarkdown: input.currentMarkdown ?? metaResult.value.draftMarkdown,
      currentTitle: input.currentTitle ?? metaResult.value.title,
      currentVersionId: metaResult.value.currentVersion,
      version: versionResult.value,
    }),
  );
}

export function toProjectSpecIndexEntries(specs: ProjectSpecDocument[]) {
  return specs.map((spec) => toProjectSpecSummary(spec.meta));
}

export async function readProjectSpecVersionIds(input: {
  rootPath: string;
  specId: string;
}): Promise<Result<string[]>> {
  const versionsDirectoryPath = getSpecVersionsDirectoryPath(input.rootPath, input.specId);
  if (!(await pathExists(versionsDirectoryPath))) {
    return ok([]);
  }

  const entries = await readdir(versionsDirectoryPath, {
    withFileTypes: true,
  });

  return ok(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) => fileName.endsWith('.md'))
      .map((fileName) => fileName.slice(0, -3))
      .sort((left, right) => compareVersionId(left, right)),
  );
}

async function readProjectSpecVersionDocumentWithMeta(input: {
  meta: ProjectSpecMeta;
  rootPath: string;
  specId: string;
  versionId: string;
}): Promise<Result<ProjectSpecVersionDocument>> {
  const versionPath = getSpecVersionPath({
    rootPath: input.rootPath,
    specId: input.specId,
    versionId: input.versionId,
  });
  if (!(await pathExists(versionPath))) {
    return err(
      createProjectError(
        'INVALID_PROJECT_STORAGE',
        '요청한 명세 버전 파일을 찾지 못했습니다.',
        versionPath,
      ),
    );
  }

  const markdownResult = await readTextFile(versionPath, '명세 버전 파일을 읽을 수 없습니다.');
  if (!markdownResult.ok) {
    return markdownResult;
  }

  const fileStats = await stat(versionPath);
  const title = extractProjectSpecTitle(markdownResult.value) ?? input.meta.title;
  const summary = extractProjectSpecSummary(markdownResult.value);

  return ok({
    versionId: input.versionId,
    title,
    createdAt: fileStats.mtime.toISOString(),
    summary,
    markdown: markdownResult.value,
    isCurrent: input.meta.currentVersion === input.versionId,
    isLatest: input.meta.latestVersion === input.versionId,
  });
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

function compareVersionId(left: string, right: string): number {
  return parseVersionNumber(left) - parseVersionNumber(right);
}

function parseVersionNumber(value: string): number {
  const matched = /^v(\d+)$/u.exec(value.trim());
  if (!matched) {
    return -1;
  }

  const versionNumber = Number(matched[1]);
  return Number.isFinite(versionNumber) ? versionNumber : -1;
}
