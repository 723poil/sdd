import type { RecentProjectsStorePort } from '@/application/project/project.ports';
import { normalizeProjectName } from '@/domain/project/project-model';
import { ok } from '@/shared/contracts/result';

import {
  readAppSettingsDocument,
  writeAppSettingsDocument,
} from '@/infrastructure/app-settings/fs-app-settings-store';

export function createFsRecentProjectsRepository(): RecentProjectsStorePort {
  return {
    async listRecentProjects() {
      const settingsDocumentResult = await readAppSettingsDocument();
      if (!settingsDocumentResult.ok) {
        return settingsDocumentResult;
      }

      return ok(settingsDocumentResult.value.recentProjects);
    },

    async upsertRecentProject(input) {
      const settingsDocumentResult = await readAppSettingsDocument();
      if (!settingsDocumentResult.ok) {
        return settingsDocumentResult;
      }

      const existingProject = settingsDocumentResult.value.recentProjects.find(
        (project) => project.rootPath === input.rootPath,
      );
      const nextRecentProjects = existingProject
        ? settingsDocumentResult.value.recentProjects.map((project) =>
            project.rootPath === input.rootPath
              ? {
                  ...project,
                  projectName: input.projectName,
                  lastOpenedAt: new Date().toISOString(),
                }
              : project,
          )
        : [
            ...settingsDocumentResult.value.recentProjects,
            {
              rootPath: input.rootPath,
              projectName: input.projectName,
              lastOpenedAt: new Date().toISOString(),
              sortOrder: settingsDocumentResult.value.recentProjects.length,
            },
          ].slice(0, 12);

      await writeAppSettingsDocument({
        selectedAgentId: settingsDocumentResult.value.selectedAgentId,
        recentProjects: nextRecentProjects,
        agentCliConnections: settingsDocumentResult.value.agentCliConnections,
      });

      return ok(undefined);
    },

    async renameRecentProject(input) {
      const settingsDocumentResult = await readAppSettingsDocument();
      if (!settingsDocumentResult.ok) {
        return settingsDocumentResult;
      }

      const normalizedProjectName = normalizeProjectName(input.projectName);
      const didMatchProject = settingsDocumentResult.value.recentProjects.some(
        (project) => project.rootPath === input.rootPath,
      );

      if (!didMatchProject) {
        return {
          ok: false,
          error: {
            code: 'INVALID_APP_SETTINGS',
            message: '이름을 변경할 최근 프로젝트를 찾지 못했습니다.',
          },
        };
      }

      const nextRecentProjects = settingsDocumentResult.value.recentProjects.map((project) =>
        project.rootPath === input.rootPath
          ? {
              ...project,
              projectName: normalizedProjectName,
            }
          : project,
      );

      await writeAppSettingsDocument({
        selectedAgentId: settingsDocumentResult.value.selectedAgentId,
        recentProjects: nextRecentProjects,
        agentCliConnections: settingsDocumentResult.value.agentCliConnections,
      });

      return ok(nextRecentProjects);
    },

    async removeRecentProject(input) {
      const settingsDocumentResult = await readAppSettingsDocument();
      if (!settingsDocumentResult.ok) {
        return settingsDocumentResult;
      }

      const nextRecentProjects = settingsDocumentResult.value.recentProjects.filter(
        (project) => project.rootPath !== input.rootPath,
      );

      if (nextRecentProjects.length === settingsDocumentResult.value.recentProjects.length) {
        return {
          ok: false,
          error: {
            code: 'INVALID_APP_SETTINGS',
            message: '제거할 최근 프로젝트를 찾지 못했습니다.',
          },
        };
      }

      await writeAppSettingsDocument({
        selectedAgentId: settingsDocumentResult.value.selectedAgentId,
        recentProjects: nextRecentProjects,
        agentCliConnections: settingsDocumentResult.value.agentCliConnections,
      });

      return ok(nextRecentProjects);
    },

    async reorderRecentProjects(input) {
      const settingsDocumentResult = await readAppSettingsDocument();
      if (!settingsDocumentResult.ok) {
        return settingsDocumentResult;
      }

      const currentProjects = settingsDocumentResult.value.recentProjects;
      const currentRootPaths = currentProjects.map((project) => project.rootPath);
      const nextRootPaths = input.rootPaths;
      const hasSameLength = currentRootPaths.length === nextRootPaths.length;
      const hasSameItems =
        hasSameLength &&
        currentRootPaths.every((rootPath) => nextRootPaths.includes(rootPath)) &&
        nextRootPaths.every((rootPath) => currentRootPaths.includes(rootPath));

      if (!hasSameItems) {
        return {
          ok: false,
          error: {
            code: 'INVALID_APP_SETTINGS',
            message: '최근 프로젝트 순서를 저장하는 중 목록이 맞지 않았습니다.',
          },
        };
      }

      const projectMap = new Map(currentProjects.map((project) => [project.rootPath, project]));
      const reorderedProjects = nextRootPaths.map((rootPath, index) => ({
        ...projectMap.get(rootPath)!,
        sortOrder: index,
      }));

      await writeAppSettingsDocument({
        selectedAgentId: settingsDocumentResult.value.selectedAgentId,
        recentProjects: reorderedProjects,
        agentCliConnections: settingsDocumentResult.value.agentCliConnections,
      });

      return ok(reorderedProjects);
    },
  };
}
