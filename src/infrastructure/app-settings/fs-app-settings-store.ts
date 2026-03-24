import { mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  APP_SETTINGS_SCHEMA_VERSION,
  createAgentCliConnectionSettings,
  type AgentCliConnectionSettings,
  type AgentCliModelReasoningEffort,
  isAgentCliModelReasoningEffort,
  isAgentCliConnectionSettings,
} from '@/domain/app-settings/agent-cli-connection-model';
import type { RecentProject } from '@/domain/project/project-model';
import { err, ok, type Result } from '@/shared/contracts/result';

import { writeJsonAtomically } from '@/infrastructure/fs/write-json-atomically';

const LEGACY_APP_SETTINGS_SCHEMA_VERSION = 1;
const PREVIOUS_APP_SETTINGS_SCHEMA_VERSION = 2;

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
    [
      LEGACY_APP_SETTINGS_SCHEMA_VERSION,
      PREVIOUS_APP_SETTINGS_SCHEMA_VERSION,
      APP_SETTINGS_SCHEMA_VERSION,
    ].includes(candidate.schemaVersion) &&
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
  defaults?: {
    codexModel?: string | null;
    codexModelReasoningEffort?: AgentCliModelReasoningEffort | null;
  },
): AgentCliConnectionSettings[] {
  const latestConnectionMap = new Map(
    connections.map((connection) => {
      const rawConnection = connection as Partial<AgentCliConnectionSettings>;
      const normalizedModel =
        connection.agentId === 'codex'
          ? rawConnection.model ?? defaults?.codexModel
          : rawConnection.model;
      const normalizedModelReasoningEffort =
        connection.agentId === 'codex'
          ? rawConnection.modelReasoningEffort ?? defaults?.codexModelReasoningEffort
          : rawConnection.modelReasoningEffort;

      return [
        connection.agentId,
        createAgentCliConnectionSettings({
          ...connection,
          ...(typeof normalizedModel !== 'undefined' ? { model: normalizedModel } : {}),
          ...(typeof normalizedModelReasoningEffort !== 'undefined'
            ? { modelReasoningEffort: normalizedModelReasoningEffort }
            : {}),
        }),
      ];
    }),
  );

  return [...latestConnectionMap.values()];
}

export async function readCodexCliConfigDefaults(): Promise<{
  model: string | null;
  modelReasoningEffort: AgentCliModelReasoningEffort | null;
}> {
  try {
    const configText = await readFile(join(homedir(), '.codex', 'config.toml'), 'utf8');
    const model = readTomlStringValue(configText, 'model');
    const rawReasoningEffort = readTomlStringValue(configText, 'model_reasoning_effort');

    return {
      model,
      modelReasoningEffort: isAgentCliModelReasoningEffort(rawReasoningEffort)
        ? rawReasoningEffort
        : null,
    };
  } catch {
    return {
      model: null,
      modelReasoningEffort: null,
    };
  }
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

    const codexDefaults = await readCodexCliConfigDefaults();

    return ok({
      schemaVersion: APP_SETTINGS_SCHEMA_VERSION,
      recentProjects: normalizeRecentProjects(rawRecentProjects),
      agentCliConnections: normalizeAgentCliConnections(rawAgentCliConnections, {
        codexModel: codexDefaults.model,
        codexModelReasoningEffort: codexDefaults.modelReasoningEffort,
      }),
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

function readTomlStringValue(source: string, key: string): string | null {
  const match = source.match(new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*"([^"]*)"\\s*$`, 'm'));
  if (!match) {
    return null;
  }

  return match[1] ?? null;
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
