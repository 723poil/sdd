import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createNextProjectSpecVersionId,
  isProjectSpecMeta,
  normalizeProjectSpecDraft,
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
      schemaVersion: 2,
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
    }),
    true,
  );
});
