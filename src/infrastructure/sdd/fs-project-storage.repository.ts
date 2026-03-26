import { mkdir, unlink } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import type { ProjectStoragePort } from '@/application/project/project.ports';
import {
  ANALYSIS_FILE_INDEX_SCHEMA_VERSION,
  SPEC_INDEX_SCHEMA_VERSION,
} from '@/domain/project/project-model';
import { type ProjectAnalysisContext } from '@/domain/project/project-analysis-model';
import {
  createEmptyProjectReferenceTagDocument,
  PROJECT_REFERENCE_TAGS_SCHEMA_VERSION,
  sanitizeProjectReferenceTagDocument,
} from '@/domain/project/project-reference-tag-model';
import {
  areProjectSpecRelationsEqual,
  createProjectSpecDocument,
  createNextProjectSpecMetaAfterMetadataUpdate,
  createNextProjectSpecMeta,
  createNextProjectSpecVersionId,
  createDefaultProjectSpecSlug,
  createDefaultProjectSpecTitle,
  createInitialProjectSpecMarkdown,
  createProjectSpecMeta,
  normalizeProjectSpecDraft,
  validateProjectSpecMetadataUpdate,
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
  readProjectSpecVersionDiffDocument,
  readProjectSpecVersionDocument,
  readProjectSpecVersionHistory,
  readProjectSpecVersionIds,
  readSpecMetaDocument,
  readProjectSpecDocuments,
  toProjectSpecIndexEntries,
} from '@/infrastructure/sdd/fs-project-spec-documents';
import {
  getProjectStoragePaths,
  getSpecMetaPath,
  getSpecVersionPath,
} from '@/infrastructure/sdd/fs-project-storage-paths';
import {
  ensureJsonFile,
  ensureTextFile,
  pathExists,
} from '@/infrastructure/sdd/fs-project-storage-io';
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
      const specMarkdown = createInitialProjectSpecMarkdown({
        title,
      });
      const specMeta = createProjectSpecMeta({
        id: slug,
        slug,
        title,
        now,
        draftMarkdown: specMarkdown,
        latestVersion: null,
        currentVersion: null,
        summary: '채팅으로 작성 중인 초안입니다.',
      });

      await writeJsonAtomically(getSpecMetaPath(rootPath, slug), specMeta);

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
        schemaVersion: SPEC_INDEX_SCHEMA_VERSION,
        generatedAt: now,
        specs: toProjectSpecIndexEntries(nextSpecsResult.value),
      });

      return ok({
        projectMeta: nextProjectMeta,
        spec: createProjectSpecDocument(specMeta),
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
        return ok({
          kind: 'conflict',
          latestRevision: existingSpecMeta.revision,
          latestVersionId: existingSpecMeta.latestVersion,
          spec: createProjectSpecDocument(existingSpecMeta),
        });
      }

      const now = new Date().toISOString();
      const normalizedCurrentDraft = normalizeProjectSpecDraft({
        markdown: existingSpecMeta.draftMarkdown,
        title: existingSpecMeta.title,
        summary: existingSpecMeta.summary,
      });
      const normalizedNextDraft = normalizeProjectSpecDraft({
        markdown: input.markdown,
        title: input.title,
        ...(typeof input.summary !== 'undefined' ? { summary: input.summary } : {}),
      });

      if (
        normalizedCurrentDraft.title === normalizedNextDraft.title &&
        normalizedCurrentDraft.markdown === normalizedNextDraft.markdown
      ) {
        return ok({
          kind: 'no-op',
          spec: createProjectSpecDocument(existingSpecMeta),
          versionId: existingSpecMeta.currentVersion,
        });
      }

      const previousVersionId = existingSpecMeta.currentVersion;
      const latestVersion = createNextProjectSpecVersionId(existingSpecMeta.latestVersion);
      const nextSpecMeta = createNextProjectSpecMeta({
        current: existingSpecMeta,
        currentVersion: latestVersion,
        draftMarkdown: normalizedNextDraft.markdown,
        latestVersion,
        now,
        summary: normalizedNextDraft.summary,
        title: normalizedNextDraft.title,
      });

      await writeTextAtomically(
        getSpecVersionPath({
          rootPath,
          specId: input.specId,
          versionId: latestVersion,
        }),
        normalizedNextDraft.markdown,
      );
      await writeJsonAtomically(getSpecMetaPath(rootPath, input.specId), nextSpecMeta);

      const nextSpecsResult = await readProjectSpecDocuments({ rootPath });
      if (!nextSpecsResult.ok) {
        return nextSpecsResult;
      }

      await writeJsonAtomically(specsIndexPath, {
        schemaVersion: SPEC_INDEX_SCHEMA_VERSION,
        generatedAt: now,
        specs: toProjectSpecIndexEntries(nextSpecsResult.value),
      });

      return ok({
        kind: 'saved',
        previousVersionId,
        spec: createProjectSpecDocument(nextSpecMeta),
        versionId: latestVersion,
      });
    },

    async updateProjectSpecMeta(input) {
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
            'project.json 이 없어 명세 메타데이터를 저장할 수 없습니다.',
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
        return ok({
          kind: 'conflict',
          latestRevision: existingSpecMeta.revision,
          latestVersionId: existingSpecMeta.latestVersion,
          spec: createProjectSpecDocument(existingSpecMeta),
        });
      }

      const validationResult = validateProjectSpecMetadataUpdate({
        current: existingSpecMeta,
        status: input.status,
        relations: input.relations,
      });
      if (!validationResult.ok) {
        return err(validationResult.error);
      }

      if (
        existingSpecMeta.status === validationResult.value.status &&
        areProjectSpecRelationsEqual(existingSpecMeta.relations, validationResult.value.relations)
      ) {
        return ok({
          kind: 'no-op',
          spec: createProjectSpecDocument(existingSpecMeta),
        });
      }

      const nextSpecMeta = createNextProjectSpecMetaAfterMetadataUpdate({
        current: existingSpecMeta,
        now: new Date().toISOString(),
        status: validationResult.value.status,
        relations: validationResult.value.relations,
      });

      await writeJsonAtomically(getSpecMetaPath(rootPath, input.specId), nextSpecMeta);
      await rebuildProjectSpecIndex({
        rootPath,
        specsIndexPath,
      });

      return ok({
        kind: 'updated',
        spec: createProjectSpecDocument(nextSpecMeta),
      });
    },

    async readProjectSpecVersionHistory(input) {
      return readProjectSpecVersionHistory({
        rootPath: resolve(input.rootPath),
        specId: input.specId,
      });
    },

    async readProjectSpecVersion(input) {
      return readProjectSpecVersionDocument({
        rootPath: resolve(input.rootPath),
        specId: input.specId,
        versionId: input.versionId,
      });
    },

    async readProjectSpecVersionDiff(input) {
      return readProjectSpecVersionDiffDocument({
        rootPath: resolve(input.rootPath),
        specId: input.specId,
        versionId: input.versionId,
        ...(typeof input.currentMarkdown !== 'undefined'
          ? { currentMarkdown: input.currentMarkdown }
          : {}),
        ...(typeof input.currentTitle !== 'undefined' ? { currentTitle: input.currentTitle } : {}),
      });
    },

    async applyProjectSpecVersion(input) {
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
            'project.json 이 없어 이전 버전을 적용할 수 없습니다.',
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
            '적용할 명세 메타를 찾지 못했습니다.',
            input.specId,
          ),
        );
      }

      const existingSpecMeta = existingSpecMetaResult.value;
      if (existingSpecMeta.revision !== input.revision) {
        return ok({
          kind: 'conflict',
          appliedVersionId: input.versionId,
          latestRevision: existingSpecMeta.revision,
          latestVersionId: existingSpecMeta.latestVersion,
          spec: createProjectSpecDocument(existingSpecMeta),
        });
      }

      const versionDocumentResult = await readProjectSpecVersionDocument({
        rootPath,
        specId: input.specId,
        versionId: input.versionId,
      });
      if (!versionDocumentResult.ok) {
        return versionDocumentResult;
      }

      if (existingSpecMeta.currentVersion === input.versionId) {
        return ok({
          kind: 'no-op',
          appliedVersionId: input.versionId,
          spec: createProjectSpecDocument(existingSpecMeta),
        });
      }

      const normalizedDraft = normalizeProjectSpecDraft({
        markdown: versionDocumentResult.value.markdown,
        title: versionDocumentResult.value.title,
      });
      const nextSpecMeta = createNextProjectSpecMeta({
        current: existingSpecMeta,
        currentVersion: input.versionId,
        draftMarkdown: normalizedDraft.markdown,
        latestVersion: existingSpecMeta.latestVersion,
        now: new Date().toISOString(),
        summary: normalizedDraft.summary,
        title: normalizedDraft.title,
      });

      await writeJsonAtomically(getSpecMetaPath(rootPath, input.specId), nextSpecMeta);
      await rebuildProjectSpecIndex({
        rootPath,
        specsIndexPath,
      });

      return ok({
        kind: 'applied',
        appliedVersionId: input.versionId,
        spec: createProjectSpecDocument(nextSpecMeta),
      });
    },

    async deleteProjectSpecVersion(input) {
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
            'project.json 이 없어 이전 버전을 삭제할 수 없습니다.',
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
            '삭제할 명세 메타를 찾지 못했습니다.',
            input.specId,
          ),
        );
      }

      const existingSpecMeta = existingSpecMetaResult.value;
      if (existingSpecMeta.revision !== input.revision) {
        return ok({
          kind: 'conflict',
          deletedVersionId: input.versionId,
          latestRevision: existingSpecMeta.revision,
          latestVersionId: existingSpecMeta.latestVersion,
          spec: createProjectSpecDocument(existingSpecMeta),
        });
      }

      const versionIdsResult = await readProjectSpecVersionIds({
        rootPath,
        specId: input.specId,
      });
      if (!versionIdsResult.ok) {
        return versionIdsResult;
      }

      if (!versionIdsResult.value.includes(input.versionId)) {
        return err(
          createProjectError('INVALID_PROJECT_STORAGE', '삭제할 버전 파일을 찾지 못했습니다.'),
        );
      }

      if (versionIdsResult.value.length <= 1) {
        return err(
          createProjectError('INVALID_PROJECT_STORAGE', '유일한 저장 버전은 삭제할 수 없습니다.'),
        );
      }

      if (
        existingSpecMeta.latestVersion === input.versionId ||
        existingSpecMeta.currentVersion === input.versionId
      ) {
        return err(
          createProjectError(
            'INVALID_PROJECT_STORAGE',
            '현재 기준 버전이나 최신 저장 버전은 삭제할 수 없습니다.',
          ),
        );
      }

      await unlink(
        getSpecVersionPath({
          rootPath,
          specId: input.specId,
          versionId: input.versionId,
        }),
      );
      await rebuildProjectSpecIndex({
        rootPath,
        specsIndexPath,
      });

      const historyResult = await readProjectSpecVersionHistory({
        rootPath,
        specId: input.specId,
      });
      if (!historyResult.ok) {
        return historyResult;
      }

      return ok({
        kind: 'deleted',
        deletedVersionId: input.versionId,
        history: historyResult.value,
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
            schemaVersion: SPEC_INDEX_SCHEMA_VERSION,
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

async function rebuildProjectSpecIndex(input: {
  rootPath: string;
  specsIndexPath: string;
}): Promise<void> {
  const specsResult = await readProjectSpecDocuments({
    rootPath: input.rootPath,
  });
  if (!specsResult.ok) {
    throw new Error(specsResult.error.message);
  }

  await writeJsonAtomically(input.specsIndexPath, {
    schemaVersion: SPEC_INDEX_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    specs: toProjectSpecIndexEntries(specsResult.value),
  });
}
