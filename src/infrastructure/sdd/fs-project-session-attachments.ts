import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

import type {
  ProjectSessionMessageAttachmentManifest,
  ProjectSessionMessageAttachmentUpload,
} from '@/domain/project/project-session-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

import {
  getSessionAttachmentAbsolutePath,
  getSessionAttachmentRelativePath,
  getSessionMessageAttachmentsDirectoryPath,
  getSessionMessageAttachmentPath,
} from '@/infrastructure/sdd/fs-project-session-paths';

export async function persistProjectSessionMessageAttachments(input: {
  attachments: readonly ProjectSessionMessageAttachmentUpload[];
  messageId: string;
  now: string;
  rootPath: string;
  sessionId: string;
}): Promise<Result<ProjectSessionMessageAttachmentManifest[]>> {
  if (input.attachments.length === 0) {
    return ok([]);
  }

  const attachmentDirectoryPath = getSessionMessageAttachmentsDirectoryPath(
    input.rootPath,
    input.sessionId,
    input.messageId,
  );

  try {
    await mkdir(attachmentDirectoryPath, {
      recursive: true,
    });

    const usedFileNames = new Set<string>();
    const persistedAttachments: ProjectSessionMessageAttachmentManifest[] = [];

    for (const attachment of input.attachments) {
      const storedFileName = createUniqueAttachmentFileName(attachment.name, usedFileNames);
      const attachmentPath = getSessionMessageAttachmentPath(
        input.rootPath,
        input.sessionId,
        input.messageId,
        storedFileName,
      );

      await writeFile(attachmentPath, attachment.bytes);
      persistedAttachments.push({
        id: randomUUID(),
        kind: attachment.kind,
        source: attachment.source,
        name: attachment.name,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        relativePath: getSessionAttachmentRelativePath(input.messageId, storedFileName),
        createdAt: input.now,
      });
    }

    return ok(
      hydrateProjectSessionMessageAttachments({
        attachments: persistedAttachments,
        rootPath: input.rootPath,
        sessionId: input.sessionId,
      }),
    );
  } catch (error) {
    await rm(attachmentDirectoryPath, {
      force: true,
      recursive: true,
    });

    return err(
      createProjectError(
        'INVALID_PROJECT_STORAGE',
        '첨부 파일을 세션 저장소에 복사하지 못했습니다.',
        error instanceof Error ? error.message : undefined,
      ),
    );
  }
}

export function hydrateProjectSessionMessageAttachments(input: {
  attachments: readonly ProjectSessionMessageAttachmentManifest[];
  rootPath: string;
  sessionId: string;
}): ProjectSessionMessageAttachmentManifest[] {
  return input.attachments.map((attachment) => ({
    ...attachment,
    previewUrl:
      attachment.kind === 'image'
        ? pathToFileURL(
            getSessionAttachmentAbsolutePath(
              input.rootPath,
              input.sessionId,
              attachment.relativePath,
            ),
          ).toString()
        : null,
  }));
}

export async function readProjectSessionMessageAttachmentTextExcerpt(input: {
  attachment: Pick<ProjectSessionMessageAttachmentManifest, 'kind' | 'relativePath'>;
  maxCharacters: number;
  rootPath: string;
  sessionId: string;
}): Promise<string | null> {
  if (input.attachment.kind !== 'file' || input.maxCharacters <= 0) {
    return null;
  }

  try {
    const content = await readFile(
      getSessionAttachmentAbsolutePath(
        input.rootPath,
        input.sessionId,
        input.attachment.relativePath,
      ),
      'utf8',
    );
    if (content.includes('\uFFFD') || content.includes('\u0000')) {
      return null;
    }

    const normalized = content.replaceAll('\r\n', '\n').trim();
    if (normalized.length === 0) {
      return null;
    }

    return normalized.length > input.maxCharacters
      ? `${normalized.slice(0, input.maxCharacters - 3)}...`
      : normalized;
  } catch {
    return null;
  }
}

function createUniqueAttachmentFileName(originalName: string, usedFileNames: Set<string>): string {
  const sanitizedName = sanitizeAttachmentFileName(originalName);
  if (!usedFileNames.has(sanitizedName)) {
    usedFileNames.add(sanitizedName);
    return sanitizedName;
  }

  const { baseName, extension } = splitAttachmentFileName(sanitizedName);
  let nextIndex = 2;

  while (true) {
    const nextName =
      extension.length > 0 ? `${baseName}-${nextIndex}.${extension}` : `${baseName}-${nextIndex}`;
    if (!usedFileNames.has(nextName)) {
      usedFileNames.add(nextName);
      return nextName;
    }

    nextIndex += 1;
  }
}

function sanitizeAttachmentFileName(name: string): string {
  const trimmedBaseName = basename(name.trim()).replaceAll(/[\\/]/gu, '-');
  if (trimmedBaseName.length === 0 || trimmedBaseName === '.' || trimmedBaseName === '..') {
    return 'attachment';
  }

  return trimmedBaseName;
}

function splitAttachmentFileName(fileName: string): { baseName: string; extension: string } {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
    return {
      baseName: fileName,
      extension: '',
    };
  }

  return {
    baseName: fileName.slice(0, lastDotIndex),
    extension: fileName.slice(lastDotIndex + 1),
  };
}
