import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

import type { ProjectStoragePort } from '@/application/project/project.ports';
import { ANALYSIS_FILE_INDEX_SCHEMA_VERSION } from '@/domain/project/project-model';
import {
  PROJECT_ANALYSIS_DOCUMENT_IDS,
  normalizeProjectAnalysisContext,
  type ProjectAnalysisContext,
  type ProjectAnalysisDraft,
  type ProjectAnalysisDocumentLayoutMap,
} from '@/domain/project/project-analysis-model';
import {
  createEmptyProjectReferenceTagDocument,
  PROJECT_REFERENCE_TAGS_SCHEMA_VERSION,
  sanitizeProjectReferenceTagDocument,
  type ProjectReferenceTagDocument,
} from '@/domain/project/project-reference-tag-model';
import {
  createDefaultProjectSpecSlug,
  createDefaultProjectSpecTitle,
  createInitialProjectSpecMarkdown,
  createProjectSpecMeta,
} from '@/domain/project/project-spec-model';
import { createProjectError } from '@/domain/project/project-errors';
import {
  createInitialProjectMeta,
  createNextProjectMetaAfterSpecCreation,
  createNextProjectMetaAfterAnalysis,
} from '@/domain/project/project-model';
import { err, ok, type Result } from '@/shared/contracts/result';

import {
  createInitialProjectStorageDocuments,
  readProjectAnalysisDocument,
  readProjectMetaDocument,
  readProjectReferenceTagDocument,
} from '@/infrastructure/sdd/fs-project-storage-documents';
import {
  readProjectSpecDocuments,
  toProjectSpecIndexEntries,
} from '@/infrastructure/sdd/fs-project-spec-documents';
import {
  getProjectAnalysisDocumentPath,
  getProjectStoragePaths,
  getSpecMetaPath,
  getSpecVersionPath,
} from '@/infrastructure/sdd/fs-project-storage-paths';
import {
  ensureJsonFile,
  ensureTextFile,
  pathExists,
  readJsonFile,
} from '@/infrastructure/sdd/fs-project-storage-io';
import {
  writeJsonAtomically,
  writeTextAtomically,
} from '@/infrastructure/fs/write-json-atomically';

interface ProjectAnalysisBackup {
  backupAnalysisDirectoryPath: string | null;
  backupRootPath: string | null;
  hadExistingAnalysisDirectory: boolean;
}

export function createFsProjectStorageRepository(): ProjectStoragePort {
  return {
    async readProjectMeta(input) {
      return readProjectMetaDocument({
        rootPath: input.rootPath,
      });
    },

    async readProjectAnalysis(input) {
      return readProjectAnalysisDocument({
        rootPath: input.rootPath,
      });
    },

    async readProjectSpecs(input) {
      const specsResult = await readProjectSpecDocuments({
        rootPath: input.rootPath,
      });
      if (!specsResult.ok) {
        return specsResult;
      }

      return ok(specsResult.value);
    },

    async createProjectSpec(input) {
      const rootPath = resolve(input.rootPath);
      const { projectJsonPath, specsIndexPath } = getProjectStoragePaths(rootPath);

      const existingProjectMetaResult = await this.readProjectMeta({ rootPath });
      if (!existingProjectMetaResult.ok) {
        return existingProjectMetaResult;
      }

      const existingProjectMeta = existingProjectMetaResult.value;
      if (!existingProjectMeta) {
        return err(
          createProjectError(
            'PROJECT_NOT_INITIALIZED',
            'project.json 이 없어 새 명세를 저장할 수 없습니다.',
            projectJsonPath,
          ),
        );
      }

      const existingSpecsResult = await readProjectSpecDocuments({ rootPath });
      if (!existingSpecsResult.ok) {
        return existingSpecsResult;
      }

      const now = new Date().toISOString();
      const sequenceNumber = existingSpecsResult.value.length + 1;
      const title = input.title?.trim() || createDefaultProjectSpecTitle({ sequenceNumber });
      const slug = createDefaultProjectSpecSlug({ sequenceNumber });
      const latestVersion = 'v1';
      const specMeta = createProjectSpecMeta({
        id: slug,
        slug,
        title,
        now,
        latestVersion,
        summary: '채팅으로 작성 중인 초안입니다.',
      });
      const specMarkdown = createInitialProjectSpecMarkdown({
        title,
      });

      await writeJsonAtomically(getSpecMetaPath(rootPath, slug), specMeta);
      await writeTextAtomically(
        getSpecVersionPath({
          rootPath,
          specId: slug,
          latestVersion,
        }),
        specMarkdown,
      );

      const nextProjectMeta = createNextProjectMetaAfterSpecCreation({
        current: existingProjectMeta,
        now,
        specId: specMeta.id,
      });
      await writeJsonAtomically(projectJsonPath, nextProjectMeta);

      const nextSpecsResult = await readProjectSpecDocuments({ rootPath });
      if (!nextSpecsResult.ok) {
        return nextSpecsResult;
      }

      await writeJsonAtomically(specsIndexPath, {
        schemaVersion: 1,
        generatedAt: now,
        specs: toProjectSpecIndexEntries(nextSpecsResult.value),
      });

      return ok({
        projectMeta: nextProjectMeta,
        spec: {
          meta: specMeta,
          markdown: specMarkdown,
        },
      });
    },

    async initializeStorage(input) {
      const rootPath = resolve(input.rootPath);
      const projectName = basename(rootPath);
      const now = new Date().toISOString();

      const {
        analysisContextPath,
        analysisDirectoryPath,
        analysisFileIndexPath,
        analysisManualReferenceTagsPath,
        analysisSummaryPath,
        projectJsonPath,
        runsDirectoryPath,
        sddDirectoryPath,
        sessionsDirectoryPath,
        sessionsIndexPath,
        specsDirectoryPath,
        specsIndexPath,
      } = getProjectStoragePaths(rootPath);

      const createdSddDirectory = !(await pathExists(sddDirectoryPath));

      await mkdir(analysisDirectoryPath, { recursive: true });
      await mkdir(sessionsDirectoryPath, { recursive: true });
      await mkdir(specsDirectoryPath, { recursive: true });
      await mkdir(runsDirectoryPath, { recursive: true });

      const existingProjectMetaResult = await this.readProjectMeta({ rootPath });
      if (!existingProjectMetaResult.ok) {
        return existingProjectMetaResult;
      }

      const projectMeta =
        existingProjectMetaResult.value ??
        createInitialProjectMeta({
          projectName,
          rootPath,
          now,
        });

      if (existingProjectMetaResult.value === null) {
        await writeJsonAtomically(projectJsonPath, projectMeta);
      }

      const initialDocuments = createInitialProjectStorageDocuments({
        now,
        projectName,
      });

      await ensureJsonFile(analysisContextPath, initialDocuments.analysisContext);
      await ensureJsonFile(analysisFileIndexPath, initialDocuments.analysisFileIndex);
      await ensureJsonFile(
        analysisManualReferenceTagsPath,
        initialDocuments.analysisManualReferenceTags,
      );
      await ensureTextFile(analysisSummaryPath, initialDocuments.analysisSummaryMarkdown);
      await ensureJsonFile(specsIndexPath, initialDocuments.specsIndex);
      await ensureJsonFile(sessionsIndexPath, initialDocuments.sessionsIndex);

      return ok({
        createdSddDirectory,
        initializedAt: now,
        projectMeta,
      });
    },

    async writeProjectAnalysis(input) {
      const rootPath = resolve(input.rootPath);
      const {
        analysisContextPath,
        analysisDirectoryPath,
        analysisFileIndexPath,
        analysisManualReferenceTagsPath,
        analysisSummaryPath,
        projectJsonPath,
        specsIndexPath,
      } = getProjectStoragePaths(rootPath);

      const existingProjectMetaResult = await this.readProjectMeta({ rootPath });
      if (!existingProjectMetaResult.ok) {
        return existingProjectMetaResult;
      }

      const existingProjectMeta = existingProjectMetaResult.value;
      if (!existingProjectMeta) {
        return err(
          createProjectError(
            'PROJECT_NOT_INITIALIZED',
            'project.json 이 없어 분석 결과를 저장할 수 없습니다.',
            projectJsonPath,
          ),
        );
      }

      const analysisBackupResult = await createProjectAnalysisBackup({
        analysisDirectoryPath,
      });
      if (!analysisBackupResult.ok) {
        return analysisBackupResult;
      }

      const analysisBackup = analysisBackupResult.value;
      let shouldCleanupBackup = true;

      try {
        const now = new Date().toISOString();
        const preservedDocumentLayouts = await readProjectAnalysisDocumentLayouts({
          analysisContextPath,
        });
        const preservedReferenceTags = await readProjectReferenceTags({
          analysisManualReferenceTagsPath,
          fallbackPaths: input.analysis.fileIndex.map((entry) => entry.path),
        });
        const nextAnalysisContext: ProjectAnalysisContext = {
          ...input.analysis.context,
          documentLayouts: preservedDocumentLayouts,
        };
        const nextProjectMeta = createNextProjectMetaAfterAnalysis({
          current: existingProjectMeta,
          detectedStack: input.analysis.detectedStack,
          now,
        });

        await writeJsonAtomically(analysisContextPath, nextAnalysisContext);
        await writeJsonAtomically(analysisFileIndexPath, {
          schemaVersion: ANALYSIS_FILE_INDEX_SCHEMA_VERSION,
          generatedAt: now,
          entries: input.analysis.fileIndex,
        });
        await writeTextAtomically(analysisSummaryPath, input.analysis.summaryMarkdown);
        await writeProjectAnalysisDocuments({
          analysis: input.analysis,
          analysisDirectoryPath,
        });
        const existingSpecsResult = await readProjectSpecDocuments({ rootPath });
        if (existingSpecsResult.ok) {
          await writeJsonAtomically(specsIndexPath, {
            schemaVersion: 1,
            generatedAt: now,
            specs: toProjectSpecIndexEntries(existingSpecsResult.value),
          });
        }
        await writeJsonAtomically(projectJsonPath, nextProjectMeta);

        return ok({
          analysis: {
            context: nextAnalysisContext,
            documents: input.analysis.documents,
            fileIndex: input.analysis.fileIndex,
            referenceTags: preservedReferenceTags,
            summaryMarkdown: input.analysis.summaryMarkdown,
          },
          projectMeta: nextProjectMeta,
        });
      } catch (error) {
        const restoreBackupResult = await restoreProjectAnalysisBackup({
          analysisBackup,
          analysisDirectoryPath,
        });
        if (!restoreBackupResult.ok) {
          shouldCleanupBackup = false;
          return err(
            createProjectError(
              'PROJECT_ANALYSIS_FAILED',
              '분석 결과를 저장하지 못했고 기존 분석 백업도 복구하지 못했습니다.',
              buildProjectAnalysisWriteFailureDetails({
                backupPath: analysisBackup.backupRootPath,
                error,
                restoreError:
                  restoreBackupResult.error.details ?? restoreBackupResult.error.message,
              }),
            ),
          );
        }

        return err(
          createProjectError(
            'PROJECT_ANALYSIS_FAILED',
            '분석 결과를 저장하지 못했습니다.',
            describeUnknownError(error),
          ),
        );
      } finally {
        if (shouldCleanupBackup) {
          await cleanupProjectAnalysisBackup(analysisBackup);
        }
      }
    },

    async saveProjectAnalysisDocumentLayouts(input) {
      const rootPath = resolve(input.rootPath);
      const { analysisContextPath, projectJsonPath } = getProjectStoragePaths(rootPath);

      const existingProjectMetaResult = await this.readProjectMeta({ rootPath });
      if (!existingProjectMetaResult.ok) {
        return existingProjectMetaResult;
      }

      if (!existingProjectMetaResult.value) {
        return err(
          createProjectError(
            'PROJECT_NOT_INITIALIZED',
            'project.json 이 없어 문서 카드 위치를 저장할 수 없습니다.',
            projectJsonPath,
          ),
        );
      }

      if (!(await pathExists(analysisContextPath))) {
        return err(
          createProjectError(
            'PROJECT_NOT_INITIALIZED',
            'analysis/context.json 이 없어 문서 카드 위치를 저장할 수 없습니다.',
            analysisContextPath,
          ),
        );
      }

      const contextResult = await readJsonFile(
        analysisContextPath,
        'analysis/context.json 을 읽거나 파싱할 수 없습니다.',
      );
      if (!contextResult.ok) {
        return err(contextResult.error);
      }

      const normalizedContext = normalizeProjectAnalysisContext(contextResult.value);
      if (!normalizedContext) {
        return err(
          createProjectError(
            'INVALID_PROJECT_STORAGE',
            'analysis/context.json 이 현재 schemaVersion 계약을 만족하지 않습니다.',
            analysisContextPath,
          ),
        );
      }

      const nextDocumentLayouts = cloneProjectAnalysisDocumentLayouts(input.documentLayouts);

      await writeJsonAtomically(analysisContextPath, {
        ...normalizedContext,
        documentLayouts: nextDocumentLayouts,
      });

      return ok(nextDocumentLayouts);
    },

    async saveProjectReferenceTags(input) {
      const rootPath = resolve(input.rootPath);
      const { analysisManualReferenceTagsPath, projectJsonPath } = getProjectStoragePaths(rootPath);

      const existingProjectMetaResult = await this.readProjectMeta({ rootPath });
      if (!existingProjectMetaResult.ok) {
        return existingProjectMetaResult;
      }

      if (!existingProjectMetaResult.value) {
        return err(
          createProjectError(
            'PROJECT_NOT_INITIALIZED',
            'project.json 이 없어 참조 태그를 저장할 수 없습니다.',
            projectJsonPath,
          ),
        );
      }

      await ensureJsonFile(
        analysisManualReferenceTagsPath,
        createEmptyProjectReferenceTagDocument({
          revision: 0,
        }),
      );

      const currentAnalysisResult = await this.readProjectAnalysis({ rootPath });
      if (!currentAnalysisResult.ok) {
        return err(currentAnalysisResult.error);
      }

      const validFilePaths =
        currentAnalysisResult.value?.fileIndex.map((entry) => entry.path) ?? [];
      const existingReferenceTags = await readProjectReferenceTags({
        analysisManualReferenceTagsPath,
        fallbackPaths: validFilePaths,
      });

      if (input.referenceTags.revision !== existingReferenceTags.revision) {
        return err(
          createProjectError(
            'PROJECT_WRITE_CONFLICT',
            '참조 태그가 다른 변경과 충돌했습니다. 다시 불러온 뒤 저장해 주세요.',
          ),
        );
      }

      const now = new Date().toISOString();
      const nextReferenceTags = sanitizeProjectReferenceTagDocument({
        document: {
          ...input.referenceTags,
          schemaVersion: PROJECT_REFERENCE_TAGS_SCHEMA_VERSION,
          revision: existingReferenceTags.revision + 1,
          updatedAt: now,
        },
        validFilePaths,
      });

      await writeJsonAtomically(analysisManualReferenceTagsPath, nextReferenceTags);

      return ok(nextReferenceTags);
    },
  };
}

async function createProjectAnalysisBackup(input: {
  analysisDirectoryPath: string;
}): Promise<Result<ProjectAnalysisBackup>> {
  const hadExistingAnalysisDirectory = await pathExists(input.analysisDirectoryPath);
  if (!hadExistingAnalysisDirectory) {
    return ok({
      backupAnalysisDirectoryPath: null,
      backupRootPath: null,
      hadExistingAnalysisDirectory: false,
    });
  }

  const backupRootPath = await mkdtemp(join(tmpdir(), 'sdd-analysis-backup-'));
  const backupAnalysisDirectoryPath = join(backupRootPath, 'analysis');

  try {
    await cp(input.analysisDirectoryPath, backupAnalysisDirectoryPath, {
      force: true,
      recursive: true,
    });
    await rm(input.analysisDirectoryPath, { force: true, recursive: true });

    return ok({
      backupAnalysisDirectoryPath,
      backupRootPath,
      hadExistingAnalysisDirectory: true,
    });
  } catch (error) {
    await rm(backupRootPath, { force: true, recursive: true });

    return err(
      createProjectError(
        'INVALID_PROJECT_STORAGE',
        '기존 분석 파일을 백업하지 못했습니다.',
        describeUnknownError(error),
      ),
    );
  }
}

async function restoreProjectAnalysisBackup(input: {
  analysisBackup: ProjectAnalysisBackup;
  analysisDirectoryPath: string;
}): Promise<Result<void>> {
  try {
    await rm(input.analysisDirectoryPath, { force: true, recursive: true });

    if (
      input.analysisBackup.hadExistingAnalysisDirectory &&
      input.analysisBackup.backupAnalysisDirectoryPath
    ) {
      await cp(input.analysisBackup.backupAnalysisDirectoryPath, input.analysisDirectoryPath, {
        force: true,
        recursive: true,
      });
    }

    return ok(undefined);
  } catch (error) {
    return err(
      createProjectError(
        'INVALID_PROJECT_STORAGE',
        '기존 분석 백업을 복구하지 못했습니다.',
        describeUnknownError(error),
      ),
    );
  }
}

async function cleanupProjectAnalysisBackup(backup: ProjectAnalysisBackup): Promise<void> {
  if (!backup.backupRootPath) {
    return;
  }

  try {
    await rm(backup.backupRootPath, { force: true, recursive: true });
  } catch {
    return;
  }
}

function buildProjectAnalysisWriteFailureDetails(input: {
  backupPath: string | null;
  error: unknown;
  restoreError: string;
}): string {
  const details = [
    `write=${describeUnknownError(input.error)}`,
    `restore=${input.restoreError}`,
    input.backupPath ? `backup=${input.backupPath}` : null,
  ].filter((value): value is string => value !== null);

  return details.join('\n');
}

function describeUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function readProjectAnalysisDocumentLayouts(input: {
  analysisContextPath: string;
}): Promise<ProjectAnalysisDocumentLayoutMap> {
  if (!(await pathExists(input.analysisContextPath))) {
    return {};
  }

  const contextResult = await readJsonFile(
    input.analysisContextPath,
    'analysis/context.json 을 읽거나 파싱할 수 없습니다.',
  );
  if (!contextResult.ok) {
    return {};
  }

  const normalizedContext = normalizeProjectAnalysisContext(contextResult.value);
  if (!normalizedContext) {
    return {};
  }

  return cloneProjectAnalysisDocumentLayouts(normalizedContext.documentLayouts);
}

async function readProjectReferenceTags(input: {
  analysisManualReferenceTagsPath: string;
  fallbackPaths: string[];
}): Promise<ProjectReferenceTagDocument> {
  const referenceTagsResult = await readProjectReferenceTagDocument(input);
  if (!referenceTagsResult.ok) {
    return sanitizeProjectReferenceTagDocument({
      document: {
        schemaVersion: PROJECT_REFERENCE_TAGS_SCHEMA_VERSION,
        updatedAt: new Date(0).toISOString(),
        revision: 0,
        tags: [],
        assignments: [],
      },
      validFilePaths: input.fallbackPaths,
    });
  }

  return sanitizeProjectReferenceTagDocument({
    document: referenceTagsResult.value,
    validFilePaths: input.fallbackPaths,
  });
}

function cloneProjectAnalysisDocumentLayouts(
  value: ProjectAnalysisDocumentLayoutMap,
): ProjectAnalysisDocumentLayoutMap {
  const next: ProjectAnalysisDocumentLayoutMap = {};

  for (const documentId of PROJECT_ANALYSIS_DOCUMENT_IDS) {
    const layout = value[documentId];
    if (!layout) {
      continue;
    }

    next[documentId] = {
      x: layout.x,
      y: layout.y,
    };
  }

  return next;
}

async function writeProjectAnalysisDocuments(input: {
  analysis: ProjectAnalysisDraft;
  analysisDirectoryPath: string;
}): Promise<void> {
  const documentMap = new Map(input.analysis.documents.map((document) => [document.id, document]));

  for (const documentId of PROJECT_ANALYSIS_DOCUMENT_IDS) {
    if (documentId === 'overview') {
      continue;
    }

    const document = documentMap.get(documentId);
    if (!document) {
      continue;
    }

    await writeTextAtomically(
      getProjectAnalysisDocumentPath({
        analysisDirectoryPath: input.analysisDirectoryPath,
        documentId,
      }),
      document.markdown,
    );
  }
}
