import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createFsProjectSessionRepository } from '@/infrastructure/sdd/fs-project-session.repository';
import { createFsProjectStorageRepository } from '@/infrastructure/sdd/fs-project-storage.repository';
import {
  getSessionMessagesPath,
  getSessionMessageAttachmentsDirectoryPath,
} from '@/infrastructure/sdd/fs-project-session-paths';

void test('session repository stores per-message attachments and restores previews', async () => {
  const rootPath = await mkdtemp(join(tmpdir(), 'sdd-session-attachments-'));
  const sessionRepository = createFsProjectSessionRepository();
  const storageRepository = createFsProjectStorageRepository();

  try {
    const initializeResult = await storageRepository.initializeStorage({ rootPath });
    assert.equal(initializeResult.ok, true);

    const createSessionResult = await sessionRepository.createSession({
      rootPath,
      specId: null,
      title: '첨부 테스트',
    });
    assert.equal(createSessionResult.ok, true);
    if (!createSessionResult.ok) {
      return;
    }

    const appendResult = await sessionRepository.appendSessionMessage({
      attachments: [
        {
          bytes: new Uint8Array(new TextEncoder().encode('hello attachment')),
          kind: 'file',
          mimeType: 'text/plain',
          name: 'notes.txt',
          sizeBytes: 'hello attachment'.length,
          source: 'picker',
        },
        {
          bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
          kind: 'image',
          mimeType: 'image/png',
          name: 'screenshot.png',
          sizeBytes: 4,
          source: 'paste',
        },
      ],
      rootPath,
      sessionId: createSessionResult.value.id,
      role: 'user',
      text: '',
    });
    assert.equal(appendResult.ok, true);
    if (!appendResult.ok) {
      return;
    }

    assert.equal(appendResult.value.message.attachments.length, 2);
    assert.equal(appendResult.value.session.lastMessagePreview, '[첨부 2개] notes.txt 외 1개');

    const attachmentDirectoryEntries = await readdir(
      getSessionMessageAttachmentsDirectoryPath(
        rootPath,
        createSessionResult.value.id,
        appendResult.value.message.id,
      ),
    );
    assert.equal(attachmentDirectoryEntries.length, 2);

    const rawMessageLines = (
      await readFile(getSessionMessagesPath(rootPath, createSessionResult.value.id), 'utf8')
    )
      .trim()
      .split('\n');
    const persistedMessage = JSON.parse(rawMessageLines[0] ?? '{}') as {
      attachments?: Array<{ previewUrl?: string; relativePath: string }>;
    };
    assert.equal(Array.isArray(persistedMessage.attachments), true);
    assert.equal(persistedMessage.attachments?.[0]?.previewUrl, undefined);
    assert.match(
      persistedMessage.attachments?.[0]?.relativePath ?? '',
      new RegExp(`^attachments/${appendResult.value.message.id}/`),
    );

    const readMessagesResult = await sessionRepository.readSessionMessages({
      rootPath,
      sessionId: createSessionResult.value.id,
    });
    assert.equal(readMessagesResult.ok, true);
    if (!readMessagesResult.ok) {
      return;
    }

    const restoredImageAttachment = readMessagesResult.value[0]?.attachments[1];
    assert.equal(restoredImageAttachment?.kind, 'image');
    assert.match(restoredImageAttachment?.previewUrl ?? '', /^file:/);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});
