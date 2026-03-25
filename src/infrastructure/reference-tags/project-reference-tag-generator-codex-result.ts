import {
  createProjectReferenceTag,
  PROJECT_REFERENCE_TAGS_SCHEMA_VERSION,
  sanitizeProjectReferenceTagDocument,
  type ProjectReferenceTag,
  type ProjectReferenceTagDocument,
} from '@/domain/project/project-reference-tag-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

interface ParsedProjectReferenceTagGenerationPayload {
  tags: Array<{
    description: string;
    label: string;
    paths: string[];
  }>;
}

const FALLBACK_TAG_DESCRIPTION =
  '에이전트가 명확한 책임 그룹을 확정하지 못한 파일을 다시 검토할 때 사용합니다.';
const FALLBACK_TAG_LABEL = '검토 필요';

export function parseProjectReferenceTagGenerationResult(input: {
  raw: string;
  validFilePaths: string[];
}): Result<ProjectReferenceTagDocument> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(input.raw) as unknown;
  } catch {
    return err(
      createProjectError(
        'PROJECT_REFERENCE_TAG_GENERATION_FAILED',
        '에이전트 태그 결과를 JSON으로 파싱하지 못했습니다.',
      ),
    );
  }

  const payload = normalizeParsedPayload(parsed);
  if (!payload) {
    return err(
      createProjectError(
        'PROJECT_REFERENCE_TAG_GENERATION_FAILED',
        '에이전트 태그 결과가 현재 계약을 만족하지 않습니다.',
      ),
    );
  }

  const now = new Date().toISOString();
  const validFilePaths = [...new Set(input.validFilePaths)];
  const validFilePathSet = new Set(validFilePaths);
  const tags: ProjectReferenceTag[] = [];
  const tagByKey = new Map<string, ProjectReferenceTag>();
  const assignmentByPath = new Map<string, Set<string>>();

  for (const generatedTag of payload.tags) {
    if (generatedTag.label.trim().length === 0) {
      continue;
    }

    const normalizedPaths = [...new Set(generatedTag.paths.map((path) => path.trim()))].filter(
      (path) => validFilePathSet.has(path),
    );
    if (normalizedPaths.length === 0) {
      continue;
    }

    const tag = getOrCreateTag({
      description: generatedTag.description,
      existingTags: tagByKey,
      now,
      tags,
    }, generatedTag.label);

    for (const path of normalizedPaths) {
      const tagIds = assignmentByPath.get(path) ?? new Set<string>();
      tagIds.add(tag.id);
      assignmentByPath.set(path, tagIds);
    }
  }

  const missingPaths = validFilePaths.filter((path) => !assignmentByPath.has(path));
  if (missingPaths.length > 0) {
    const fallbackTag = getOrCreateTag(
      {
        description: FALLBACK_TAG_DESCRIPTION,
        existingTags: tagByKey,
        now,
        tags,
      },
      FALLBACK_TAG_LABEL,
    );

    for (const path of missingPaths) {
      assignmentByPath.set(path, new Set([fallbackTag.id]));
    }
  }

  return ok(
    sanitizeProjectReferenceTagDocument({
      document: {
        schemaVersion: PROJECT_REFERENCE_TAGS_SCHEMA_VERSION,
        updatedAt: now,
        revision: 0,
        tags,
        assignments: [...assignmentByPath.entries()].map(([path, tagIds]) => ({
          path,
          tagIds: [...tagIds],
        })),
      },
      validFilePaths,
    }),
  );
}

function getOrCreateTag(
  input: {
    description: string;
    existingTags: Map<string, ProjectReferenceTag>;
    now: string;
    tags: ProjectReferenceTag[];
  },
  label: string,
): ProjectReferenceTag {
  const normalizedLabel = label.trim();
  const normalizedKey = normalizedLabel.normalize('NFKC').toLowerCase();
  const existingTag = input.existingTags.get(normalizedKey);
  if (existingTag) {
    if (existingTag.description.length === 0 && input.description.trim().length > 0) {
      existingTag.description = input.description.trim();
      existingTag.updatedAt = input.now;
    }

    return existingTag;
  }

  const nextTag = createProjectReferenceTag({
    description: input.description,
    existingIds: input.tags.map((tag) => tag.id),
    label: normalizedLabel,
    now: input.now,
  });

  input.existingTags.set(normalizedKey, nextTag);
  input.tags.push(nextTag);

  return nextTag;
}

function normalizeParsedPayload(value: unknown): ParsedProjectReferenceTagGenerationPayload | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.tags) || !candidate.tags.every((tag) => isParsedTag(tag))) {
    return null;
  }

  return {
    tags: candidate.tags.map((tag) => ({
      label: tag.label.trim(),
      description: tag.description.trim(),
      paths: tag.paths.map((path) => path.trim()),
    })),
  };
}

function isParsedTag(
  value: unknown,
): value is ParsedProjectReferenceTagGenerationPayload['tags'][number] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.label === 'string' &&
    typeof candidate.description === 'string' &&
    Array.isArray(candidate.paths) &&
    candidate.paths.every((path) => typeof path === 'string')
  );
}
