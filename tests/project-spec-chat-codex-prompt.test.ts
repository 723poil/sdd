import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  PROJECT_SPEC_SCHEMA_VERSION,
  type ProjectSpecDocument,
} from '@/domain/project/project-spec-model';
import {
  PROJECT_SESSION_MESSAGE_SCHEMA_VERSION,
  type ProjectSessionMessage,
} from '@/domain/project/project-session-model';
import { createProjectSpecChatPrompt } from '@/infrastructure/spec-chat/project-spec-chat-codex-prompt';
import { getSessionMessageAttachmentsDirectoryPath } from '@/infrastructure/sdd/fs-project-session-paths';

void test('spec chat prompt includes saved attachment paths and readable excerpts', async () => {
  const rootPath = await mkdtemp(join(tmpdir(), 'sdd-spec-chat-prompt-'));

  try {
    const sessionId = 'session-1';
    const messageId = 'message-1';
    const attachmentDirectoryPath = getSessionMessageAttachmentsDirectoryPath(
      rootPath,
      sessionId,
      messageId,
    );
    await mkdir(attachmentDirectoryPath, { recursive: true });
    await writeFile(
      join(attachmentDirectoryPath, 'context.md'),
      '# 첨부 컨텍스트\n\n스크린샷과 함께 봐 주세요.',
      'utf8',
    );

    const sessionMessages: ProjectSessionMessage[] = [
      {
        schemaVersion: PROJECT_SESSION_MESSAGE_SCHEMA_VERSION,
        attachments: [
          {
            id: 'attachment-1',
            kind: 'file',
            source: 'picker',
            name: 'context.md',
            mimeType: 'text/markdown',
            sizeBytes: 42,
            relativePath: `attachments/${messageId}/context.md`,
            createdAt: '2026-03-27T00:00:00.000Z',
          },
          {
            id: 'attachment-2',
            kind: 'image',
            source: 'paste',
            name: 'screen.png',
            mimeType: 'image/png',
            sizeBytes: 128,
            relativePath: `attachments/${messageId}/screen.png`,
            createdAt: '2026-03-27T00:00:00.000Z',
          },
        ],
        createdAt: '2026-03-27T00:00:00.000Z',
        id: messageId,
        role: 'user',
        sessionId,
        text: '첨부를 보고 명세를 정리해 주세요.',
      },
    ];

    const spec: ProjectSpecDocument = {
      meta: {
        schemaVersion: PROJECT_SPEC_SCHEMA_VERSION,
        id: 'spec-1',
        slug: 'chat-attachments',
        title: '채팅 첨부',
        status: 'draft',
        createdAt: '2026-03-27T00:00:00.000Z',
        updatedAt: '2026-03-27T00:00:00.000Z',
        revision: 1,
        latestVersion: null,
        currentVersion: null,
        draftMarkdown: '# 채팅 첨부\n\n초안',
        summary: '채팅 첨부 테스트',
        relations: [],
      },
      markdown: '# 채팅 첨부\n\n초안',
    };

    const prompt = await createProjectSpecChatPrompt({
      projectName: 'SDD',
      rootPath,
      sessionMessages,
      spec,
    });

    assert.match(
      prompt,
      /saved_path="\.sdd\/sessions\/session-1\/attachments\/message-1\/context\.md"/u,
    );
    assert.match(prompt, /<excerpt># 첨부 컨텍스트/u);
    assert.match(prompt, /Inspect this saved image file when visual evidence matters\./u);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});
