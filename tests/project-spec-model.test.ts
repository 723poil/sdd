import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProjectSpecMeta,
  createNextProjectSpecVersionId,
  isProjectSpecMeta,
  normalizeProjectSpecDraft,
  validateProjectSpecMetadataUpdate,
} from '@/domain/project/project-spec-model';

void test('createNextProjectSpecVersionId starts at v1 and increments saved versions', () => {
  assert.equal(createNextProjectSpecVersionId(null), 'v1');
  assert.equal(createNextProjectSpecVersionId('v1'), 'v2');
  assert.equal(createNextProjectSpecVersionId('v9'), 'v10');
});

void test('normalizeProjectSpecDraft treats title and line-ending normalization as no-op content', () => {
  const current = normalizeProjectSpecDraft({
    title: '명세 제목',
    markdown: '# 명세 제목\n\n- 현재 내용\n',
  });
  const next = normalizeProjectSpecDraft({
    title: '  명세 제목  ',
    markdown: '# 다른 제목\r\n\r\n- 현재 내용\r\n',
  });

  assert.equal(current.title, next.title);
  assert.equal(current.markdown, next.markdown);
});

void test('isProjectSpecMeta accepts versionless persisted drafts', () => {
  assert.equal(
    isProjectSpecMeta({
      schemaVersion: 3,
      id: 'spec-01',
      slug: 'spec-01',
      title: '새 명세 01',
      status: 'draft',
      createdAt: '2026-03-26T00:00:00.000Z',
      updatedAt: '2026-03-26T00:00:00.000Z',
      revision: 1,
      latestVersion: null,
      currentVersion: null,
      draftMarkdown: '# 새 명세 01',
      summary: '초안',
      relations: [],
    }),
    true,
  );
});

void test('validateProjectSpecMetadataUpdate accepts draft to archived transition with unique relations', () => {
  const current = createProjectSpecMeta({
    id: 'spec-02',
    slug: 'spec-02',
    title: '새 명세 02',
    now: '2026-03-26T00:00:00.000Z',
    draftMarkdown: '# 새 명세 02',
    summary: '초안',
  });

  const result = validateProjectSpecMetadataUpdate({
    current,
    status: 'archived',
    relations: [
      {
        targetSpecId: 'spec-01',
        type: 'derived-from',
        createdAt: '2026-03-26T00:05:00.000Z',
      },
      {
        targetSpecId: 'spec-03',
        type: 'follow-up-to',
        createdAt: '2026-03-26T00:06:00.000Z',
      },
    ],
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.status, 'archived');
  assert.deepEqual(result.value.relations, [
    {
      targetSpecId: 'spec-01',
      type: 'derived-from',
      createdAt: '2026-03-26T00:05:00.000Z',
    },
    {
      targetSpecId: 'spec-03',
      type: 'follow-up-to',
      createdAt: '2026-03-26T00:06:00.000Z',
    },
  ]);
});

void test('validateProjectSpecMetadataUpdate rejects unsupported status transitions and invalid relations', () => {
  const approvedSpec = {
    ...createProjectSpecMeta({
      id: 'spec-02',
      slug: 'spec-02',
      title: '새 명세 02',
      now: '2026-03-26T00:00:00.000Z',
      draftMarkdown: '# 새 명세 02',
      summary: '초안',
    }),
    status: 'approved' as const,
  };

  const invalidStatusResult = validateProjectSpecMetadataUpdate({
    current: approvedSpec,
    status: 'archived',
    relations: [],
  });
  assert.equal(invalidStatusResult.ok, false);
  if (!invalidStatusResult.ok) {
    assert.equal(invalidStatusResult.error.code, 'INVALID_PROJECT_SPEC_METADATA');
  }

  const duplicateRelationResult = validateProjectSpecMetadataUpdate({
    current: approvedSpec,
    status: 'approved',
    relations: [
      {
        targetSpecId: 'spec-01',
        type: 'derived-from',
        createdAt: '2026-03-26T00:05:00.000Z',
      },
      {
        targetSpecId: 'spec-01',
        type: 'derived-from',
        createdAt: '2026-03-26T00:06:00.000Z',
      },
    ],
  });
  assert.equal(duplicateRelationResult.ok, false);
  if (!duplicateRelationResult.ok) {
    assert.equal(duplicateRelationResult.error.code, 'INVALID_PROJECT_SPEC_METADATA');
  }

  const selfRelationResult = validateProjectSpecMetadataUpdate({
    current: approvedSpec,
    status: 'approved',
    relations: [
      {
        targetSpecId: 'spec-02',
        type: 'follow-up-to',
        createdAt: '2026-03-26T00:05:00.000Z',
      },
    ],
  });
  assert.equal(selfRelationResult.ok, false);
  if (!selfRelationResult.ok) {
    assert.equal(selfRelationResult.error.code, 'INVALID_PROJECT_SPEC_METADATA');
  }
});
