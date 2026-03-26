import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
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
