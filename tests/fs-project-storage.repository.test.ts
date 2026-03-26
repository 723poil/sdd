import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createFsProjectStorageRepository } from '@/infrastructure/sdd/fs-project-storage.repository';
import {
  getProjectStoragePaths,
  getSpecMetaPath,
  getSpecVersionPath,
  getSpecVersionsDirectoryPath,
} from '@/infrastructure/sdd/fs-project-storage-paths';

void test('repository keeps a versionless draft until first real save and manages history actions', async () => {
  const rootPath = await mkdtemp(join(tmpdir(), 'sdd-spec-storage-'));
  const repository = createFsProjectStorageRepository();

  try {
    const initializationResult = await repository.initializeStorage({ rootPath });
    assert.equal(initializationResult.ok, true);

    const createResult = await repository.createProjectSpec({ rootPath });
    assert.equal(createResult.ok, true);
    if (!createResult.ok) {
      return;
    }

    const createdSpec = createResult.value.spec;
    assert.equal(createdSpec.meta.latestVersion, null);
    assert.equal(createdSpec.meta.currentVersion, null);

    const metaFile = JSON.parse(
      await readFile(getSpecMetaPath(rootPath, createdSpec.meta.id), 'utf8'),
    ) as { draftMarkdown: string };
    assert.equal(metaFile.draftMarkdown, createdSpec.markdown);

    const versionsDirectoryPath = getSpecVersionsDirectoryPath(rootPath, createdSpec.meta.id);
    const hasVersionsDirectory = await readdir(getProjectStoragePaths(rootPath).specsDirectoryPath);
    assert.ok(hasVersionsDirectory.includes(createdSpec.meta.id));
    await assert.rejects(readdir(versionsDirectoryPath));

    const firstSaveResult = await repository.saveProjectSpec({
      rootPath,
      specId: createdSpec.meta.id,
      revision: createdSpec.meta.revision,
      title: createdSpec.meta.title,
      markdown: `${createdSpec.markdown}\n\n- 첫 저장 내용`,
    });
    assert.equal(firstSaveResult.ok, true);
    if (!firstSaveResult.ok) {
      return;
    }

    assert.equal(firstSaveResult.value.kind, 'saved');
    if (firstSaveResult.value.kind !== 'saved') {
      return;
    }

    assert.equal(firstSaveResult.value.versionId, 'v1');
    assert.equal(firstSaveResult.value.spec.meta.latestVersion, 'v1');
    assert.equal(firstSaveResult.value.spec.meta.currentVersion, 'v1');

    const noOpSaveResult = await repository.saveProjectSpec({
      rootPath,
      specId: createdSpec.meta.id,
      revision: firstSaveResult.value.spec.meta.revision,
      title: `  ${firstSaveResult.value.spec.meta.title}  `,
      markdown: firstSaveResult.value.spec.markdown.replaceAll('\n', '\r\n'),
    });
    assert.equal(noOpSaveResult.ok, true);
    if (!noOpSaveResult.ok) {
      return;
    }

    assert.equal(noOpSaveResult.value.kind, 'no-op');

    const secondSaveResult = await repository.saveProjectSpec({
      rootPath,
      specId: createdSpec.meta.id,
      revision: firstSaveResult.value.spec.meta.revision,
      title: firstSaveResult.value.spec.meta.title,
      markdown: `${firstSaveResult.value.spec.markdown}\n- 두 번째 저장 내용`,
    });
    assert.equal(secondSaveResult.ok, true);
    if (!secondSaveResult.ok || secondSaveResult.value.kind !== 'saved') {
      return;
    }

    assert.equal(secondSaveResult.value.versionId, 'v2');

    const applyResult = await repository.applyProjectSpecVersion({
      rootPath,
      specId: createdSpec.meta.id,
      revision: secondSaveResult.value.spec.meta.revision,
      versionId: 'v1',
    });
    assert.equal(applyResult.ok, true);
    if (!applyResult.ok || applyResult.value.kind !== 'applied') {
      return;
    }

    assert.equal(applyResult.value.spec.meta.currentVersion, 'v1');
    assert.equal(applyResult.value.spec.meta.latestVersion, 'v2');

    const thirdSaveResult = await repository.saveProjectSpec({
      rootPath,
      specId: createdSpec.meta.id,
      revision: applyResult.value.spec.meta.revision,
      title: applyResult.value.spec.meta.title,
      markdown: `${applyResult.value.spec.markdown}\n- 세 번째 저장 내용`,
    });
    assert.equal(thirdSaveResult.ok, true);
    if (!thirdSaveResult.ok || thirdSaveResult.value.kind !== 'saved') {
      return;
    }

    assert.equal(thirdSaveResult.value.versionId, 'v3');

    const deleteResult = await repository.deleteProjectSpecVersion({
      rootPath,
      specId: createdSpec.meta.id,
      revision: thirdSaveResult.value.spec.meta.revision,
      versionId: 'v1',
    });
    assert.equal(deleteResult.ok, true);
    if (!deleteResult.ok || deleteResult.value.kind !== 'deleted') {
      return;
    }

    assert.deepEqual(
      deleteResult.value.history.map((entry) => entry.versionId),
      ['v3', 'v2'],
    );

    const remainingVersionFileNames = await readdir(
      getSpecVersionsDirectoryPath(rootPath, createdSpec.meta.id),
    );
    assert.deepEqual(remainingVersionFileNames.sort(), ['v2.md', 'v3.md']);

    const latestVersionContents = await readFile(
      getSpecVersionPath({
        rootPath,
        specId: createdSpec.meta.id,
        versionId: 'v3',
      }),
      'utf8',
    );
    assert.match(latestVersionContents, /세 번째 저장 내용/u);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

void test('repository updates spec metadata without creating versions and persists archived relations', async () => {
  const rootPath = await mkdtemp(join(tmpdir(), 'sdd-spec-meta-'));
  const repository = createFsProjectStorageRepository();

  try {
    const initializationResult = await repository.initializeStorage({ rootPath });
    assert.equal(initializationResult.ok, true);

    const baseSpecResult = await repository.createProjectSpec({ rootPath, title: '기준 명세' });
    assert.equal(baseSpecResult.ok, true);
    if (!baseSpecResult.ok) {
      return;
    }

    const derivedSpecResult = await repository.createProjectSpec({ rootPath, title: '후속 명세' });
    assert.equal(derivedSpecResult.ok, true);
    if (!derivedSpecResult.ok) {
      return;
    }

    const metadataUpdateResult = await repository.updateProjectSpecMeta({
      rootPath,
      specId: derivedSpecResult.value.spec.meta.id,
      revision: derivedSpecResult.value.spec.meta.revision,
      status: 'archived',
      relations: [
        {
          targetSpecId: baseSpecResult.value.spec.meta.id,
          type: 'derived-from',
          createdAt: '2026-03-26T00:10:00.000Z',
        },
      ],
    });
    assert.equal(metadataUpdateResult.ok, true);
    if (!metadataUpdateResult.ok || metadataUpdateResult.value.kind !== 'updated') {
      return;
    }

    assert.equal(metadataUpdateResult.value.spec.meta.status, 'archived');
    assert.equal(metadataUpdateResult.value.spec.meta.latestVersion, null);
    assert.equal(metadataUpdateResult.value.spec.meta.currentVersion, null);
    assert.deepEqual(metadataUpdateResult.value.spec.meta.relations, [
      {
        targetSpecId: baseSpecResult.value.spec.meta.id,
        type: 'derived-from',
        createdAt: '2026-03-26T00:10:00.000Z',
      },
    ]);

    await assert.rejects(
      readdir(getSpecVersionsDirectoryPath(rootPath, derivedSpecResult.value.spec.meta.id)),
    );

    const persistedMeta = JSON.parse(
      await readFile(getSpecMetaPath(rootPath, derivedSpecResult.value.spec.meta.id), 'utf8'),
    ) as { relations: unknown; status: string };
    assert.equal(persistedMeta.status, 'archived');
    assert.deepEqual(persistedMeta.relations, metadataUpdateResult.value.spec.meta.relations);

    const specsIndex = JSON.parse(
      await readFile(getProjectStoragePaths(rootPath).specsIndexPath, 'utf8'),
    ) as {
      specs: Array<{
        id: string;
        status: string;
      }>;
    };
    assert.equal(
      specsIndex.specs.find((spec) => spec.id === derivedSpecResult.value.spec.meta.id)?.status,
      'archived',
    );

    const duplicateRelationResult = await repository.updateProjectSpecMeta({
      rootPath,
      specId: derivedSpecResult.value.spec.meta.id,
      revision: metadataUpdateResult.value.spec.meta.revision,
      status: 'archived',
      relations: [
        {
          targetSpecId: baseSpecResult.value.spec.meta.id,
          type: 'derived-from',
          createdAt: '2026-03-26T00:10:00.000Z',
        },
        {
          targetSpecId: baseSpecResult.value.spec.meta.id,
          type: 'derived-from',
          createdAt: '2026-03-26T00:11:00.000Z',
        },
      ],
    });
    assert.equal(duplicateRelationResult.ok, false);
    if (!duplicateRelationResult.ok) {
      assert.equal(duplicateRelationResult.error.code, 'INVALID_PROJECT_SPEC_METADATA');
    }

    const selfRelationResult = await repository.updateProjectSpecMeta({
      rootPath,
      specId: derivedSpecResult.value.spec.meta.id,
      revision: metadataUpdateResult.value.spec.meta.revision,
      status: 'archived',
      relations: [
        {
          targetSpecId: derivedSpecResult.value.spec.meta.id,
          type: 'follow-up-to',
          createdAt: '2026-03-26T00:12:00.000Z',
        },
      ],
    });
    assert.equal(selfRelationResult.ok, false);
    if (!selfRelationResult.ok) {
      assert.equal(selfRelationResult.error.code, 'INVALID_PROJECT_SPEC_METADATA');
    }
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

void test('repository reads schemaVersion 2 spec meta and falls back to empty relations', async () => {
  const rootPath = await mkdtemp(join(tmpdir(), 'sdd-spec-meta-legacy-'));
  const repository = createFsProjectStorageRepository();

  try {
    const initializationResult = await repository.initializeStorage({ rootPath });
    assert.equal(initializationResult.ok, true);

    const createResult = await repository.createProjectSpec({ rootPath, title: '레거시 명세' });
    assert.equal(createResult.ok, true);
    if (!createResult.ok) {
      return;
    }

    const metaPath = getSpecMetaPath(rootPath, createResult.value.spec.meta.id);
    const currentMeta = JSON.parse(await readFile(metaPath, 'utf8')) as Record<string, unknown>;
    const legacyMeta = Object.fromEntries(
      Object.entries(currentMeta).filter(([key]) => key !== 'relations'),
    );

    await writeFile(
      metaPath,
      `${JSON.stringify(
        {
          ...legacyMeta,
          schemaVersion: 2,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const readSpecsResult = await repository.readProjectSpecs({ rootPath });
    assert.equal(readSpecsResult.ok, true);
    if (!readSpecsResult.ok) {
      return;
    }

    const legacySpec =
      readSpecsResult.value.find((spec) => spec.meta.id === createResult.value.spec.meta.id) ??
      null;
    assert.ok(legacySpec);
    assert.deepEqual(legacySpec?.meta.relations, []);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});
