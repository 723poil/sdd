import { mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { AgentCliConnectionSettings } from '@/domain/app-settings/agent-cli-connection-model';
import {
  APP_SETTINGS_SCHEMA_VERSION,
  isAgentCliConnectionSettings,
} from '@/domain/app-settings/agent-cli-connection-model';
import type { RecentProject } from '@/domain/project/project-model';
import { err, ok, type Result } from '@/shared/contracts/result';

import { writeJsonAtomically } from '@/infrastructure/fs/write-json-atomically';

const LEGACY_APP_SETTINGS_SCHEMA_VERSION = 1;

export interface AppSettingsDocument {
  schemaVersion: typeof APP_SETTINGS_SCHEMA_VERSION;
  recentProjects: RecentProject[];
  agentCliConnections: AgentCliConnectionSettings[];
}

interface RawRecentProject {
  rootPath: string;
  projectName: string;
  lastOpenedAt: string;
  sortOrder?: number;
}

function getSettingsDirectoryPath(): string {
  return join(homedir(), '.sdd-app');
}

export function getAppSettingsFilePath(): string {
  return join(getSettingsDirectoryPath(), 'settings.json');
}

function isRawRecentProject(value: unknown): value is RawRecentProject {
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

function isAppSettingsDocumentCandidate(
  value: unknown,
): value is {
  schemaVersion: number;
  recentProjects?: unknown;
  agentCliConnections?: unknown;
} {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.schemaVersion === 'number' &&
    [LEGACY_APP_SETTINGS_SCHEMA_VERSION, APP_SETTINGS_SCHEMA_VERSION].includes(
      candidate.schemaVersion,
    ) &&
    (typeof candidate.recentProjects === 'undefined' || Array.isArray(candidate.recentProjects)) &&
    (typeof candidate.agentCliConnections === 'undefined' ||
      Array.isArray(candidate.agentCliConnections))
  );
}

export function normalizeRecentProjects(projects: RawRecentProject[]): RecentProject[] {
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

function normalizeAgentCliConnections(
  connections: AgentCliConnectionSettings[],
): AgentCliConnectionSettings[] {
  const latestConnectionMap = new Map(
    connections.map((connection) => [connection.agentId, connection]),
  );

  return [...latestConnectionMap.values()];
}

export async function readAppSettingsDocument(): Promise<Result<AppSettingsDocument>> {
  try {
    const parsed = JSON.parse(await readFile(getAppSettingsFilePath(), 'utf8')) as unknown;

    if (!isAppSettingsDocumentCandidate(parsed)) {
      return err({
        code: 'INVALID_APP_SETTINGS',
        message: '앱 전역 설정 파일 형식이 올바르지 않습니다.',
      });
    }

    const rawRecentProjects = Array.isArray(parsed.recentProjects) ? parsed.recentProjects : [];
    const rawAgentCliConnections = Array.isArray(parsed.agentCliConnections)
      ? parsed.agentCliConnections
      : [];

    if (
      !rawRecentProjects.every((item) => isRawRecentProject(item)) ||
      !rawAgentCliConnections.every((item) => isAgentCliConnectionSettings(item))
    ) {
      return err({
        code: 'INVALID_APP_SETTINGS',
        message: '앱 전역 설정 파일 형식이 올바르지 않습니다.',
      });
    }

    return ok({
      schemaVersion: APP_SETTINGS_SCHEMA_VERSION,
      recentProjects: normalizeRecentProjects(rawRecentProjects),
      agentCliConnections: normalizeAgentCliConnections(rawAgentCliConnections),
    });
  } catch (error) {
    const isMissingFile =
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT';

    if (isMissingFile) {
      return ok({
        schemaVersion: APP_SETTINGS_SCHEMA_VERSION,
        recentProjects: [],
        agentCliConnections: [],
      });
    }

    return err({
      code: 'INVALID_APP_SETTINGS',
      message: '앱 전역 설정 파일을 읽지 못했습니다.',
    });
  }
}

export async function writeAppSettingsDocument(
  document: Omit<AppSettingsDocument, 'schemaVersion'>,
): Promise<void> {
  await mkdir(getSettingsDirectoryPath(), { recursive: true });
  await writeJsonAtomically(getAppSettingsFilePath(), {
    schemaVersion: APP_SETTINGS_SCHEMA_VERSION,
    recentProjects: normalizeRecentProjects(document.recentProjects),
    agentCliConnections: normalizeAgentCliConnections(document.agentCliConnections),
  });
}
