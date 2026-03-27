import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProjectSessionMessagePreview,
  normalizeProjectSessionMessage,
  validateProjectSessionMessageAttachmentSelection,
} from '@/domain/project/project-session-model';

void test('session message preview falls back to attachment summary when text is empty', () => {
  const preview = createProjectSessionMessagePreview({
    attachments: [{ name: 'screenshot.png' }, { name: 'notes.md' }],
    text: '   ',
  });

  assert.equal(preview, '[첨부 2개] screenshot.png 외 1개');
});

void test('normalizeProjectSessionMessage upgrades legacy schemaVersion 1 messages', () => {
  const normalized = normalizeProjectSessionMessage({
    schemaVersion: 1,
    id: 'message-1',
    sessionId: 'session-1',
    createdAt: '2026-03-27T09:00:00.000Z',
    role: 'user',
    text: 'legacy message',
  });

  assert.notEqual(normalized, null);
  if (!normalized) {
    return;
  }

  assert.equal(normalized.schemaVersion, 2);
  assert.deepEqual(normalized.attachments, []);
});

void test('validateProjectSessionMessageAttachmentSelection enforces supported types and limits', () => {
  const validationResult = validateProjectSessionMessageAttachmentSelection({
    existingAttachments: [{ sizeBytes: 12 * 1024 * 1024 }],
    candidates: [
      {
        mimeType: 'image/png',
        name: 'capture.png',
        sizeBytes: 1024,
        source: 'paste',
      },
      {
        mimeType: 'application/octet-stream',
        name: 'archive.zip',
        sizeBytes: 1024,
        source: 'drop',
      },
      {
        mimeType: 'text/plain',
        name: 'huge.txt',
        sizeBytes: 25 * 1024 * 1024,
        source: 'picker',
      },
      {
        mimeType: 'text/plain',
        name: 'notes.txt',
        sizeBytes: 19 * 1024 * 1024,
        source: 'picker',
      },
    ],
  });

  assert.equal(validationResult.accepted.length, 1);
  assert.equal(validationResult.accepted[0]?.kind, 'image');
  assert.deepEqual(
    validationResult.rejected.map((issue) => issue.code),
    ['unsupported-type', 'file-too-large', 'total-size-too-large'],
  );
});
