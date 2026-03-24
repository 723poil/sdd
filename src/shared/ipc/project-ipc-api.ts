import type {
  ProjectAnalysis,
  ProjectAnalysisDocumentLayoutMap,
  ProjectAnalysisRunStatus,
} from '@/domain/project/project-analysis-model';
import type { ProjectInspection, RecentProject } from '@/domain/project/project-model';
import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
import type {
  ProjectSessionMessage,
  ProjectSessionMeta,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';
import type { RendererProjectApi } from '@/shared/ipc/project-ipc';
import type { Result } from '@/shared/contracts/result';
import type {
  ActivateProjectInput,
  ActivateProjectOutput,
  AnalyzeProjectInput,
  AnalyzeProjectOutput,
  CancelProjectAnalysisInput,
  CreateProjectSessionInput,
  CreateProjectSpecInput,
  CreateProjectSpecOutput,
  InspectProjectInput,
  ListProjectSessionsInput,
  ReadProjectAnalysisInput,
  ReadProjectAnalysisRunStatusInput,
  ReadProjectSessionMessagesInput,
  ReadProjectSpecsInput,
  ReorderRecentProjectsInput,
  SaveProjectAnalysisDocumentLayoutsInput,
  SelectProjectDirectoryOutput,
  SendProjectSessionMessageInput,
  SendProjectSessionMessageOutput,
} from '@/shared/ipc/project-ipc';
import { projectIpcChannels } from '@/shared/ipc/project-ipc';
import {
  bindIpcInvoke0,
  bindIpcInvoke1,
  type IpcRendererInvoke,
} from '@/shared/ipc/ipc-bridge';

export function createRendererProjectApi(
  invoke: IpcRendererInvoke['invoke'],
): RendererProjectApi {
  return {
    selectDirectory: bindIpcInvoke0<Result<SelectProjectDirectoryOutput>>(
      invoke,
      projectIpcChannels.selectDirectory,
    ),
    inspect: bindIpcInvoke1<InspectProjectInput, Result<ProjectInspection>>(
      invoke,
      projectIpcChannels.inspect,
    ),
    listRecentProjects: bindIpcInvoke0<Result<RecentProject[]>>(
      invoke,
      projectIpcChannels.listRecentProjects,
    ),
    activate: bindIpcInvoke1<ActivateProjectInput, Result<ActivateProjectOutput>>(
      invoke,
      projectIpcChannels.activate,
    ),
    reorderRecentProjects: bindIpcInvoke1<ReorderRecentProjectsInput, Result<RecentProject[]>>(
      invoke,
      projectIpcChannels.reorderRecentProjects,
    ),
    readAnalysis: bindIpcInvoke1<ReadProjectAnalysisInput, Result<ProjectAnalysis | null>>(
      invoke,
      projectIpcChannels.readAnalysis,
    ),
    saveAnalysisDocumentLayouts: bindIpcInvoke1<
      SaveProjectAnalysisDocumentLayoutsInput,
      Result<ProjectAnalysisDocumentLayoutMap>
    >(invoke, projectIpcChannels.saveAnalysisDocumentLayouts),
    readSpecs: bindIpcInvoke1<ReadProjectSpecsInput, Result<ProjectSpecDocument[]>>(
      invoke,
      projectIpcChannels.readSpecs,
    ),
    createSpec: bindIpcInvoke1<CreateProjectSpecInput, Result<CreateProjectSpecOutput>>(
      invoke,
      projectIpcChannels.createSpec,
    ),
    readAnalysisRunStatus: bindIpcInvoke1<
      ReadProjectAnalysisRunStatusInput,
      Result<ProjectAnalysisRunStatus>
    >(
      invoke,
      projectIpcChannels.readAnalysisRunStatus,
    ),
    analyze: bindIpcInvoke1<AnalyzeProjectInput, Result<AnalyzeProjectOutput>>(
      invoke,
      projectIpcChannels.analyze,
    ),
    cancelAnalysis: bindIpcInvoke1<CancelProjectAnalysisInput, Result<ProjectAnalysisRunStatus>>(
      invoke,
      projectIpcChannels.cancelAnalysis,
    ),
    listSessions: bindIpcInvoke1<ListProjectSessionsInput, Result<ProjectSessionSummary[]>>(
      invoke,
      projectIpcChannels.listSessions,
    ),
    createSession: bindIpcInvoke1<CreateProjectSessionInput, Result<ProjectSessionMeta>>(
      invoke,
      projectIpcChannels.createSession,
    ),
    readSessionMessages: bindIpcInvoke1<
      ReadProjectSessionMessagesInput,
      Result<ProjectSessionMessage[]>
    >(
      invoke,
      projectIpcChannels.readSessionMessages,
    ),
    sendSessionMessage: bindIpcInvoke1<
      SendProjectSessionMessageInput,
      Result<SendProjectSessionMessageOutput>
    >(
      invoke,
      projectIpcChannels.sendSessionMessage,
    ),
  };
}
