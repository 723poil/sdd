import { mkdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import type { ProjectStoragePort } from '@/application/project/project.ports';
import { ANALYSIS_FILE_INDEX_SCHEMA_VERSION } from '@/domain/project/project-model';
import { type ProjectAnalysisContext } from '@/domain/project/project-analysis-model';
import {
  createEmptyProjectReferenceTagDocument,
  PROJECT_REFERENCE_TAGS_SCHEMA_VERSION,
  sanitizeProjectReferenceTagDocument,
} from '@/domain/project/project-reference-tag-model';
import {
  createNextProjectSpecMeta,
  createNextProjectSpecVersionId,
  createDefaultProjectSpecSlug,
  createDefaultProjectSpecTitle,
  extractProjectSpecSummary,
  createInitialProjectSpecMarkdown,
  createProjectSpecMeta,
  normalizeProjectSpecMarkdown,
  normalizeProjectSpecTitle,
} from '@/domain/project/project-spec-model';
import { createProjectError } from '@/domain/project/project-errors';
import {
  createInitialProjectMeta,
  createNextProjectMetaAfterSpecCreation,
  createNextProjectMetaAfterAnalysis,
  createNextProjectMetaAfterRename,
  normalizeProjectName,
} from '@/domain/project/project-model';
import { err, ok } from '@/shared/contracts/result';

import {
  createInitialProjectStorageDocuments,
  readProjectAnalysisDocument,
  readProjectMetaDocument,
} from '@/infrastructure/sdd/fs-project-storage-documents';
import {
  readSpecMetaDocument,
  readProjectSpecDocuments,
  toProjectSpecIndexEntries,
} from '@/infrastructure/sdd/fs-project-spec-documents';
import {
  getProjectStoragePaths,
  getSpecMetaPath,
  getSpecVersionPath,
} from '@/infrastructure/sdd/fs-project-storage-paths';
import { ensureJsonFile, ensureTextFile, pathExists } from '@/infrastructure/sdd/fs-project-storage-io';
import {
  buildProjectAnalysisWriteFailureDetails,
  cleanupProjectAnalysisBackup,
  createProjectAnalysisBackup,
  restoreProjectAnalysisBackup,
} from '@/infrastructure/sdd/fs-project-analysis-backup';
import {
  readProjectAnalysisDocumentLayouts,
  readProjectReferenceTags,
  writeProjectAnalysisDocumentLayouts,
  writeProjectAnalysisDocuments,
} from '@/infrastructure/sdd/fs-project-analysis-persistence';
import {
  writeJsonAtomically,
  writeTextAtomically,
} from '@/infrastructure/fs/write-json-atomically';

export function createFsProjectStorageRepository(): ProjectStoragePort {
  return {
    async readProjectMeta(input) {
      return readProjectMetaDocument({
        rootPath: input.rootPath,
      });
    },

    async renameProject(input) {
      const rootPath = resolve(input.rootPath);
      const { projectJsonPath } = getProjectStoragePaths(rootPath);

      const existingProjectMetaResult = await this.readProjectMeta({ rootPath });
      if (!existingProjectMetaResult.ok) {
        return existingProjectMetaResult;
      }

      if (!existingProjectMetaResult.value) {
        return ok(null);
      }

      const projectName = normalizeProjectName(input.projectName);
      if (projectName.length === 0) {
        return err(createProjectError('INVALID_PROJECT_NAME', '프로젝트 이름을 입력해 주세요.'));
      }

      if (existingProjectMetaResult.value.projectName === projectName) {
        return ok(existingProjectMetaResult.value);
      }

      const nextProjectMeta = createNextProjectMetaAfterRename({
        current: existingProjectMetaResult.value,
        now: new Date().toISOString(),
        projectName,
      });

      await writeJsonAtomically(projectJsonPath, nextProjectMeta);

      return ok(nextProjectMeta);
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

    async saveProjectSpec(input) {
      const rootPath = resolve(input.rootPath);
      const { projectJsonPath, specsIndexPath } = getProjectStoragePaths(rootPath);

      const existingProjectMetaResult = await this.readProjectMeta({ rootPath });
      if (!existingProjectMetaResult.ok) {
        return existingProjectMetaResult;
      }

      if (!existingProjectMetaResult.value) {
        return err(
          createProjectError(
            'PROJECT_NOT_INITIALIZED',
            'project.json 이 없어 명세를 저장할 수 없습니다.',
            projectJsonPath,
          ),
        );
      }

      const existingSpecMetaResult = await readSpecMetaDocument({
        rootPath,
        specId: input.specId,
      });
      if (!existingSpecMetaResult.ok) {
        return existingSpecMetaResult;
      }

      if (!existingSpecMetaResult.value) {
        return err(
          createProjectError(
            'INVALID_PROJECT_STORAGE',
            '저장할 명세 메타를 찾지 못했습니다.',
            input.specId,
          ),
        );
      }

      const existingSpecMeta = existingSpecMetaResult.value;
      if (existingSpecMeta.revision !== input.revision) {
        return err(
          createProjectError(
            'PROJECT_WRITE_CONFLICT',
            '명세가 다른 변경과 충돌했습니다. 다시 불러온 뒤 저장해 주세요.',
          ),
        );
      }

      const now = new Date().toISOString();
      const normalizedTitle = normalizeProjectSpecTitle(input.title);
      const normalizedMarkdown = normalizeProjectSpecMarkdown({
        markdown: input.markdown,
        title: normalizedTitle,
      });
      const summary = input.summary?.trim() || extractProjectSpecSummary(normalizedMarkdown);
      const latestVersion = createNextProjectSpecVersionId(existingSpecMeta.latestVersion);
      const nextSpecMeta = createNextProjectSpecMeta({
        current: existingSpecMeta,
        latestVersion,
        now,
        summary,
        title: normalizedTitle,
      });

      await writeTextAtomically(
        getSpecVersionPath({
          latestVersion,
          rootPath,
          specId: input.specId,
        }),
        normalizedMarkdown,
      );
      await writeJsonAtomically(getSpecMetaPath(rootPath, input.specId), nextSpecMeta);

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
        meta: nextSpecMeta,
        markdown: normalizedMarkdown,
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

      const nextDocumentLayoutsResult = await writeProjectAnalysisDocumentLayouts({
        analysisContextPath,
        documentLayouts: input.documentLayouts,
      });
      if (!nextDocumentLayoutsResult.ok) {
        return nextDocumentLayoutsResult;
      }

      return ok(nextDocumentLayoutsResult.value);
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

function describeUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
