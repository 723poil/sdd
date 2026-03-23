import { mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { RecentProjectsStorePort } from '@/application/project/project.ports';
import {
  APP_SETTINGS_SCHEMA_VERSION,
  type RecentProject,
} from '@/domain/project/project-model';
import { err, ok } from '@/shared/contracts/result';

import { writeJsonAtomically } from '@/infrastructure/fs/write-json-atomically';

interface AppSettingsFile {
  schemaVersion: typeof APP_SETTINGS_SCHEMA_VERSION;
  recentProjects: RawRecentProject[];
}

interface RawRecentProject {
  rootPath: string;
  projectName: string;
  lastOpenedAt: string;
  sortOrder?: number;
}

function getSettingsFilePath(): string {
  return join(homedir(), '.sdd-app', 'settings.json');
}

function isRecentProject(value: unknown): value is RawRecentProject {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.rootPath === 'string' &&
    typeof candidate.projectName === 'string' &&
    typeof candidate.lastOpenedAt === 'string' &&
    (typeof candidate.sortOrder === 'number' || typeof candidate.sortOrder === 'undefined')
  );
}

function isAppSettingsFile(value: unknown): value is AppSettingsFile {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.schemaVersion === APP_SETTINGS_SCHEMA_VERSION &&
    Array.isArray(candidate.recentProjects) &&
    candidate.recentProjects.every((item) => isRecentProject(item))
  );
}

function normalizeRecentProjects(projects: RawRecentProject[]): RecentProject[] {
  return [...projects]
    .map((project, index) => ({
      rootPath: project.rootPath,
      projectName: project.projectName,
      lastOpenedAt: project.lastOpenedAt,
      sortOrder: typeof project.sortOrder === 'number' ? project.sortOrder : index,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((project, index) => ({
      ...project,
      sortOrder: index,
    }));
}

export function createFsRecentProjectsRepository(): RecentProjectsStorePort {
  return {
    async listRecentProjects() {
      const settingsFilePath = getSettingsFilePath();

      try {
        const parsed = JSON.parse(await readFile(settingsFilePath, 'utf8')) as unknown;

        if (!isAppSettingsFile(parsed)) {
          return err({
            code: 'INVALID_APP_SETTINGS',
            message: '앱 전역 recent projects 설정 파일 형식이 올바르지 않습니다.',
          });
        }

        return ok(normalizeRecentProjects(parsed.recentProjects));
      } catch (error) {
        const isMissingFile =
          error instanceof Error &&
          'code' in error &&
          (error as NodeJS.ErrnoException).code === 'ENOENT';

        if (isMissingFile) {
          return ok([]);
        }

        return err({
          code: 'INVALID_APP_SETTINGS',
          message: '앱 전역 recent projects 설정 파일을 읽지 못했습니다.',
        });
      }
    },

    async upsertRecentProject(input) {
      const currentSettingsResult = await this.listRecentProjects();
      if (!currentSettingsResult.ok) {
        return currentSettingsResult;
      }

      const existingProject = currentSettingsResult.value.find(
        (project) => project.rootPath === input.rootPath,
      );

      const nextRecentProjects = existingProject
        ? currentSettingsResult.value.map((project) =>
            project.rootPath === input.rootPath
              ? {
                  ...project,
                  projectName: input.projectName,
                  lastOpenedAt: new Date().toISOString(),
                }
              : project,
          )
        : [
            ...currentSettingsResult.value,
            {
              rootPath: input.rootPath,
              projectName: input.projectName,
              lastOpenedAt: new Date().toISOString(),
              sortOrder: currentSettingsResult.value.length,
            },
          ].slice(0, 12);

      const settingsFilePath = getSettingsFilePath();

      await mkdir(join(homedir(), '.sdd-app'), { recursive: true });
      await writeJsonAtomically(settingsFilePath, {
        schemaVersion: APP_SETTINGS_SCHEMA_VERSION,
        recentProjects: normalizeRecentProjects(nextRecentProjects),
      });

      return ok(undefined);
    },

    async reorderRecentProjects(input) {
      const currentSettingsResult = await this.listRecentProjects();
      if (!currentSettingsResult.ok) {
        return currentSettingsResult;
      }

      const currentProjects = currentSettingsResult.value;
      const currentRootPaths = currentProjects.map((project) => project.rootPath);
      const nextRootPaths = input.rootPaths;

      const hasSameLength = currentRootPaths.length === nextRootPaths.length;
      const hasSameItems =
        hasSameLength &&
        currentRootPaths.every((rootPath) => nextRootPaths.includes(rootPath)) &&
        nextRootPaths.every((rootPath) => currentRootPaths.includes(rootPath));

      if (!hasSameItems) {
        return err({
          code: 'INVALID_APP_SETTINGS',
          message: '최근 프로젝트 순서를 저장하는 중 목록이 맞지 않았습니다.',
        });
      }

      const projectMap = new Map(currentProjects.map((project) => [project.rootPath, project]));
      const reorderedProjects = nextRootPaths.map((rootPath, index) => ({
        ...projectMap.get(rootPath)!,
        sortOrder: index,
      }));

      const settingsFilePath = getSettingsFilePath();

      await mkdir(join(homedir(), '.sdd-app'), { recursive: true });
      await writeJsonAtomically(settingsFilePath, {
        schemaVersion: APP_SETTINGS_SCHEMA_VERSION,
        recentProjects: reorderedProjects,
      });

      return ok(reorderedProjects);
    },
  };
}
