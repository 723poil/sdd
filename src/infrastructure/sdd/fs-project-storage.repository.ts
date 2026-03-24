import { basename, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

import type { ProjectStoragePort } from '@/application/project/project.ports';
import { createProjectError } from '@/domain/project/project-errors';
import {
  createInitialProjectMeta,
  createNextProjectMetaAfterAnalysis,
} from '@/domain/project/project-model';
import { err, ok } from '@/shared/contracts/result';

import {
  createInitialProjectStorageDocuments,
  readProjectAnalysisDocument,
  readProjectMetaDocument,
} from '@/infrastructure/sdd/fs-project-storage-documents';
import { getProjectStoragePaths } from '@/infrastructure/sdd/fs-project-storage-paths';
import { ensureJsonFile, ensureTextFile } from '@/infrastructure/sdd/fs-project-storage-io';
import { pathExists } from '@/infrastructure/sdd/fs-project-storage-io';
import { writeJsonAtomically, writeTextAtomically } from '@/infrastructure/fs/write-json-atomically';

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

    async initializeStorage(input) {
      const rootPath = resolve(input.rootPath);
      const projectName = basename(rootPath);
      const now = new Date().toISOString();

      const {
        analysisContextPath,
        analysisDirectoryPath,
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
      const { analysisContextPath, analysisSummaryPath, projectJsonPath } =
        getProjectStoragePaths(rootPath);

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

      const now = new Date().toISOString();
      const nextProjectMeta = createNextProjectMetaAfterAnalysis({
        current: existingProjectMeta,
        detectedStack: input.analysis.detectedStack,
        now,
      });

      await writeJsonAtomically(analysisContextPath, input.analysis.context);
      await writeTextAtomically(analysisSummaryPath, input.analysis.summaryMarkdown);
      await writeJsonAtomically(projectJsonPath, nextProjectMeta);

      return ok({
        analysis: {
          context: input.analysis.context,
          summaryMarkdown: input.analysis.summaryMarkdown,
        },
        projectMeta: nextProjectMeta,
      });
    },
  };
}
