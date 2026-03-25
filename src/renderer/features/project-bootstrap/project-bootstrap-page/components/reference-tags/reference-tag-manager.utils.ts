import type {
  ProjectReferenceTag,
  ProjectReferenceTagDocument,
} from '@/domain/project/project-reference-tag-model';

export interface ReferenceTagSummary {
  tag: ProjectReferenceTag;
  fileCount: number;
  isAssignedToSelectedPath: boolean;
}

export function buildReferenceTagIdsByPath(
  referenceTags: ProjectReferenceTagDocument | undefined,
): Map<string, string[]> {
  const tagIdsByPath = new Map<string, string[]>();

  if (!referenceTags) {
    return tagIdsByPath;
  }

  for (const assignment of referenceTags.assignments) {
    tagIdsByPath.set(assignment.path, [...assignment.tagIds]);
  }

  return tagIdsByPath;
}

export function buildReferenceTagSummaries(input: {
  allowedPaths?: Set<string> | null;
  referenceTags: ProjectReferenceTagDocument | undefined;
  selectedPath: string | null;
}): ReferenceTagSummary[] {
  if (!input.referenceTags) {
    return [];
  }

  const fileCountByTagId = new Map<string, number>();
  const selectedPathTagIds = new Set(
    input.selectedPath
      ? (input.referenceTags.assignments.find(
          (assignment) => assignment.path === input.selectedPath,
        )?.tagIds ?? [])
      : [],
  );

  for (const assignment of input.referenceTags.assignments) {
    if (input.allowedPaths && !input.allowedPaths.has(assignment.path)) {
      continue;
    }

    for (const tagId of assignment.tagIds) {
      fileCountByTagId.set(tagId, (fileCountByTagId.get(tagId) ?? 0) + 1);
    }
  }

  return input.referenceTags.tags.map((tag) => ({
    tag,
    fileCount: fileCountByTagId.get(tag.id) ?? 0,
    isAssignedToSelectedPath: selectedPathTagIds.has(tag.id),
  }));
}

export function removeReferenceTagFromDocument(
  document: ProjectReferenceTagDocument,
  tagId: string,
): ProjectReferenceTagDocument {
  return {
    ...document,
    tags: document.tags.filter((tag) => tag.id !== tagId),
    assignments: document.assignments
      .map((assignment) => ({
        ...assignment,
        tagIds: assignment.tagIds.filter((assignedTagId) => assignedTagId !== tagId),
      }))
      .filter((assignment) => assignment.tagIds.length > 0),
  };
}

export function toggleReferenceTagAssignment(input: {
  document: ProjectReferenceTagDocument;
  path: string;
  tagId: string;
}): ProjectReferenceTagDocument {
  const assignments = new Map(
    input.document.assignments.map((assignment) => [assignment.path, new Set(assignment.tagIds)]),
  );
  const nextTagIds = assignments.get(input.path) ?? new Set<string>();

  if (nextTagIds.has(input.tagId)) {
    nextTagIds.delete(input.tagId);
  } else {
    nextTagIds.add(input.tagId);
  }

  if (nextTagIds.size === 0) {
    assignments.delete(input.path);
  } else {
    assignments.set(input.path, nextTagIds);
  }

  return {
    ...input.document,
    assignments: [...assignments.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([path, tagIds]) => ({
        path,
        tagIds: [...tagIds].sort((left, right) => left.localeCompare(right)),
      })),
  };
}
