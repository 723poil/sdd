export const PROJECT_REFERENCE_TAGS_SCHEMA_VERSION = 1;

const DEFAULT_EMPTY_TIMESTAMP = new Date(0).toISOString();
const PROJECT_REFERENCE_TAG_COLOR_PALETTE = [
  '#2563eb',
  '#0f766e',
  '#b45309',
  '#be185d',
  '#6d28d9',
  '#15803d',
  '#b91c1c',
  '#0f172a',
] as const;

export interface ProjectReferenceTag {
  id: string;
  label: string;
  description: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectReferenceTagAssignment {
  path: string;
  tagIds: string[];
}

export interface ProjectReferenceTagDocument {
  schemaVersion: typeof PROJECT_REFERENCE_TAGS_SCHEMA_VERSION;
  updatedAt: string;
  revision: number;
  tags: ProjectReferenceTag[];
  assignments: ProjectReferenceTagAssignment[];
}

export function createEmptyProjectReferenceTagDocument(input?: {
  now?: string;
  revision?: number;
}): ProjectReferenceTagDocument {
  return {
    schemaVersion: PROJECT_REFERENCE_TAGS_SCHEMA_VERSION,
    updatedAt: input?.now ?? DEFAULT_EMPTY_TIMESTAMP,
    revision: input?.revision ?? 0,
    tags: [],
    assignments: [],
  };
}

export function createProjectReferenceTag(input: {
  label: string;
  description?: string | null;
  existingIds: Iterable<string>;
  now: string;
}): ProjectReferenceTag {
  const normalizedLabel = input.label.trim();
  const existingIds = new Set(input.existingIds);
  const nextId = createUniqueProjectReferenceTagId(normalizedLabel, existingIds);

  return {
    id: nextId,
    label: normalizedLabel,
    description: input.description?.trim() ?? '',
    color:
      PROJECT_REFERENCE_TAG_COLOR_PALETTE[
        existingIds.size % PROJECT_REFERENCE_TAG_COLOR_PALETTE.length
      ] ?? PROJECT_REFERENCE_TAG_COLOR_PALETTE[0],
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function normalizeProjectReferenceTagDocument(
  value: unknown,
): ProjectReferenceTagDocument | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    candidate.schemaVersion !== PROJECT_REFERENCE_TAGS_SCHEMA_VERSION ||
    typeof candidate.updatedAt !== 'string' ||
    typeof candidate.revision !== 'number' ||
    !Array.isArray(candidate.tags) ||
    !candidate.tags.every((tag) => isProjectReferenceTag(tag)) ||
    !Array.isArray(candidate.assignments) ||
    !candidate.assignments.every((assignment) => isProjectReferenceTagAssignment(assignment))
  ) {
    return null;
  }

  return sanitizeProjectReferenceTagDocument({
    document: {
      schemaVersion: PROJECT_REFERENCE_TAGS_SCHEMA_VERSION,
      updatedAt: candidate.updatedAt,
      revision: candidate.revision,
      tags: candidate.tags.map((tag) => ({
        id: tag.id,
        label: tag.label,
        description: tag.description,
        color: tag.color,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      })),
      assignments: candidate.assignments.map((assignment) => ({
        path: assignment.path,
        tagIds: [...assignment.tagIds],
      })),
    },
  });
}

export function sanitizeProjectReferenceTagDocument(input: {
  document: ProjectReferenceTagDocument;
  validFilePaths?: Iterable<string> | null;
}): ProjectReferenceTagDocument {
  const normalizedTags = new Map<string, ProjectReferenceTag>();

  for (const tag of input.document.tags) {
    if (normalizedTags.has(tag.id)) {
      continue;
    }

    normalizedTags.set(tag.id, {
      id: tag.id,
      label: tag.label.trim(),
      description: tag.description.trim(),
      color: tag.color.trim(),
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    });
  }

  const validFilePaths = input.validFilePaths ? new Set(input.validFilePaths) : null;
  const assignmentByPath = new Map<string, Set<string>>();

  for (const assignment of input.document.assignments) {
    const normalizedPath = assignment.path.trim();
    if (normalizedPath.length === 0) {
      continue;
    }

    if (validFilePaths && !validFilePaths.has(normalizedPath)) {
      continue;
    }

    const tagIdSet = assignmentByPath.get(normalizedPath) ?? new Set<string>();
    for (const tagId of assignment.tagIds) {
      if (!normalizedTags.has(tagId)) {
        continue;
      }

      tagIdSet.add(tagId);
    }

    if (tagIdSet.size === 0) {
      continue;
    }

    assignmentByPath.set(normalizedPath, tagIdSet);
  }

  return {
    schemaVersion: PROJECT_REFERENCE_TAGS_SCHEMA_VERSION,
    updatedAt: input.document.updatedAt,
    revision: input.document.revision,
    tags: [...normalizedTags.values()].sort((left, right) => left.label.localeCompare(right.label)),
    assignments: [...assignmentByPath.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([path, tagIds]) => ({
        path,
        tagIds: [...tagIds].sort((left, right) => left.localeCompare(right)),
      })),
  };
}

function createUniqueProjectReferenceTagId(label: string, existingIds: Set<string>): string {
  const baseId = createProjectReferenceTagId(label);
  let candidate = baseId;
  let suffix = 2;

  while (existingIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function createProjectReferenceTagId(label: string): string {
  const normalizedLabel = label
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s/_]+/gu, '-')
    .replace(/[^\p{Letter}\p{Number}-]+/gu, '')
    .replace(/-{2,}/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48);

  return normalizedLabel.length > 0 ? normalizedLabel : 'tag';
}

function isProjectReferenceTag(value: unknown): value is ProjectReferenceTag {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.color === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string'
  );
}

function isProjectReferenceTagAssignment(value: unknown): value is ProjectReferenceTagAssignment {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.path === 'string' && isStringArray(candidate.tagIds);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
