import type {
  AgentCliConnectionSettings,
} from '@/domain/app-settings/agent-cli-connection-model';
import { createDefaultAgentCliConnectionSettings } from '@/domain/app-settings/agent-cli-connection-model';
import type {
  ProjectAnalysis,
  ProjectAnalysisRunStatus,
} from '@/domain/project/project-analysis-model';
import type { ProjectInspection } from '@/domain/project/project-model';
import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
import type { ProjectSessionSummary } from '@/domain/project/project-session-model';
import { err, ok, type Result } from '@/shared/contracts/result';
import { getRendererSddApi } from '@/renderer/renderer-sdd-api';

export interface ProjectWorkspaceSnapshot {
  analysis: ProjectAnalysis | null;
  sessions: ProjectSessionSummary[];
  specs: ProjectSpecDocument[];
}

export function createEmptyProjectWorkspaceSnapshot(): ProjectWorkspaceSnapshot {
  return {
    analysis: null,
    sessions: [],
    specs: [],
  };
}

export async function readProjectWorkspaceSnapshot(input: {
  inspection: ProjectInspection;
  rootPath: string;
}): Promise<Result<ProjectWorkspaceSnapshot>> {
  const sddApi = getRendererSddApi();
  if (!sddApi) {
    return err({
      code: 'IPC_UNAVAILABLE',
      message: '앱 연결 상태를 확인할 수 없습니다.',
    });
  }

  if (input.inspection.initializationState !== 'ready') {
    return ok(createEmptyProjectWorkspaceSnapshot());
  }

  const [analysisResult, specsResult, sessionsResult] = await Promise.all([
    sddApi.project.readAnalysis({
      rootPath: input.rootPath,
    }),
    sddApi.project.readSpecs({
      rootPath: input.rootPath,
    }),
    sddApi.project.listSessions({
      rootPath: input.rootPath,
    }),
  ]);

  if (!analysisResult.ok) {
    return err(analysisResult.error);
  }

  if (!specsResult.ok) {
    return err(specsResult.error);
  }

  if (!sessionsResult.ok) {
    return err(sessionsResult.error);
  }

  return ok({
    analysis: analysisResult.value,
    specs: specsResult.value,
    sessions: sessionsResult.value,
  });
}

export async function readAnalysisRunStatus(rootPath: string): Promise<ProjectAnalysisRunStatus | null> {
  const sddApi = getRendererSddApi();
  if (!sddApi) {
    return null;
  }

  const result = await sddApi.project.readAnalysisRunStatus({
    rootPath,
  });
  if (!result.ok) {
    return null;
  }

  return result.value;
}

export async function readCodexConnectionSettings(): Promise<
  { ok: true; value: AgentCliConnectionSettings } | { ok: false }
> {
  const sddApi = getRendererSddApi();
  if (!sddApi) {
    return { ok: false };
  }

  const result = await sddApi.settings.listAgentCliConnections();
  if (!result.ok) {
    return { ok: false };
  }

  return {
    ok: true,
    value:
      result.value.find((connection) => connection.definition.agentId === 'codex')?.settings ??
      createDefaultAgentCliConnectionSettings('codex'),
  };
}
