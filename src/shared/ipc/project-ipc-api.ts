import type {
  ProjectAnalysis,
  ProjectAnalysisDocumentLayoutMap,
  ProjectAnalysisRunStatus,
} from '@/domain/project/project-analysis-model';
import type { ProjectInspection, RecentProject } from '@/domain/project/project-model';
import type { ProjectReferenceTagDocument } from '@/domain/project/project-reference-tag-model';
import type {
  ProjectSpecDocument,
  ProjectSpecMetaUpdateResult,
  ProjectSpecSaveResult,
  ProjectSpecVersionDiff,
  ProjectSpecVersionDocument,
  ProjectSpecVersionHistoryEntry,
  ProjectSpecApplyVersionResult,
  ProjectSpecDeleteVersionResult,
} from '@/domain/project/project-spec-model';
import type {
  ProjectSessionMessage,
  ProjectSessionMessageRunStatus,
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
  CancelProjectReferenceTagGenerationInput,
  CreateProjectSessionInput,
  CreateProjectSpecInput,
  CreateProjectSpecOutput,
  GenerateProjectReferenceTagsInput,
  InspectProjectInput,
  ListProjectSessionsInput,
  RemoveRecentProjectInput,
  ReadProjectAnalysisInput,
  ReadProjectAnalysisRunStatusInput,
  ReadProjectSessionMessageRunStatusInput,
  ReadProjectSessionMessagesInput,
  ReadProjectSpecsInput,
  RenameProjectInput,
  RenameProjectOutput,
  ReorderRecentProjectsInput,
  SaveProjectSpecInput,
  UpdateProjectSpecMetaInput,
  SaveProjectAnalysisDocumentLayoutsInput,
  SaveProjectReferenceTagsInput,
  SelectProjectDirectoryOutput,
  CancelProjectSessionMessageInput,
  ApplyProjectSpecVersionInput,
  DeleteProjectSpecVersionInput,
  ReadProjectSpecVersionDiffInput,
  ReadProjectSpecVersionHistoryInput,
  ReadProjectSpecVersionInput,
  SendProjectSessionMessageInput,
  SendProjectSessionMessageOutput,
} from '@/shared/ipc/project-ipc';
import { projectIpcChannels } from '@/shared/ipc/project-ipc';
import { bindIpcInvoke0, bindIpcInvoke1, type IpcRendererInvoke } from '@/shared/ipc/ipc-bridge';

export function createRendererProjectApi(invoke: IpcRendererInvoke['invoke']): RendererProjectApi {
  return {
    selectDirectory: bindIpcInvoke0<Result<SelectProjectDirectoryOutput>>(
      invoke,
      projectIpcChannels.selectDirectory,
    ),
    inspect: bindIpcInvoke1<InspectProjectInput, Result<ProjectInspection>>(
      invoke,
      projectIpcChannels.inspect,
    ),
    renameProject: bindIpcInvoke1<RenameProjectInput, Result<RenameProjectOutput>>(
      invoke,
      projectIpcChannels.renameProject,
    ),
    listRecentProjects: bindIpcInvoke0<Result<RecentProject[]>>(
      invoke,
      projectIpcChannels.listRecentProjects,
    ),
    removeRecentProject: bindIpcInvoke1<RemoveRecentProjectInput, Result<RecentProject[]>>(
      invoke,
      projectIpcChannels.removeRecentProject,
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
    saveReferenceTags: bindIpcInvoke1<
      SaveProjectReferenceTagsInput,
      Result<ProjectReferenceTagDocument>
    >(invoke, projectIpcChannels.saveReferenceTags),
    generateReferenceTags: bindIpcInvoke1<
      GenerateProjectReferenceTagsInput,
      Result<ProjectReferenceTagDocument>
    >(invoke, projectIpcChannels.generateReferenceTags),
    cancelReferenceTagGeneration: bindIpcInvoke1<
      CancelProjectReferenceTagGenerationInput,
      Result<void>
    >(invoke, projectIpcChannels.cancelReferenceTagGeneration),
    readSpecs: bindIpcInvoke1<ReadProjectSpecsInput, Result<ProjectSpecDocument[]>>(
      invoke,
      projectIpcChannels.readSpecs,
    ),
    createSpec: bindIpcInvoke1<CreateProjectSpecInput, Result<CreateProjectSpecOutput>>(
      invoke,
      projectIpcChannels.createSpec,
    ),
    saveSpec: bindIpcInvoke1<SaveProjectSpecInput, Result<ProjectSpecSaveResult>>(
      invoke,
      projectIpcChannels.saveSpec,
    ),
    updateSpecMeta: bindIpcInvoke1<UpdateProjectSpecMetaInput, Result<ProjectSpecMetaUpdateResult>>(
      invoke,
      projectIpcChannels.updateSpecMeta,
    ),
    readSpecVersionHistory: bindIpcInvoke1<
      ReadProjectSpecVersionHistoryInput,
      Result<ProjectSpecVersionHistoryEntry[]>
    >(invoke, projectIpcChannels.readSpecVersionHistory),
    readSpecVersion: bindIpcInvoke1<
      ReadProjectSpecVersionInput,
      Result<ProjectSpecVersionDocument>
    >(invoke, projectIpcChannels.readSpecVersion),
    readSpecVersionDiff: bindIpcInvoke1<
      ReadProjectSpecVersionDiffInput,
      Result<ProjectSpecVersionDiff>
    >(invoke, projectIpcChannels.readSpecVersionDiff),
    applySpecVersion: bindIpcInvoke1<
      ApplyProjectSpecVersionInput,
      Result<ProjectSpecApplyVersionResult>
    >(invoke, projectIpcChannels.applySpecVersion),
    deleteSpecVersion: bindIpcInvoke1<
      DeleteProjectSpecVersionInput,
      Result<ProjectSpecDeleteVersionResult>
    >(invoke, projectIpcChannels.deleteSpecVersion),
    readAnalysisRunStatus: bindIpcInvoke1<
      ReadProjectAnalysisRunStatusInput,
      Result<ProjectAnalysisRunStatus>
    >(invoke, projectIpcChannels.readAnalysisRunStatus),
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
    >(invoke, projectIpcChannels.readSessionMessages),
    readSessionMessageRunStatus: bindIpcInvoke1<
      ReadProjectSessionMessageRunStatusInput,
      Result<ProjectSessionMessageRunStatus>
    >(invoke, projectIpcChannels.readSessionMessageRunStatus),
    sendSessionMessage: bindIpcInvoke1<
      SendProjectSessionMessageInput,
      Result<SendProjectSessionMessageOutput>
    >(invoke, projectIpcChannels.sendSessionMessage),
    cancelSessionMessage: bindIpcInvoke1<
      CancelProjectSessionMessageInput,
      Result<ProjectSessionMessageRunStatus>
    >(invoke, projectIpcChannels.cancelSessionMessage),
  };
}
