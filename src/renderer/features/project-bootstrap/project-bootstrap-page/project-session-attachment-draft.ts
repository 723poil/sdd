import type {
  ProjectSessionMessageAttachmentKind,
  ProjectSessionMessageAttachmentSource,
  ProjectSessionMessageAttachmentUpload,
  ProjectSessionValidatedMessageAttachmentCandidate,
} from '@/domain/project/project-session-model';
import {
  describeProjectSessionMessageAttachmentValidationIssue,
  getProjectSessionMessageAttachmentExtensionFromMimeType,
  validateProjectSessionMessageAttachmentSelection,
} from '@/domain/project/project-session-model';

export interface ProjectSessionDraftAttachment {
  draftId: string;
  source: ProjectSessionMessageAttachmentSource;
  kind: ProjectSessionMessageAttachmentKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  previewUrl: string | null;
  file: File;
}

export function collectProjectSessionDraftAttachments(input: {
  existingAttachments: readonly ProjectSessionDraftAttachment[];
  files: readonly File[];
  source: ProjectSessionMessageAttachmentSource;
}): { attachments: ProjectSessionDraftAttachment[]; errors: string[] } {
  const candidateEntries = input.files.map((file, index) => {
    const normalizedMimeType = file.type.trim().toLowerCase();
    const normalizedName = normalizeDraftAttachmentFileName({
      fallbackIndex: index,
      file,
      mimeType: normalizedMimeType,
    });

    return {
      candidate: {
        mimeType: normalizedMimeType,
        name: normalizedName,
        sizeBytes: file.size,
        source: input.source,
      },
      file,
    };
  });

  const validationResult = validateProjectSessionMessageAttachmentSelection({
    candidates: candidateEntries.map((entry) => entry.candidate),
    existingAttachments: input.existingAttachments.map((attachment) => ({
      sizeBytes: attachment.sizeBytes,
    })),
  });

  const candidateToFile = new Map(
    candidateEntries.map((entry) => [entry.candidate, entry.file] as const),
  );
  const nextAttachments = [
    ...input.existingAttachments,
    ...validationResult.accepted.flatMap((acceptedCandidate) =>
      createAcceptedDraftAttachment(acceptedCandidate, candidateToFile),
    ),
  ];

  return {
    attachments: nextAttachments,
    errors: validationResult.rejected.map((issue) =>
      describeProjectSessionMessageAttachmentValidationIssue(issue),
    ),
  };
}

export async function createProjectSessionMessageAttachmentUploads(
  attachments: readonly ProjectSessionDraftAttachment[],
): Promise<ProjectSessionMessageAttachmentUpload[]> {
  return Promise.all(
    attachments.map(async (attachment) => ({
      bytes: new Uint8Array(await attachment.file.arrayBuffer()),
      kind: attachment.kind,
      mimeType: attachment.mimeType,
      name: attachment.name,
      sizeBytes: attachment.sizeBytes,
      source: attachment.source,
    })),
  );
}

export function revokeProjectSessionDraftAttachments(
  attachments: readonly ProjectSessionDraftAttachment[],
): void {
  for (const attachment of attachments) {
    if (attachment.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  }
}

function createAcceptedDraftAttachment(
  acceptedCandidate: ProjectSessionValidatedMessageAttachmentCandidate,
  candidateToFile: Map<ProjectSessionValidatedMessageAttachmentCandidate['candidate'], File>,
): ProjectSessionDraftAttachment[] {
  const file = candidateToFile.get(acceptedCandidate.candidate);
  if (!file) {
    return [];
  }

  return [
    {
      draftId: crypto.randomUUID(),
      source: acceptedCandidate.candidate.source,
      kind: acceptedCandidate.kind,
      name: acceptedCandidate.candidate.name,
      mimeType: acceptedCandidate.candidate.mimeType,
      sizeBytes: acceptedCandidate.candidate.sizeBytes,
      previewUrl: acceptedCandidate.kind === 'image' ? URL.createObjectURL(file) : null,
      file,
    },
  ];
}

function normalizeDraftAttachmentFileName(input: {
  fallbackIndex: number;
  file: File;
  mimeType: string;
}): string {
  const trimmedName = input.file.name.trim();
  if (trimmedName.length > 0) {
    return trimmedName;
  }

  const extension =
    getProjectSessionMessageAttachmentExtensionFromMimeType(input.mimeType) ?? 'txt';
  return `attachment-${String(input.fallbackIndex + 1).padStart(2, '0')}.${extension}`;
}
