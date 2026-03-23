import { constants } from 'node:fs';
import { access, mkdir, readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import type { ProjectStoragePort } from '@/application/project/project.ports';
import type { ProjectAnalysis } from '@/domain/project/project-analysis-model';
import { isProjectAnalysisContext } from '@/domain/project/project-analysis-model';
import { createProjectError } from '@/domain/project/project-errors';
import { PROJECT_SESSION_INDEX_SCHEMA_VERSION } from '@/domain/project/project-session-model';
import {
  ANALYSIS_CONTEXT_SCHEMA_VERSION,
  SPEC_INDEX_SCHEMA_VERSION,
  createInitialProjectMeta,
  isProjectMeta,
  type ProjectMeta,
} from '@/domain/project/project-model';
import { err, ok } from '@/shared/contracts/result';

import { writeJsonAtomically, writeTextAtomically } from '@/infrastructure/fs/write-json-atomically';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureJsonFile(filePath: string, value: unknown): Promise<void> {
  if (await pathExists(filePath)) {
    return;
  }

  await writeJsonAtomically(filePath, value);
}

async function ensureTextFile(filePath: string, content: string): Promise<void> {
  if (await pathExists(filePath)) {
    return;
  }

  await writeTextAtomically(filePath, content);
}

export function createFsProjectStorageRepository(): ProjectStoragePort {
  return {
    async readProjectMeta(input) {
      const rootPath = resolve(input.rootPath);
      const { projectJsonPath, sddDirectoryPath } = getProjectStoragePaths(rootPath);

      if (!(await pathExists(sddDirectoryPath))) {
        return ok(null);
      }

      if (!(await pathExists(projectJsonPath))) {
        return ok(null);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(await readFile(projectJsonPath, 'utf8')) as unknown;
      } catch {
        return err(
          createProjectError(
            'INVALID_PROJECT_STORAGE',
            'project.json 을 읽거나 파싱할 수 없습니다.',
            projectJsonPath,
          ),
        );
      }

      if (!isProjectMeta(parsed)) {
        return err(
          createProjectError(
            'INVALID_PROJECT_STORAGE',
            'project.json 이 현재 schemaVersion 계약을 만족하지 않습니다.',
            projectJsonPath,
          ),
        );
      }

      return ok(parsed);
    },

    async readProjectAnalysis(input) {
      const rootPath = resolve(input.rootPath);
      const { analysisContextPath, analysisSummaryPath, sddDirectoryPath } =
        getProjectStoragePaths(rootPath);

      if (!(await pathExists(sddDirectoryPath))) {
        return ok(null);
      }

      if (!(await pathExists(analysisContextPath)) || !(await pathExists(analysisSummaryPath))) {
        return ok(null);
      }

      let contextValue: unknown;
      try {
        contextValue = JSON.parse(await readFile(analysisContextPath, 'utf8')) as unknown;
      } catch {
        return err(
          createProjectError(
            'INVALID_PROJECT_STORAGE',
            'analysis/context.json 을 읽거나 파싱할 수 없습니다.',
            analysisContextPath,
          ),
        );
      }

      if (!isProjectAnalysisContext(contextValue)) {
        return err(
          createProjectError(
            'INVALID_PROJECT_STORAGE',
            'analysis/context.json 이 현재 schemaVersion 계약을 만족하지 않습니다.',
            analysisContextPath,
          ),
        );
      }

      let summaryMarkdown = '';
      try {
        summaryMarkdown = await readFile(analysisSummaryPath, 'utf8');
      } catch {
        return err(
          createProjectError(
            'INVALID_PROJECT_STORAGE',
            'analysis/summary.md 를 읽을 수 없습니다.',
            analysisSummaryPath,
          ),
        );
      }

      return ok({
        context: contextValue,
        summaryMarkdown,
      } satisfies ProjectAnalysis);
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

      await ensureJsonFile(analysisContextPath, {
        schemaVersion: ANALYSIS_CONTEXT_SCHEMA_VERSION,
        files: [],
        directories: [],
        detectedFrameworks: [],
        entrypoints: [],
        keyConfigs: [],
        modules: [],
        unknowns: [],
        confidence: 0,
      });

      await ensureTextFile(
        analysisSummaryPath,
        [
          `# ${projectName}`,
          '',
          '## 프로젝트 개요',
          '',
          '- 아직 분석 기록이 없습니다.',
          '',
          '## 다음 단계',
          '',
          '- 기본 분석 실행',
          '- 스택 감지',
          '- 명세 초안 생성',
          '',
        ].join('\n'),
      );

      await ensureJsonFile(specsIndexPath, {
        schemaVersion: SPEC_INDEX_SCHEMA_VERSION,
        generatedAt: now,
        specs: [],
      });

      await ensureJsonFile(sessionsIndexPath, {
        schemaVersion: PROJECT_SESSION_INDEX_SCHEMA_VERSION,
        generatedAt: now,
        sessions: [],
      });

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
        analysisSummaryPath,
        projectJsonPath,
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

      const now = new Date().toISOString();
      const nextProjectMeta = createUpdatedProjectMeta({
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

function createUpdatedProjectMeta(input: {
  current: ProjectMeta;
  detectedStack: string[];
  now: string;
}): ProjectMeta {
  return {
    ...input.current,
    updatedAt: input.now,
    revision: input.current.revision + 1,
    lastAnalyzedAt: input.now,
    detectedStack: input.detectedStack,
  };
}

function getProjectStoragePaths(rootPath: string) {
  const sddDirectoryPath = join(rootPath, '.sdd');
  const analysisDirectoryPath = join(sddDirectoryPath, 'analysis');
  const specsDirectoryPath = join(sddDirectoryPath, 'specs');
  const runsDirectoryPath = join(sddDirectoryPath, 'runs');

  return {
    sddDirectoryPath,
    analysisDirectoryPath,
    sessionsDirectoryPath: join(sddDirectoryPath, 'sessions'),
    specsDirectoryPath,
    runsDirectoryPath,
    projectJsonPath: join(sddDirectoryPath, 'project.json'),
    analysisContextPath: join(analysisDirectoryPath, 'context.json'),
    analysisSummaryPath: join(analysisDirectoryPath, 'summary.md'),
    sessionsIndexPath: join(sddDirectoryPath, 'sessions', 'index.json'),
    specsIndexPath: join(specsDirectoryPath, 'index.json'),
  };
}
