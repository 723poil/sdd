import { useEffect, useEffectEvent, useRef, useState } from 'react';

import type {
  AgentCliConnectionSettings,
  AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';
import { createDefaultAgentCliConnectionSettings } from '@/domain/app-settings/agent-cli-connection-model';
import type {
  ProjectAnalysisDocumentId,
  ProjectAnalysisDocumentLayoutMap,
  ProjectAnalysisMode,
  ProjectAnalysisRunStatus,
} from '@/domain/project/project-analysis-model';
import type { ProjectInspection, RecentProject } from '@/domain/project/project-model';
import type { ProjectReferenceTagDocument } from '@/domain/project/project-reference-tag-model';
import type {
  ProjectSpecApplyVersionResult,
  ProjectSpecDeleteVersionResult,
  ProjectSpecDocument,
  ProjectSpecMetaUpdateResult,
  ProjectSpecRelation,
  ProjectSpecSaveResult,
  ProjectSpecStatus,
  ProjectSpecVersionDiff,
  ProjectSpecVersionHistoryEntry,
} from '@/domain/project/project-spec-model';
import type {
  ProjectSessionMessage,
  ProjectSessionMessagePendingAttachment,
  ProjectSessionMessageAttachmentSource,
  ProjectSessionMessageRunStatus,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';
import { createProjectSessionMessagePreview } from '@/domain/project/project-session-model';
import { getRendererSddApi } from '@/renderer/renderer-sdd-api';

import {
  createProjectSessionStateKey,
  describeInitializationState,
  reorderItems,
  resolveSelectedSession,
  resolveSelectedSpec,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.utils';
import {
  createCancelledProjectSessionMessageRunStatus,
  createCancellingProjectSessionMessageRunStatus,
  createFailedProjectSessionMessageRunStatus,
  createRunningProjectAnalysisRunStatus,
  createRunningProjectSessionMessageRunStatus,
  formatAppErrorMessage,
  mergeProjectSessionMessages,
  replaceRecordValue,
  upsertProjectSessionSummary,
  upsertProjectSpec,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-workbench-state.utils';
import {
  collectProjectSessionDraftAttachments,
  createProjectSessionMessageAttachmentUploads,
  revokeProjectSessionDraftAttachments,
  type ProjectSessionDraftAttachment,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-session-attachment-draft';
import type {
  ProjectBootstrapWorkbenchState,
  ReferenceTagGenerationStatus,
  SelectedProjectAnalysisDocumentId,
  StructuredProjectAnalysis,
  WorkbenchProgressTask,
  WorkspacePageId,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';
import {
  createEmptyProjectWorkspaceSnapshot,
  readAnalysisRunStatus,
  readCodexConnectionSettings,
  readProjectSessionMessageRunStatus,
  readProjectWorkspaceSnapshot,
  type ProjectWorkspaceSnapshot,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-workbench.api';
import { useWorkbenchProgressTasks } from '@/renderer/features/project-bootstrap/project-bootstrap-page/use-workbench-progress-tasks';

export function useProjectBootstrapWorkbenchWorkflow(): {
  state: ProjectBootstrapWorkbenchState;
  actions: {
    onActivateProject(rootPath: string): Promise<void>;
    onAnalyzeProject(): void;
    onAnalyzeReferences(): void;
    onCancelAnalysis(rootPath?: string): void;
    onCancelReferenceTagGeneration(rootPath?: string): void;
    onCancelSessionMessage(rootPath?: string, sessionId?: string): void;
    onAddDraftAttachments(files: File[], source: ProjectSessionMessageAttachmentSource): void;
    onChangeDraftMessage(value: string): void;
    onChangeEditingProjectName(value: string): void;
    onCreateSpec(): void;
    onDragOverProject(rootPath: string): void;
    onDropProject(rootPath: string): void;
    onEndDraggingProject(): void;
    onRemoveDraftAttachment(draftId: string): void;
    onSetComposerDragActive(isActive: boolean): void;
    onChangeChatModel(model: string): void;
    onChangeChatReasoningEffort(modelReasoningEffort: AgentCliModelReasoningEffort): void;
    onGenerateReferenceTags(): Promise<'succeeded' | 'failed' | 'cancelled'>;
    onBeginRenameProject(rootPath: string): void;
    onCancelRenameProject(): void;
    onCommitRenameProject(rootPath: string): void;
    onRemoveProject(rootPath: string): void;
    onSelectProject(): void;
    onSelectAnalysisDocument(documentId: ProjectAnalysisDocumentId): void;
    onSelectProgressTask(taskId: string): void;
    onSaveAnalysisDocumentLayouts(documentLayouts: ProjectAnalysisDocumentLayoutMap): void;
    onSaveSpec(input: {
      markdown: string;
      revision: number;
      specId: string;
      title: string;
    }): Promise<ProjectSpecSaveResult | null>;
    onUpdateSpecMeta(input: {
      specId: string;
      revision: number;
      status: ProjectSpecStatus;
      relations: ProjectSpecRelation[];
    }): Promise<ProjectSpecMetaUpdateResult | null>;
    onReadSpecVersionHistory(input: {
      specId: string;
    }): Promise<ProjectSpecVersionHistoryEntry[] | null>;
    onReadSpecVersionDiff(input: {
      currentMarkdown?: string | null;
      currentTitle?: string | null;
      specId: string;
      versionId: string;
    }): Promise<ProjectSpecVersionDiff | null>;
    onApplySpecVersion(input: {
      revision: number;
      specId: string;
      versionId: string;
    }): Promise<ProjectSpecApplyVersionResult | null>;
    onDeleteSpecVersion(input: {
      revision: number;
      specId: string;
      versionId: string;
    }): Promise<ProjectSpecDeleteVersionResult | null>;
    onSaveReferenceTags(referenceTags: ProjectReferenceTagDocument): Promise<boolean>;
    onSelectSpec(specId: string): void;
    onSelectWorkspacePage(page: WorkspacePageId): void;
    onSendMessage(): void;
    onStartDraggingProject(rootPath: string): void;
    onToggleProjectExpansion(rootPath: string): void;
    onToggleLeftSidebar(): void;
    onToggleRightSidebar(): void;
  };
} {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [activeWorkspacePage, setActiveWorkspacePage] = useState<WorkspacePageId>('analysis');
  const [inspection, setInspection] = useState<ProjectInspection | null>(null);
  const [storedAnalysis, setStoredAnalysis] = useState<StructuredProjectAnalysis | null>(null);
  const [transientAnalysis, setTransientAnalysis] = useState<StructuredProjectAnalysis | null>(
    null,
  );
  const [specs, setSpecs] = useState<ProjectSpecDocument[]>([]);
  const [sessions, setSessions] = useState<ProjectSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedAnalysisDocumentId, setSelectedAnalysisDocumentId] =
    useState<SelectedProjectAnalysisDocumentId>(null);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [specConflictBySpecId, setSpecConflictBySpecId] = useState<Record<string, boolean>>({});
  const [analysisRunStatusesByRootPath, setAnalysisRunStatusesByRootPath] = useState<
    Record<string, ProjectAnalysisRunStatus>
  >({});
  const [referenceTagGenerationStatusesByRootPath, setReferenceTagGenerationStatusesByRootPath] =
    useState<Record<string, ReferenceTagGenerationStatus>>({});
  const [sessionMessagesBySessionKey, setSessionMessagesBySessionKey] = useState<
    Record<string, ProjectSessionMessage[]>
  >({});
  const [draftMessagesBySessionKey, setDraftMessagesBySessionKey] = useState<
    Record<string, string>
  >({});
  const [draftAttachmentsBySessionKey, setDraftAttachmentsBySessionKey] = useState<
    Record<string, ProjectSessionDraftAttachment[]>
  >({});
  const [draftAttachmentErrorsBySessionKey, setDraftAttachmentErrorsBySessionKey] = useState<
    Record<string, string[]>
  >({});
  const [sessionMessageRunStatusesBySessionKey, setSessionMessageRunStatusesBySessionKey] =
    useState<Record<string, ProjectSessionMessageRunStatus>>({});
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [editingProjectRootPath, setEditingProjectRootPath] = useState<string | null>(null);
  const [editingProjectNameDraft, setEditingProjectNameDraft] = useState('');
  const [expandedProjectRootPaths, setExpandedProjectRootPaths] = useState<string[]>([]);
  const [draggingProjectRootPath, setDraggingProjectRootPath] = useState<string | null>(null);
  const [dropTargetRootPath, setDropTargetRootPath] = useState<string | null>(null);
  const [composerDragSessionKey, setComposerDragSessionKey] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isCreatingSpec, setIsCreatingSpec] = useState(false);
  const [isSavingSpec, setIsSavingSpec] = useState(false);
  const [isUpdatingSpecMeta, setIsUpdatingSpecMeta] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSavingReferenceTags, setIsSavingReferenceTags] = useState(false);
  const [isSavingChatRuntimeSettings, setIsSavingChatRuntimeSettings] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [codexConnectionSettings, setCodexConnectionSettings] =
    useState<AgentCliConnectionSettings>(() => createDefaultAgentCliConnectionSettings('codex'));
  const [message, setMessage] = useState<string>('로컬 프로젝트를 선택해 시작하세요.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedPathRef = useRef<string | null>(null);
  const referenceTagGenerationStatusesByRootPathRef = useRef<
    Record<string, ReferenceTagGenerationStatus>
  >({});
  const referenceTagGenerationTaskIdsByRootPathRef = useRef<Record<string, string>>({});
  const draftAttachmentsBySessionKeyRef = useRef<Record<string, ProjectSessionDraftAttachment[]>>(
    {},
  );
  const sessionMessageRunStatusesBySessionKeyRef = useRef<
    Record<string, ProjectSessionMessageRunStatus>
  >({});
  const sessionMessageTaskIdsBySessionKeyRef = useRef<Record<string, string>>({});
  const progressTasks = useWorkbenchProgressTasks();
  const analysis = transientAnalysis ?? storedAnalysis;

  const selectedSpec = resolveSelectedSpec(specs, selectedSpecId);
  const specSessions = selectedSpec
    ? sessions.filter((session) => session.specId === selectedSpec.meta.id)
    : [];
  const selectedSession = resolveSelectedSession(specSessions, selectedSessionId);
  const selectedSessionStateKey =
    selectedPath && selectedSession
      ? createProjectSessionStateKey({
          rootPath: selectedPath,
          sessionId: selectedSession.id,
        })
      : null;

  const applyProjectWorkspaceSnapshot = (input: {
    snapshot: ProjectWorkspaceSnapshot;
    transientAnalysis?: StructuredProjectAnalysis | null;
  }) => {
    setStoredAnalysis(input.snapshot.analysis);
    setTransientAnalysis(input.transientAnalysis ?? null);
    setSpecs(input.snapshot.specs);
    setSessions(input.snapshot.sessions);
  };

  const clearAllDraftSessionState = () => {
    for (const attachments of Object.values(draftAttachmentsBySessionKeyRef.current)) {
      revokeProjectSessionDraftAttachments(attachments);
    }

    draftAttachmentsBySessionKeyRef.current = {};
    setDraftMessagesBySessionKey({});
    setDraftAttachmentsBySessionKey({});
    setDraftAttachmentErrorsBySessionKey({});
    setComposerDragSessionKey(null);
  };

  const clearProjectWorkspaceSnapshot = () => {
    applyProjectWorkspaceSnapshot({
      snapshot: createEmptyProjectWorkspaceSnapshot(),
    });
    setSpecConflictBySpecId({});
    clearAllDraftSessionState();
  };

  const setReferenceTagGenerationStatus = (
    rootPath: string,
    status: ReferenceTagGenerationStatus | null,
  ) => {
    setReferenceTagGenerationStatusesByRootPath((current) => {
      const nextStatuses = replaceRecordValue(current, rootPath, status);

      referenceTagGenerationStatusesByRootPathRef.current = nextStatuses;
      return nextStatuses;
    });
  };

  const setReferenceTagGenerationTaskId = (rootPath: string, taskId: string | null) => {
    referenceTagGenerationTaskIdsByRootPathRef.current = replaceRecordValue(
      referenceTagGenerationTaskIdsByRootPathRef.current,
      rootPath,
      taskId,
    );
  };

  const setSessionMessageRunStatus = (input: {
    rootPath: string;
    sessionId: string;
    status: ProjectSessionMessageRunStatus | null;
  }) => {
    const sessionKey = createProjectSessionStateKey({
      rootPath: input.rootPath,
      sessionId: input.sessionId,
    });

    setSessionMessageRunStatusesBySessionKey((current) => {
      const shouldRemove =
        input.status === null ||
        input.status.status === 'idle' ||
        input.status.status === 'succeeded';
      const nextStatuses = replaceRecordValue(
        current,
        sessionKey,
        shouldRemove ? null : input.status,
      );

      sessionMessageRunStatusesBySessionKeyRef.current = nextStatuses;
      return nextStatuses;
    });
  };

  const setDraftAttachmentsForSession = (
    sessionKey: string,
    attachments: ProjectSessionDraftAttachment[] | null,
  ) => {
    setDraftAttachmentsBySessionKey((current) => {
      const previousAttachments = current[sessionKey] ?? [];
      const normalizedAttachments = attachments && attachments.length > 0 ? attachments : null;
      const nextAttachments = replaceRecordValue(current, sessionKey, normalizedAttachments);

      if (normalizedAttachments === null) {
        revokeProjectSessionDraftAttachments(previousAttachments);
      } else {
        const nextAttachmentIds = new Set(
          normalizedAttachments.map((attachment) => attachment.draftId),
        );
        revokeProjectSessionDraftAttachments(
          previousAttachments.filter((attachment) => !nextAttachmentIds.has(attachment.draftId)),
        );
      }

      draftAttachmentsBySessionKeyRef.current = nextAttachments;
      return nextAttachments;
    });
  };

  const setDraftAttachmentErrorsForSession = (sessionKey: string, errors: string[] | null) => {
    setDraftAttachmentErrorsBySessionKey((current) =>
      replaceRecordValue(current, sessionKey, errors && errors.length > 0 ? errors : null),
    );
  };

  const setSessionMessageTaskId = (sessionKey: string, taskId: string | null) => {
    sessionMessageTaskIdsBySessionKeyRef.current = replaceRecordValue(
      sessionMessageTaskIdsBySessionKeyRef.current,
      sessionKey,
      taskId,
    );
  };

  const startSessionCreateProgressTask = useEffectEvent(
    (input: { rootPath: string; specTitle: string }) =>
      progressTasks.startRequestProgressTask({
        detail: `"${input.specTitle}" 명세 채팅 세션을 준비하고 있습니다.`,
        kind: 'session-create',
        projectName: inspection?.projectName ?? null,
        rootPath: input.rootPath,
        title: '명세 채팅 준비',
      }),
  );

  const updateSessionCreateProgressTask = useEffectEvent(
    (task: WorkbenchProgressTask, patch: Partial<WorkbenchProgressTask>) => {
      progressTasks.updateRequestProgressTask(task, patch);
    },
  );

  const applyReferenceTagsToAnalysis = (referenceTags: ProjectReferenceTagDocument) => {
    setStoredAnalysis((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        referenceTags,
      };
    });

    setTransientAnalysis((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        referenceTags,
      };
    });
  };

  const syncProjectWorkspaceSnapshot = async (input: {
    inspection: ProjectInspection;
    rootPath: string;
    transientAnalysis?: StructuredProjectAnalysis | null;
  }): Promise<void> => {
    const snapshotResult = await readProjectWorkspaceSnapshot({
      inspection: input.inspection,
      rootPath: input.rootPath,
    });
    if (selectedPathRef.current !== input.rootPath) {
      return;
    }

    if (!snapshotResult.ok) {
      setErrorMessage(snapshotResult.error.message);
      return;
    }

    applyProjectWorkspaceSnapshot({
      snapshot: snapshotResult.value,
      transientAnalysis: input.transientAnalysis ?? null,
    });
  };

  useEffect(() => {
    selectedPathRef.current = selectedPath;
  }, [selectedPath]);

  useEffect(() => {
    return () => {
      for (const attachments of Object.values(draftAttachmentsBySessionKeyRef.current)) {
        revokeProjectSessionDraftAttachments(attachments);
      }
    };
  }, []);

  useEffect(() => {
    void (async () => {
      const sddApi = getRendererSddApi();
      if (!sddApi) {
        return;
      }

      const [recentProjectsResult, codexConnectionSettingsResult] = await Promise.all([
        sddApi.project.listRecentProjects(),
        readCodexConnectionSettings(),
      ]);

      if (recentProjectsResult.ok) {
        setRecentProjects(recentProjectsResult.value);
      }

      if (codexConnectionSettingsResult.ok) {
        setCodexConnectionSettings(codexConnectionSettingsResult.value);
      }
    })();
  }, []);

  useEffect(() => {
    setExpandedProjectRootPaths((current) =>
      current.filter((rootPath) => recentProjects.some((project) => project.rootPath === rootPath)),
    );
  }, [recentProjects]);

  useEffect(() => {
    if (!editingProjectRootPath) {
      return;
    }

    const editingProject = recentProjects.find(
      (project) => project.rootPath === editingProjectRootPath,
    );
    if (!editingProject) {
      setEditingProjectRootPath(null);
      setEditingProjectNameDraft('');
    }
  }, [editingProjectRootPath, recentProjects]);

  useEffect(() => {
    if (!selectedPath) {
      return;
    }

    let isCancelled = false;
    let timeoutId: number | null = null;

    const refreshAnalysisRunStatus = async (): Promise<void> => {
      try {
        const result = await readAnalysisRunStatus(selectedPath);
        if (isCancelled || !result) {
          return;
        }

        setAnalysisRunStatusesByRootPath((current) =>
          replaceRecordValue(current, result.rootPath, result),
        );

        if (result.status === 'running' || result.status === 'cancelling') {
          timeoutId = window.setTimeout(() => {
            void refreshAnalysisRunStatus();
          }, 1500);
        }
      } catch {
        return;
      }
    };

    void refreshAnalysisRunStatus();

    return () => {
      isCancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [selectedPath]);

  useEffect(() => {
    if (!analysis) {
      setSelectedAnalysisDocumentId(null);
      return;
    }

    const documents = analysis.documents ?? [];
    if (documents.length === 0) {
      setSelectedAnalysisDocumentId(null);
      return;
    }

    const hasSelectedDocument = documents.some(
      (document) => document.id === selectedAnalysisDocumentId,
    );
    if (!hasSelectedDocument) {
      setSelectedAnalysisDocumentId(documents[0]?.id ?? null);
    }
  }, [analysis, selectedAnalysisDocumentId]);

  useEffect(() => {
    if (specs.length === 0) {
      setSelectedSpecId(null);
      return;
    }

    const hasSelectedSpec = specs.some((spec) => spec.meta.id === selectedSpecId);
    if (hasSelectedSpec) {
      return;
    }

    const preferredSpecId = inspection?.projectMeta?.defaultSpecId;
    if (preferredSpecId && specs.some((spec) => spec.meta.id === preferredSpecId)) {
      setSelectedSpecId(preferredSpecId);
      return;
    }

    setSelectedSpecId(specs[0]?.meta.id ?? null);
  }, [inspection?.projectMeta?.defaultSpecId, selectedSpecId, specs]);

  useEffect(() => {
    if (!selectedPath || !selectedSession?.id) {
      return;
    }

    const sessionKey = createProjectSessionStateKey({
      rootPath: selectedPath,
      sessionId: selectedSession.id,
    });
    let isCancelled = false;

    void (async () => {
      const sddApi = getRendererSddApi();
      if (!sddApi) {
        return;
      }

      const result = await sddApi.project.readSessionMessages({
        rootPath: selectedPath,
        sessionId: selectedSession.id,
      });
      if (isCancelled) {
        return;
      }

      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      setSessionMessagesBySessionKey((current) =>
        replaceRecordValue(current, sessionKey, result.value),
      );
    })();

    return () => {
      isCancelled = true;
    };
  }, [selectedPath, selectedSession?.id]);

  useEffect(() => {
    if (!selectedPath || !selectedSession?.id) {
      return;
    }

    let isCancelled = false;
    let timeoutId: number | null = null;

    const refreshSessionMessageRunStatus = async (): Promise<void> => {
      try {
        const result = await readProjectSessionMessageRunStatus({
          rootPath: selectedPath,
          sessionId: selectedSession.id,
        });
        if (isCancelled || !result) {
          return;
        }

        setSessionMessageRunStatus({
          rootPath: selectedPath,
          sessionId: selectedSession.id,
          status: result,
        });

        if (result.status === 'running' || result.status === 'cancelling') {
          timeoutId = window.setTimeout(() => {
            void refreshSessionMessageRunStatus();
          }, 1000);
        }
      } catch {
        return;
      }
    };

    void refreshSessionMessageRunStatus();

    return () => {
      isCancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [selectedPath, selectedSession?.id]);

  useEffect(() => {
    if (
      activeWorkspacePage !== 'specs' ||
      !selectedPath ||
      !selectedSpec ||
      inspection?.initializationState !== 'ready' ||
      isCreatingSession
    ) {
      return;
    }

    const existingSession =
      sessions.find((session) => session.specId === selectedSpec.meta.id) ?? null;
    if (existingSession) {
      if (selectedSessionId !== existingSession.id) {
        setSelectedSessionId(existingSession.id);
      }
      return;
    }

    const sddApi = getRendererSddApi();
    if (!sddApi) {
      return;
    }

    let isCancelled = false;
    let createSessionTask: WorkbenchProgressTask | null = null;
    let didFinalizeSessionTask = false;

    void (async () => {
      createSessionTask = startSessionCreateProgressTask({
        rootPath: selectedPath,
        specTitle: selectedSpec.meta.title,
      });
      setIsCreatingSession(true);
      try {
        const createSessionResult = await sddApi.project.createSession({
          rootPath: selectedPath,
          specId: selectedSpec.meta.id,
          title: `${selectedSpec.meta.title} 채팅`,
        });
        if (!createSessionResult.ok) {
          if (!isCancelled) {
            updateSessionCreateProgressTask(createSessionTask, {
              detail: createSessionResult.error.message,
              errorMessage: createSessionResult.error.message,
              status: 'failed',
            });
            didFinalizeSessionTask = true;
            setErrorMessage(createSessionResult.error.message);
          }
          return;
        }

        const sessionsResult = await sddApi.project.listSessions({
          rootPath: selectedPath,
        });
        if (!sessionsResult.ok) {
          if (!isCancelled) {
            updateSessionCreateProgressTask(createSessionTask, {
              detail: sessionsResult.error.message,
              errorMessage: sessionsResult.error.message,
              status: 'failed',
            });
            didFinalizeSessionTask = true;
            setErrorMessage(sessionsResult.error.message);
          }
          return;
        }

        if (isCancelled) {
          return;
        }

        setSessions(sessionsResult.value);
        setSelectedSessionId(createSessionResult.value.id);
        updateSessionCreateProgressTask(createSessionTask, {
          detail: `"${selectedSpec.meta.title}" 명세 채팅 세션을 준비했습니다.`,
          status: 'succeeded',
        });
        didFinalizeSessionTask = true;
      } finally {
        setIsCreatingSession(false);
      }
    })();

    return () => {
      isCancelled = true;
      setIsCreatingSession(false);
      if (createSessionTask && !didFinalizeSessionTask) {
        updateSessionCreateProgressTask(createSessionTask, {
          detail: `"${selectedSpec.meta.title}" 명세 채팅 준비를 중단했습니다.`,
          status: 'cancelled',
        });
      }
    };
  }, [
    activeWorkspacePage,
    inspection?.initializationState,
    isCreatingSession,
    selectedPath,
    selectedSessionId,
    selectedSpec,
    sessions,
  ]);

  async function activateProject(rootPath: string): Promise<void> {
    const sddApi = getRendererSddApi();
    if (!sddApi) {
      setMessage('프로젝트를 여는 데 필요한 연결을 찾지 못했습니다.');
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return;
    }

    const activationTask = progressTasks.startRequestProgressTask({
      detail: '프로젝트 작업 공간과 최근 상태를 불러오고 있습니다.',
      kind: 'project-activation',
      projectName: inspection?.rootPath === rootPath ? inspection.projectName : null,
      rootPath,
      title: '프로젝트 열기',
    });

    setMessage('프로젝트를 불러오고 작업 공간을 확인하는 중입니다.');
    setErrorMessage(null);

    const result = await sddApi.project.activate({ rootPath });
    if (!result.ok) {
      progressTasks.updateRequestProgressTask(activationTask, {
        detail: result.error.message,
        errorMessage: result.error.message,
        status: 'failed',
      });
      selectedPathRef.current = null;
      setSelectedPath(null);
      setInspection(null);
      clearProjectWorkspaceSnapshot();
      setSelectedAnalysisDocumentId(null);
      setSelectedSpecId(null);
      setSessions([]);
      setSelectedSessionId(null);
      setErrorMessage(result.error.message);
      setMessage('프로젝트를 열지 못했습니다.');
      return;
    }

    const nextRootPath = result.value.inspection.rootPath;
    selectedPathRef.current = nextRootPath;
    setSelectedPath(nextRootPath);
    setInspection(result.value.inspection);
    setRecentProjects(result.value.recentProjects);
    setExpandedProjectRootPaths((current) =>
      current.includes(nextRootPath) ? current : [...current, nextRootPath],
    );
    clearProjectWorkspaceSnapshot();
    setSelectedAnalysisDocumentId(null);
    setSelectedSpecId(null);
    setSelectedSessionId(null);
    setEditingProjectRootPath(null);
    setEditingProjectNameDraft('');
    setErrorMessage(null);
    setMessage(describeInitializationState(result.value.inspection));

    await syncProjectWorkspaceSnapshot({
      inspection: result.value.inspection,
      rootPath: nextRootPath,
    });
    progressTasks.updateRequestProgressTask(activationTask, {
      detail: '프로젝트 작업 공간을 열고 최신 상태를 준비했습니다.',
      projectName: result.value.inspection.projectName,
      rootPath: nextRootPath,
      status: 'succeeded',
    });
  }

  async function handleSelectProject(): Promise<void> {
    const sddApi = getRendererSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      setMessage('프로젝트 선택을 진행할 수 없습니다.');
      return;
    }

    setIsSelecting(true);
    setErrorMessage(null);

    try {
      const selectionResult = await sddApi.project.selectDirectory();
      if (!selectionResult.ok) {
        setMessage('프로젝트 선택 중 문제가 발생했습니다.');
        setErrorMessage(selectionResult.error.message);
        return;
      }

      if (!selectionResult.value.didSelect || !selectionResult.value.rootPath) {
        setMessage('프로젝트 선택이 취소되었습니다.');
        return;
      }

      await activateProject(selectionResult.value.rootPath);
    } finally {
      setIsSelecting(false);
    }
  }

  async function handleAnalyzeProject(mode: ProjectAnalysisMode): Promise<void> {
    if (!selectedPath) {
      return;
    }

    const analysisRootPath = selectedPath;
    if (mode === 'references') {
      setActiveWorkspacePage('references');
    }

    const sddApi = getRendererSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      setMessage(
        mode === 'references'
          ? '참조 분석을 시작할 수 없습니다.'
          : '전체 분석을 시작할 수 없습니다.',
      );
      return;
    }

    setErrorMessage(null);
    setMessage(
      mode === 'references'
        ? '참조 분석을 시작했습니다. 아래 상태 카드에서 진행 상황을 확인하세요.'
        : '전체 분석을 시작했습니다. 아래 상태 카드에서 진행 상황을 확인하세요.',
    );
    setAnalysisRunStatusesByRootPath((current) =>
      replaceRecordValue(
        current,
        analysisRootPath,
        createRunningProjectAnalysisRunStatus({
          rootPath: analysisRootPath,
          startedAt: new Date().toISOString(),
          stepIndex: 1,
          stepTotal: mode === 'references' ? 3 : 4,
          stageMessage: mode === 'references' ? '참조 분석 준비 중' : '전체 분석 준비 중',
          progressMessage:
            mode === 'references'
              ? '참조 분석 요청을 전송했습니다.'
              : '전체 분석 요청을 전송했습니다.',
        }),
      ),
    );

    try {
      const result = await sddApi.project.analyze({
        mode,
        rootPath: analysisRootPath,
      });

      const latestRunStatus = await readAnalysisRunStatus(analysisRootPath);
      if (latestRunStatus) {
        setAnalysisRunStatusesByRootPath((current) =>
          replaceRecordValue(current, analysisRootPath, latestRunStatus),
        );
      }

      if (!result.ok) {
        if (selectedPathRef.current === analysisRootPath) {
          if (result.error.code === 'PROJECT_ANALYSIS_CANCELLED') {
            setErrorMessage(null);
            setMessage(
              mode === 'references' ? '참조 분석이 취소되었습니다.' : '전체 분석이 취소되었습니다.',
            );
          } else {
            setErrorMessage(formatAppErrorMessage(result.error));
            setMessage(
              mode === 'references' ? '참조 분석에 실패했습니다.' : '전체 분석에 실패했습니다.',
            );
          }
        }
        return;
      }

      if (selectedPathRef.current !== analysisRootPath) {
        return;
      }

      setInspection(result.value.inspection);
      await syncProjectWorkspaceSnapshot({
        inspection: result.value.inspection,
        rootPath: analysisRootPath,
        transientAnalysis:
          mode === 'references' && !result.value.inspection.isWritable
            ? result.value.analysis
            : null,
      });
      if (mode === 'references') {
        setActiveWorkspacePage('references');
      }
      setMessage(
        mode === 'references'
          ? result.value.inspection.isWritable
            ? '참조 분석이 완료되었습니다. 참조 탭과 분석 문서를 확인해 주세요.'
            : '참조 분석이 완료되었습니다. 현재 실행에서는 저장하지 않고 화면에만 표시했습니다.'
          : '전체 분석이 완료되었습니다. 분석 페이지에서 문서를 확인해 주세요.',
      );
    } catch (error) {
      const nextMessage =
        error instanceof Error
          ? error.message
          : mode === 'references'
            ? '참조 분석을 실행하지 못했습니다.'
            : '전체 분석을 실행하지 못했습니다.';
      const latestRunStatus = await readAnalysisRunStatus(analysisRootPath);
      if (latestRunStatus) {
        setAnalysisRunStatusesByRootPath((current) =>
          replaceRecordValue(current, analysisRootPath, latestRunStatus),
        );
      }

      if (selectedPathRef.current === analysisRootPath) {
        setErrorMessage(nextMessage);
        setMessage(
          mode === 'references' ? '참조 분석에 실패했습니다.' : '전체 분석에 실패했습니다.',
        );
      }
    }
  }

  async function handleCancelAnalysis(rootPathOverride?: string): Promise<void> {
    const rootPath = rootPathOverride ?? selectedPathRef.current;
    if (!rootPath) {
      return;
    }

    const currentStatus = analysisRunStatusesByRootPath[rootPath] ?? null;
    if (
      !currentStatus ||
      (currentStatus.status !== 'running' && currentStatus.status !== 'cancelling') ||
      currentStatus.stepIndex >= currentStatus.stepTotal
    ) {
      return;
    }

    const sddApi = getRendererSddApi();
    if (!sddApi || typeof sddApi.project.cancelAnalysis !== 'function') {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return;
    }

    setErrorMessage(null);

    const result = await sddApi.project.cancelAnalysis({ rootPath });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    setAnalysisRunStatusesByRootPath((current) =>
      replaceRecordValue(current, rootPath, result.value),
    );
    setMessage(
      result.value.status === 'cancelling'
        ? '분석 취소를 요청했습니다.'
        : '분석 상태를 다시 확인했습니다.',
    );
  }

  async function handleCreateSpec(): Promise<void> {
    if (!selectedPath) {
      return;
    }

    const sddApi = getRendererSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return;
    }

    const createSpecTask = progressTasks.startRequestProgressTask({
      detail: '새 명세 문서와 연결 채팅을 준비하고 있습니다.',
      kind: 'spec-create',
      projectName: inspection?.projectName ?? null,
      rootPath: selectedPath,
      title: '새 명세 만들기',
    });

    setIsCreatingSpec(true);
    setErrorMessage(null);
    setMessage('새 명세 채팅을 준비하는 중입니다.');

    try {
      const result = await sddApi.project.createSpec({
        rootPath: selectedPath,
      });
      if (!result.ok) {
        progressTasks.updateRequestProgressTask(createSpecTask, {
          detail: result.error.message,
          errorMessage: result.error.message,
          status: 'failed',
        });
        setErrorMessage(result.error.message);
        setMessage('새 명세를 만들지 못했습니다.');
        return;
      }

      setInspection(result.value.inspection);
      setActiveWorkspacePage('specs');
      setSelectedSpecId(result.value.spec.meta.id);
      setSelectedSessionId(null);
      setMessage(`"${result.value.spec.meta.title}" 명세 채팅을 시작할 수 있습니다.`);

      await syncProjectWorkspaceSnapshot({
        inspection: result.value.inspection,
        rootPath: result.value.inspection.rootPath,
      });
      progressTasks.updateRequestProgressTask(createSpecTask, {
        detail: `"${result.value.spec.meta.title}" 명세와 연결 채팅을 만들었습니다.`,
        projectName: result.value.inspection.projectName,
        rootPath: result.value.inspection.rootPath,
        status: 'succeeded',
      });
    } finally {
      setIsCreatingSpec(false);
    }
  }

  async function handleSendMessage(): Promise<void> {
    if (!selectedPath || !selectedSession || !selectedSpec) {
      return;
    }

    const sessionKey = createProjectSessionStateKey({
      rootPath: selectedPath,
      sessionId: selectedSession.id,
    });
    const currentRunStatus = sessionMessageRunStatusesBySessionKeyRef.current[sessionKey] ?? null;
    if (
      currentRunStatus &&
      (currentRunStatus.status === 'running' || currentRunStatus.status === 'cancelling')
    ) {
      return;
    }

    const currentDraftMessage = draftMessagesBySessionKey[sessionKey] ?? '';
    const trimmedDraftMessage = currentDraftMessage.trim();
    const currentDraftAttachments = draftAttachmentsBySessionKeyRef.current[sessionKey] ?? [];
    if (trimmedDraftMessage.length === 0 && currentDraftAttachments.length === 0) {
      return;
    }

    const sddApi = getRendererSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return;
    }

    let attachmentUploads;
    try {
      attachmentUploads =
        await createProjectSessionMessageAttachmentUploads(currentDraftAttachments);
    } catch {
      setDraftAttachmentErrorsForSession(sessionKey, [
        '첨부를 읽지 못했습니다. 다시 선택한 뒤 보내 주세요.',
      ]);
      setErrorMessage('첨부를 읽지 못했습니다. 다시 선택한 뒤 보내 주세요.');
      setMessage('메시지를 보내기 전에 첨부를 다시 확인해 주세요.');
      return;
    }

    const requestText = trimmedDraftMessage.length > 0 ? trimmedDraftMessage : null;
    const requestAttachments =
      createPendingAttachmentsFromDraftAttachments(currentDraftAttachments);
    const requestSummary = createProjectSessionMessagePreview({
      attachments: currentDraftAttachments,
      text: trimmedDraftMessage,
    });
    setDraftAttachmentErrorsForSession(sessionKey, null);
    const startedAt = new Date().toISOString();
    const sendMessageTask = progressTasks.startRequestProgressTask({
      detail: `"${selectedSpec.meta.title}" 명세 채팅에 메시지를 보내고 응답을 기다리고 있습니다.`,
      isCancellable: true,
      kind: 'message-send',
      projectName: inspection?.projectName ?? null,
      rootPath: selectedPath,
      sessionId: selectedSession.id,
      title: '채팅 메시지 전송',
    });
    setSessionMessageTaskId(sessionKey, sendMessageTask.id);
    const runningStatus = createRunningProjectSessionMessageRunStatus({
      attachmentCount: currentDraftAttachments.length,
      progressMessage:
        currentDraftAttachments.length > 0
          ? '대화 로그와 첨부를 저장하고 있습니다.'
          : '대화 로그에 질문을 기록하고 있습니다.',
      requestAttachments,
      requestSummary,
      requestText,
      rootPath: selectedPath,
      sessionId: selectedSession.id,
      startedAt,
      stageMessage: '메시지 저장 중',
    });
    setSessionMessageRunStatus({
      rootPath: selectedPath,
      sessionId: selectedSession.id,
      status: runningStatus,
    });

    setErrorMessage(null);
    setMessage(`"${selectedSpec.meta.title}" 명세 채팅에 메시지를 보내고 있습니다.`);

    try {
      const result = await sddApi.project.sendSessionMessage({
        attachments: attachmentUploads,
        model: codexConnectionSettings.model,
        modelReasoningEffort: codexConnectionSettings.modelReasoningEffort,
        rootPath: selectedPath,
        sessionId: selectedSession.id,
        text: currentDraftMessage,
      });
      if (!result.ok) {
        const completedAt = new Date().toISOString();
        if (result.error.code === 'PROJECT_SESSION_MESSAGE_CANCELLED') {
          const sessionMessagesResult = await sddApi.project.readSessionMessages({
            rootPath: selectedPath,
            sessionId: selectedSession.id,
          });
          if (sessionMessagesResult.ok) {
            setSessionMessagesBySessionKey((current) =>
              replaceRecordValue(current, sessionKey, sessionMessagesResult.value),
            );
          }
          setDraftMessagesBySessionKey((current) => replaceRecordValue(current, sessionKey, null));
          setDraftAttachmentsForSession(sessionKey, null);
          setDraftAttachmentErrorsForSession(sessionKey, null);
          setSessionMessageRunStatus({
            rootPath: selectedPath,
            sessionId: selectedSession.id,
            status: createCancelledProjectSessionMessageRunStatus({
              completedAt,
              current: runningStatus,
            }),
          });
          progressTasks.updateRequestProgressTask(sendMessageTask, {
            detail: `"${selectedSpec.meta.title}" 명세 채팅 응답 생성을 취소했습니다.`,
            errorMessage: null,
            isCancellable: false,
            status: 'cancelled',
          });
          setErrorMessage(null);
          setMessage(`"${selectedSpec.meta.title}" 명세 채팅 응답 생성을 취소했습니다.`);
          return;
        }

        setSessionMessageRunStatus({
          rootPath: selectedPath,
          sessionId: selectedSession.id,
          status: createFailedProjectSessionMessageRunStatus({
            attachmentCount: currentDraftAttachments.length,
            completedAt,
            lastError: result.error.message,
            progressMessage: null,
            requestAttachments,
            requestSummary,
            requestText,
            rootPath: selectedPath,
            sessionId: selectedSession.id,
            startedAt,
            stageMessage: '메시지 저장 실패',
            stepIndex: 1,
            stepTotal: 3,
          }),
        });
        progressTasks.updateRequestProgressTask(sendMessageTask, {
          detail: result.error.message,
          errorMessage: result.error.message,
          isCancellable: false,
          status: 'failed',
        });
        setErrorMessage(result.error.message);
        setMessage('메시지를 저장하지 못했습니다.');
        return;
      }

      setSessionMessagesBySessionKey((current) =>
        replaceRecordValue(
          current,
          sessionKey,
          mergeProjectSessionMessages(current[sessionKey] ?? [], result.value.messages),
        ),
      );
      const specSave = result.value.specSave;
      if (specSave) {
        setSpecs((current) => upsertProjectSpec(current, specSave.spec));
        setSpecConflictBySpecId((current) =>
          replaceRecordValue(
            current,
            specSave.spec.meta.id,
            specSave.kind === 'conflict' ? true : null,
          ),
        );
      }
      setSessions((current) => upsertProjectSessionSummary(current, result.value.session));
      setDraftMessagesBySessionKey((current) => replaceRecordValue(current, sessionKey, null));
      setDraftAttachmentsForSession(sessionKey, null);
      setDraftAttachmentErrorsForSession(sessionKey, null);

      if (result.value.assistantErrorMessage) {
        const completedAt = new Date().toISOString();
        setSessionMessageRunStatus({
          rootPath: selectedPath,
          sessionId: selectedSession.id,
          status: createFailedProjectSessionMessageRunStatus({
            attachmentCount: 0,
            completedAt,
            lastError: result.value.assistantErrorMessage,
            progressMessage: null,
            requestAttachments: [],
            requestSummary: null,
            requestText: null,
            rootPath: selectedPath,
            sessionId: selectedSession.id,
            startedAt,
            stageMessage: '응답 생성 실패',
            stepIndex: 3,
            stepTotal: 3,
          }),
        });
        progressTasks.updateRequestProgressTask(sendMessageTask, {
          detail: result.value.assistantErrorMessage,
          errorMessage: result.value.assistantErrorMessage,
          isCancellable: false,
          status: 'failed',
        });
        setErrorMessage(result.value.assistantErrorMessage);
        setMessage(
          `"${selectedSpec.meta.title}" 명세 채팅에 메시지를 저장했지만 응답은 받지 못했습니다.`,
        );
        return;
      }

      setSessionMessageRunStatus({
        rootPath: selectedPath,
        sessionId: selectedSession.id,
        status: null,
      });
      setMessage(`"${selectedSpec.meta.title}" 명세 채팅에서 응답을 받았습니다.`);
      progressTasks.updateRequestProgressTask(sendMessageTask, {
        detail: `"${selectedSpec.meta.title}" 명세 채팅에서 응답을 받았습니다.`,
        isCancellable: false,
        status: 'succeeded',
      });
    } finally {
      setSessionMessageTaskId(sessionKey, null);
    }
  }

  async function handleCancelSessionMessage(
    rootPathOverride?: string,
    sessionIdOverride?: string,
  ): Promise<void> {
    const rootPath = rootPathOverride ?? selectedPathRef.current;
    const sessionId = sessionIdOverride ?? selectedSession?.id ?? null;
    if (!rootPath || !sessionId) {
      return;
    }

    const sessionKey = createProjectSessionStateKey({
      rootPath,
      sessionId,
    });
    const currentStatus = sessionMessageRunStatusesBySessionKeyRef.current[sessionKey] ?? null;
    if (
      !currentStatus ||
      (currentStatus.status !== 'running' && currentStatus.status !== 'cancelling') ||
      currentStatus.status === 'cancelling'
    ) {
      return;
    }

    const sddApi = getRendererSddApi();
    if (!sddApi || typeof sddApi.project.cancelSessionMessage !== 'function') {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return;
    }

    const cancellingStatus = createCancellingProjectSessionMessageRunStatus({
      current: currentStatus,
      updatedAt: new Date().toISOString(),
    });
    setSessionMessageRunStatus({
      rootPath,
      sessionId,
      status: cancellingStatus,
    });

    const taskId = sessionMessageTaskIdsBySessionKeyRef.current[sessionKey];
    if (taskId) {
      progressTasks.updateRequestProgressTaskById(taskId, {
        detail: 'Codex 응답 생성을 종료하고 있습니다.',
        errorMessage: null,
        isCancellable: false,
        status: 'cancelling',
      });
    }

    const result = await sddApi.project.cancelSessionMessage({
      rootPath,
      sessionId,
    });
    if (result.ok) {
      setSessionMessageRunStatus({
        rootPath,
        sessionId,
        status: result.value,
      });
      setMessage('채팅 응답 취소를 요청했습니다.');
      return;
    }

    setSessionMessageRunStatus({
      rootPath,
      sessionId,
      status: currentStatus,
    });
    if (taskId) {
      progressTasks.updateRequestProgressTaskById(taskId, {
        detail: currentStatus.progressMessage ?? currentStatus.stageMessage,
        errorMessage: null,
        isCancellable: true,
        status: 'running',
      });
    }
    setErrorMessage(result.error.message);
  }

  async function handleSaveSpec(input: {
    markdown: string;
    revision: number;
    specId: string;
    title: string;
  }): Promise<ProjectSpecSaveResult | null> {
    const rootPath = selectedPathRef.current;
    const sddApi = getRendererSddApi();
    if (!rootPath || !sddApi || typeof sddApi.project.saveSpec !== 'function') {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return null;
    }

    const saveSpecTask = progressTasks.startRequestProgressTask({
      detail: '명세 제목과 본문 변경을 저장하고 있습니다.',
      kind: 'spec-save',
      projectName: inspection?.projectName ?? null,
      rootPath,
      title: '명세 저장',
    });

    setIsSavingSpec(true);
    setErrorMessage(null);

    try {
      const result = await sddApi.project.saveSpec({
        markdown: input.markdown,
        revision: input.revision,
        rootPath,
        specId: input.specId,
        title: input.title,
      });
      if (!result.ok) {
        progressTasks.updateRequestProgressTask(saveSpecTask, {
          detail: result.error.message,
          errorMessage: result.error.message,
          status: 'failed',
        });
        setErrorMessage(result.error.message);
        setMessage('명세를 저장하지 못했습니다.');
        return null;
      }

      setSpecs((current) => upsertProjectSpec(current, result.value.spec));
      setSpecConflictBySpecId((current) =>
        replaceRecordValue(
          current,
          result.value.spec.meta.id,
          result.value.kind === 'conflict' ? true : null,
        ),
      );

      if (result.value.kind === 'conflict') {
        setErrorMessage('명세가 다른 변경과 충돌했습니다. 최신 초안을 다시 확인해 주세요.');
        setMessage('명세 저장 중 충돌이 발생했습니다.');
        progressTasks.updateRequestProgressTask(saveSpecTask, {
          detail: '명세 저장 중 충돌이 발생했습니다.',
          errorMessage: '최신 초안을 다시 확인해 주세요.',
          status: 'failed',
        });
        return result.value;
      }

      if (result.value.kind === 'no-op') {
        setMessage(
          `"${result.value.spec.meta.title}" 명세는 변경된 내용이 없어 그대로 유지했습니다.`,
        );
        progressTasks.updateRequestProgressTask(saveSpecTask, {
          detail: `"${result.value.spec.meta.title}" 명세는 변경 없음으로 처리했습니다.`,
          status: 'succeeded',
        });
        return result.value;
      }

      setMessage(
        `"${result.value.spec.meta.title}" 명세를 ${result.value.versionId}로 저장했습니다.`,
      );
      progressTasks.updateRequestProgressTask(saveSpecTask, {
        detail: `"${result.value.spec.meta.title}" 명세를 ${result.value.versionId}로 저장했습니다.`,
        status: 'succeeded',
      });
      return result.value;
    } finally {
      setIsSavingSpec(false);
    }
  }

  async function handleUpdateSpecMeta(input: {
    specId: string;
    revision: number;
    status: ProjectSpecStatus;
    relations: ProjectSpecRelation[];
  }): Promise<ProjectSpecMetaUpdateResult | null> {
    const rootPath = selectedPathRef.current;
    const sddApi = getRendererSddApi();
    if (!rootPath || !sddApi || typeof sddApi.project.updateSpecMeta !== 'function') {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return null;
    }

    setIsUpdatingSpecMeta(true);
    setErrorMessage(null);

    try {
      const result = await sddApi.project.updateSpecMeta({
        rootPath,
        specId: input.specId,
        revision: input.revision,
        status: input.status,
        relations: input.relations,
      });
      if (!result.ok) {
        setErrorMessage(result.error.message);
        setMessage('명세 메타데이터를 저장하지 못했습니다.');
        return null;
      }

      setSpecs((current) => upsertProjectSpec(current, result.value.spec));
      setSpecConflictBySpecId((current) =>
        replaceRecordValue(
          current,
          result.value.spec.meta.id,
          result.value.kind === 'conflict' ? true : null,
        ),
      );

      if (result.value.kind === 'conflict') {
        setErrorMessage('다른 변경이 먼저 저장되어 명세 메타데이터 저장이 충돌했습니다.');
        setMessage('명세 메타데이터 저장 중 충돌이 발생했습니다.');
        return result.value;
      }

      if (result.value.kind === 'no-op') {
        setMessage(`"${result.value.spec.meta.title}" 명세 메타데이터는 변경된 내용이 없습니다.`);
        return result.value;
      }

      setMessage(`"${result.value.spec.meta.title}" 명세 메타데이터를 저장했습니다.`);
      return result.value;
    } finally {
      setIsUpdatingSpecMeta(false);
    }
  }

  async function handleReadSpecVersionHistory(input: {
    specId: string;
  }): Promise<ProjectSpecVersionHistoryEntry[] | null> {
    const rootPath = selectedPathRef.current;
    const sddApi = getRendererSddApi();
    if (!rootPath || !sddApi || typeof sddApi.project.readSpecVersionHistory !== 'function') {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return null;
    }

    const result = await sddApi.project.readSpecVersionHistory({
      rootPath,
      specId: input.specId,
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return null;
    }

    return result.value;
  }

  async function handleReadSpecVersionDiff(input: {
    currentMarkdown?: string | null;
    currentTitle?: string | null;
    specId: string;
    versionId: string;
  }): Promise<ProjectSpecVersionDiff | null> {
    const rootPath = selectedPathRef.current;
    const sddApi = getRendererSddApi();
    if (!rootPath || !sddApi || typeof sddApi.project.readSpecVersionDiff !== 'function') {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return null;
    }

    const result = await sddApi.project.readSpecVersionDiff({
      rootPath,
      specId: input.specId,
      versionId: input.versionId,
      ...(typeof input.currentMarkdown !== 'undefined'
        ? { currentMarkdown: input.currentMarkdown }
        : {}),
      ...(typeof input.currentTitle !== 'undefined' ? { currentTitle: input.currentTitle } : {}),
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return null;
    }

    return result.value;
  }

  async function handleApplySpecVersion(input: {
    revision: number;
    specId: string;
    versionId: string;
  }): Promise<ProjectSpecApplyVersionResult | null> {
    const rootPath = selectedPathRef.current;
    const sddApi = getRendererSddApi();
    if (!rootPath || !sddApi || typeof sddApi.project.applySpecVersion !== 'function') {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return null;
    }

    setErrorMessage(null);
    const result = await sddApi.project.applySpecVersion({
      rootPath,
      revision: input.revision,
      specId: input.specId,
      versionId: input.versionId,
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      setMessage('이전 버전을 적용하지 못했습니다.');
      return null;
    }

    setSpecs((current) => upsertProjectSpec(current, result.value.spec));
    setSpecConflictBySpecId((current) =>
      replaceRecordValue(
        current,
        result.value.spec.meta.id,
        result.value.kind === 'conflict' ? true : null,
      ),
    );

    if (result.value.kind === 'conflict') {
      setErrorMessage('다른 변경이 먼저 저장되어 이전 버전을 적용하지 못했습니다.');
      setMessage('이전 버전 적용 중 충돌이 발생했습니다.');
      return result.value;
    }

    if (result.value.kind === 'no-op') {
      setMessage(`"${result.value.spec.meta.title}" 명세는 이미 ${input.versionId} 기준입니다.`);
      return result.value;
    }

    setMessage(`"${result.value.spec.meta.title}" 명세에 ${input.versionId} 내용을 적용했습니다.`);
    return result.value;
  }

  async function handleDeleteSpecVersion(input: {
    revision: number;
    specId: string;
    versionId: string;
  }): Promise<ProjectSpecDeleteVersionResult | null> {
    const rootPath = selectedPathRef.current;
    const sddApi = getRendererSddApi();
    if (!rootPath || !sddApi || typeof sddApi.project.deleteSpecVersion !== 'function') {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return null;
    }

    setErrorMessage(null);
    const result = await sddApi.project.deleteSpecVersion({
      rootPath,
      revision: input.revision,
      specId: input.specId,
      versionId: input.versionId,
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      setMessage('이전 버전을 삭제하지 못했습니다.');
      return null;
    }

    const deleteResult = result.value;
    if (deleteResult.kind === 'conflict') {
      setSpecs((current) => upsertProjectSpec(current, deleteResult.spec));
      setSpecConflictBySpecId((current) =>
        replaceRecordValue(current, deleteResult.spec.meta.id, true),
      );
      setErrorMessage('다른 변경이 먼저 저장되어 버전 삭제가 충돌했습니다.');
      setMessage('버전 삭제 중 충돌이 발생했습니다.');
      return deleteResult;
    }

    setMessage(`${input.versionId} 버전을 삭제했습니다.`);
    return deleteResult;
  }

  async function handleSaveAnalysisDocumentLayouts(
    documentLayouts: ProjectAnalysisDocumentLayoutMap,
  ): Promise<void> {
    const rootPath = selectedPathRef.current;
    const sddApi = getRendererSddApi();
    if (!rootPath || !sddApi || typeof sddApi.project.saveAnalysisDocumentLayouts !== 'function') {
      return;
    }

    const result = await sddApi.project.saveAnalysisDocumentLayouts({
      rootPath,
      documentLayouts,
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    if (!inspection) {
      return;
    }

    await syncProjectWorkspaceSnapshot({
      inspection,
      rootPath,
    });
  }

  async function handleSaveReferenceTags(
    referenceTags: ProjectReferenceTagDocument,
  ): Promise<boolean> {
    const rootPath = selectedPathRef.current;
    const sddApi = getRendererSddApi();
    if (!rootPath || !sddApi || typeof sddApi.project.saveReferenceTags !== 'function') {
      return false;
    }

    const saveReferenceTagsTask = progressTasks.startRequestProgressTask({
      detail: '현재 파일 태그 변경을 저장하고 있습니다.',
      kind: 'reference-tags-save',
      projectName: inspection?.projectName ?? null,
      rootPath,
      title: '파일 태그 저장',
    });

    setIsSavingReferenceTags(true);
    setErrorMessage(null);

    try {
      const result = await sddApi.project.saveReferenceTags({
        rootPath,
        referenceTags,
      });
      if (!result.ok) {
        progressTasks.updateRequestProgressTask(saveReferenceTagsTask, {
          detail: result.error.message,
          errorMessage: result.error.message,
          status: 'failed',
        });
        setErrorMessage(result.error.message);
        return false;
      }

      if (selectedPathRef.current === rootPath) {
        applyReferenceTagsToAnalysis(result.value);
      }
      setMessage('참조 태그를 저장했습니다.');
      progressTasks.updateRequestProgressTask(saveReferenceTagsTask, {
        detail: '파일 태그 변경을 저장했습니다.',
        status: 'succeeded',
      });

      return true;
    } finally {
      setIsSavingReferenceTags(false);
    }
  }

  async function handleGenerateReferenceTags(): Promise<'succeeded' | 'failed' | 'cancelled'> {
    const rootPath = selectedPathRef.current;
    const sddApi = getRendererSddApi();
    if (
      !rootPath ||
      !sddApi ||
      typeof sddApi.project.generateReferenceTags !== 'function' ||
      referenceTagGenerationStatusesByRootPathRef.current[rootPath]
    ) {
      return 'failed';
    }

    const projectName = inspection?.projectName ?? null;
    const generateReferenceTagsTask = progressTasks.startRequestProgressTask({
      detail: '에이전트가 파일 태그를 분석하고 생성 결과를 검증하고 있습니다.',
      isCancellable: true,
      kind: 'reference-tags-generate',
      projectName,
      rootPath,
      title: '파일 태그 자동 생성',
    });

    setReferenceTagGenerationStatus(rootPath, 'running');
    setReferenceTagGenerationTaskId(rootPath, generateReferenceTagsTask.id);
    setErrorMessage(null);

    try {
      const result = await sddApi.project.generateReferenceTags({
        rootPath,
      });
      if (!result.ok) {
        if (result.error.code === 'PROJECT_REFERENCE_TAG_GENERATION_CANCELLED') {
          progressTasks.updateRequestProgressTask(generateReferenceTagsTask, {
            detail: '에이전트 파일 태그 자동 생성을 취소했습니다.',
            errorMessage: null,
            isCancellable: false,
            status: 'cancelled',
          });
          setMessage(`${projectName ?? '프로젝트'} 파일 태그 자동 생성을 취소했습니다.`);
          return 'cancelled';
        }

        progressTasks.updateRequestProgressTask(generateReferenceTagsTask, {
          detail: result.error.message,
          errorMessage: result.error.message,
          isCancellable: false,
          status: 'failed',
        });
        setErrorMessage(result.error.message);
        return 'failed';
      }

      if (selectedPathRef.current === rootPath) {
        applyReferenceTagsToAnalysis(result.value);
      }
      setMessage(
        `${projectName ?? '프로젝트'}에서 에이전트가 분석 -> 실행 -> 검증 단계를 거쳐 파일 태그를 자동 생성했습니다.`,
      );
      progressTasks.updateRequestProgressTask(generateReferenceTagsTask, {
        detail: '에이전트가 분석, 실행, 검증을 거쳐 파일 태그를 자동 생성했습니다.',
        isCancellable: false,
        status: 'succeeded',
      });

      return 'succeeded';
    } finally {
      setReferenceTagGenerationStatus(rootPath, null);
      setReferenceTagGenerationTaskId(rootPath, null);
    }
  }

  async function handleCancelReferenceTagGeneration(rootPathOverride?: string): Promise<void> {
    const rootPath = rootPathOverride ?? selectedPathRef.current;
    const sddApi = getRendererSddApi();
    if (!rootPath || !sddApi || typeof sddApi.project.cancelReferenceTagGeneration !== 'function') {
      return;
    }

    const currentStatus = referenceTagGenerationStatusesByRootPathRef.current[rootPath];
    if (!currentStatus || currentStatus === 'cancelling') {
      return;
    }

    setReferenceTagGenerationStatus(rootPath, 'cancelling');
    const taskId = referenceTagGenerationTaskIdsByRootPathRef.current[rootPath];
    if (taskId) {
      progressTasks.updateRequestProgressTaskById(taskId, {
        detail: '에이전트 실행을 종료하고 있습니다.',
        errorMessage: null,
        isCancellable: false,
        status: 'cancelling',
      });
    }

    const result = await sddApi.project.cancelReferenceTagGeneration({
      rootPath,
    });
    if (result.ok) {
      return;
    }

    setReferenceTagGenerationStatus(rootPath, 'running');
    if (taskId) {
      progressTasks.updateRequestProgressTaskById(taskId, {
        detail: '에이전트가 파일 태그를 분석하고 생성 결과를 검증하고 있습니다.',
        errorMessage: null,
        isCancellable: true,
        status: 'running',
      });
    }
    setErrorMessage(result.error.message);
  }

  async function saveCodexConnectionSettings(
    patch: Partial<Pick<AgentCliConnectionSettings, 'model' | 'modelReasoningEffort'>>,
  ): Promise<void> {
    const sddApi = getRendererSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return;
    }

    const saveSettingsTask = progressTasks.startRequestProgressTask({
      detail: 'Codex 연결 설정을 저장하고 있습니다.',
      kind: 'settings-save',
      projectName: inspection?.projectName ?? null,
      rootPath: selectedPathRef.current,
      title: 'Codex 설정 저장',
    });

    const previousSettings = codexConnectionSettings;
    const nextSettings: AgentCliConnectionSettings = {
      ...codexConnectionSettings,
      ...patch,
    };

    setCodexConnectionSettings(nextSettings);
    setIsSavingChatRuntimeSettings(true);
    setErrorMessage(null);

    try {
      const result = await sddApi.settings.saveAgentCliConnection({
        agentId: nextSettings.agentId,
        commandMode: nextSettings.commandMode,
        executablePath: nextSettings.commandMode === 'custom' ? nextSettings.executablePath : null,
        authMode: nextSettings.authMode,
        model: nextSettings.model,
        modelReasoningEffort: nextSettings.modelReasoningEffort,
      });

      if (!result.ok) {
        progressTasks.updateRequestProgressTask(saveSettingsTask, {
          detail: result.error.message,
          errorMessage: result.error.message,
          status: 'failed',
        });
        setCodexConnectionSettings(previousSettings);
        setErrorMessage(result.error.message);
        return;
      }

      setCodexConnectionSettings(result.value.settings);
      progressTasks.updateRequestProgressTask(saveSettingsTask, {
        detail: 'Codex 모델과 추론 강도 설정을 저장했습니다.',
        status: 'succeeded',
      });
    } finally {
      setIsSavingChatRuntimeSettings(false);
    }
  }

  async function handleReorderRecentProjects(targetRootPath: string): Promise<void> {
    const draggedRootPath = draggingProjectRootPath;
    if (!draggedRootPath || draggedRootPath === targetRootPath) {
      setDraggingProjectRootPath(null);
      setDropTargetRootPath(null);
      return;
    }

    const sddApi = getRendererSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      setMessage('프로젝트 순서를 저장할 수 없습니다.');
      setDraggingProjectRootPath(null);
      setDropTargetRootPath(null);
      return;
    }

    const orderedRootPaths = recentProjects.map((project) => project.rootPath);
    const fromIndex = orderedRootPaths.indexOf(draggedRootPath);
    const toIndex = orderedRootPaths.indexOf(targetRootPath);

    if (fromIndex < 0 || toIndex < 0) {
      setDraggingProjectRootPath(null);
      setDropTargetRootPath(null);
      return;
    }

    const nextRootPaths = reorderItems(orderedRootPaths, fromIndex, toIndex);
    const reorderProjectsTask = progressTasks.startRequestProgressTask({
      detail: '최근 프로젝트 목록 순서를 저장하고 있습니다.',
      kind: 'recent-projects-reorder',
      projectName: null,
      rootPath: null,
      title: '프로젝트 목록 순서 저장',
    });

    const result = await sddApi.project.reorderRecentProjects({
      rootPaths: nextRootPaths,
    });

    if (!result.ok) {
      progressTasks.updateRequestProgressTask(reorderProjectsTask, {
        detail: result.error.message,
        errorMessage: result.error.message,
        status: 'failed',
      });
      setErrorMessage(result.error.message);
      setMessage('프로젝트 순서를 저장하지 못했습니다.');
      setDraggingProjectRootPath(null);
      setDropTargetRootPath(null);
      return;
    }

    setRecentProjects(result.value);
    setMessage('프로젝트 목록 순서를 저장했습니다.');
    progressTasks.updateRequestProgressTask(reorderProjectsTask, {
      detail: '최근 프로젝트 목록 순서를 저장했습니다.',
      status: 'succeeded',
    });
    setErrorMessage(null);
    setDraggingProjectRootPath(null);
    setDropTargetRootPath(null);
  }

  function handleBeginRenameProject(rootPath: string): void {
    const recentProject = recentProjects.find((project) => project.rootPath === rootPath);
    if (!recentProject) {
      return;
    }

    setEditingProjectRootPath(rootPath);
    setEditingProjectNameDraft(recentProject.projectName);
    setErrorMessage(null);
  }

  function handleCancelRenameProject(): void {
    setEditingProjectRootPath(null);
    setEditingProjectNameDraft('');
  }

  async function handleCommitRenameProject(rootPath: string): Promise<void> {
    const recentProject = recentProjects.find((project) => project.rootPath === rootPath);
    if (!recentProject) {
      return;
    }

    const projectName = editingProjectNameDraft.trim();
    if (projectName.length === 0) {
      setErrorMessage('프로젝트 이름을 입력해 주세요.');
      setMessage('프로젝트 이름을 변경하지 못했습니다.');
      return;
    }

    if (projectName === recentProject.projectName) {
      handleCancelRenameProject();
      return;
    }

    const sddApi = getRendererSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      setMessage('프로젝트 이름을 변경할 수 없습니다.');
      return;
    }

    const result = await sddApi.project.renameProject({
      rootPath,
      projectName,
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      setMessage('프로젝트 이름을 변경하지 못했습니다.');
      return;
    }

    setRecentProjects(result.value.recentProjects);
    setEditingProjectRootPath(null);
    setEditingProjectNameDraft('');
    if (selectedPathRef.current === rootPath) {
      setInspection((current) => {
        if (!current || current.rootPath !== rootPath) {
          return current;
        }

        return {
          ...current,
          projectName,
          projectMeta: result.value.projectMeta ?? current.projectMeta,
        };
      });
    }

    setErrorMessage(null);
    setMessage('프로젝트 이름을 변경했습니다.');
  }

  async function handleRemoveRecentProject(rootPath: string): Promise<void> {
    const recentProject = recentProjects.find((project) => project.rootPath === rootPath);
    if (!recentProject) {
      return;
    }

    const isSelectedProject = selectedPathRef.current === rootPath;
    const shouldRemove = window.confirm(
      isSelectedProject
        ? '현재 프로젝트는 열어 둔 상태로 최근 목록에서만 제거할까요?\n프로젝트 폴더와 .sdd 데이터는 삭제하지 않습니다.'
        : '최근 프로젝트 목록에서 제거할까요?\n프로젝트 폴더와 .sdd 데이터는 삭제하지 않습니다.',
    );
    if (!shouldRemove) {
      return;
    }

    const sddApi = getRendererSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      setMessage('프로젝트를 최근 목록에서 제거할 수 없습니다.');
      return;
    }

    const result = await sddApi.project.removeRecentProject({
      rootPath,
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      setMessage('프로젝트를 최근 목록에서 제거하지 못했습니다.');
      return;
    }

    setRecentProjects(result.value);
    if (editingProjectRootPath === rootPath) {
      handleCancelRenameProject();
    }
    setErrorMessage(null);
    setMessage(
      isSelectedProject
        ? '현재 프로젝트는 유지하고 최근 목록에서만 제거했습니다.'
        : '프로젝트를 최근 목록에서 제거했습니다.',
    );
  }

  return {
    state: {
      selectedPath,
      activeWorkspacePage,
      inspection,
      analysis,
      specs,
      analysisRunStatusesByRootPath,
      referenceTagGenerationStatusesByRootPath,
      requestProgressTasks: progressTasks.requestProgressTasks,
      selectedProgressTaskId: progressTasks.selectedProgressTaskId,
      selectedAnalysisDocumentId,
      selectedSpecId,
      specConflictBySpecId,
      sessions,
      selectedSessionId,
      sessionMessagesBySessionKey,
      draftMessagesBySessionKey,
      draftAttachmentsBySessionKey,
      draftAttachmentErrorsBySessionKey,
      sessionMessageRunStatusesBySessionKey,
      recentProjects,
      editingProjectRootPath,
      editingProjectNameDraft,
      expandedProjectRootPaths,
      draggingProjectRootPath,
      dropTargetRootPath,
      composerDragSessionKey,
      isSelecting,
      isCreatingSpec,
      isSavingSpec,
      isUpdatingSpecMeta,
      isCreatingSession,
      isSavingReferenceTags,
      isSavingChatRuntimeSettings,
      isLeftSidebarOpen,
      isRightSidebarOpen,
      chatModel: codexConnectionSettings.model,
      chatReasoningEffort: codexConnectionSettings.modelReasoningEffort,
      message,
      errorMessage,
    },
    actions: {
      onActivateProject: activateProject,
      onAnalyzeProject() {
        void handleAnalyzeProject('full');
      },
      onAnalyzeReferences() {
        void handleAnalyzeProject('references');
      },
      onCancelAnalysis(rootPath?: string) {
        void handleCancelAnalysis(rootPath);
      },
      onCancelReferenceTagGeneration(rootPath?: string) {
        void handleCancelReferenceTagGeneration(rootPath);
      },
      onCancelSessionMessage(rootPath?: string, sessionId?: string) {
        void handleCancelSessionMessage(rootPath, sessionId);
      },
      onAddDraftAttachments(files: File[], source: ProjectSessionMessageAttachmentSource) {
        if (!selectedSessionStateKey || files.length === 0) {
          return;
        }

        const currentAttachments =
          draftAttachmentsBySessionKeyRef.current[selectedSessionStateKey] ?? [];
        const collectionResult = collectProjectSessionDraftAttachments({
          existingAttachments: currentAttachments,
          files,
          source,
        });

        setDraftAttachmentsForSession(selectedSessionStateKey, [
          ...currentAttachments,
          ...collectionResult.attachments,
        ]);
        setDraftAttachmentErrorsForSession(selectedSessionStateKey, collectionResult.errors);
      },
      onChangeDraftMessage(value: string) {
        if (!selectedPath || !selectedSession?.id) {
          return;
        }

        const sessionKey = createProjectSessionStateKey({
          rootPath: selectedPath,
          sessionId: selectedSession.id,
        });
        setDraftMessagesBySessionKey((current) => replaceRecordValue(current, sessionKey, value));
      },
      onChangeEditingProjectName(value: string) {
        setEditingProjectNameDraft(value);
      },
      onCreateSpec() {
        void handleCreateSpec();
      },
      onChangeChatModel(model: string) {
        void saveCodexConnectionSettings({ model });
      },
      onChangeChatReasoningEffort(modelReasoningEffort: AgentCliModelReasoningEffort) {
        void saveCodexConnectionSettings({ modelReasoningEffort });
      },
      onGenerateReferenceTags() {
        return handleGenerateReferenceTags();
      },
      onBeginRenameProject(rootPath: string) {
        handleBeginRenameProject(rootPath);
      },
      onCancelRenameProject() {
        handleCancelRenameProject();
      },
      onCommitRenameProject(rootPath: string) {
        void handleCommitRenameProject(rootPath);
      },
      onRemoveProject(rootPath: string) {
        void handleRemoveRecentProject(rootPath);
      },
      onDragOverProject(rootPath: string) {
        if (draggingProjectRootPath && draggingProjectRootPath !== rootPath) {
          setDropTargetRootPath(rootPath);
        }
      },
      onDropProject(rootPath: string) {
        void handleReorderRecentProjects(rootPath);
      },
      onEndDraggingProject() {
        setDraggingProjectRootPath(null);
        setDropTargetRootPath(null);
      },
      onRemoveDraftAttachment(draftId: string) {
        if (!selectedSessionStateKey) {
          return;
        }

        const currentAttachments =
          draftAttachmentsBySessionKeyRef.current[selectedSessionStateKey] ?? [];
        setDraftAttachmentsForSession(
          selectedSessionStateKey,
          currentAttachments.filter((attachment) => attachment.draftId !== draftId),
        );
        setDraftAttachmentErrorsForSession(selectedSessionStateKey, null);
      },
      onSetComposerDragActive(isActive: boolean) {
        setComposerDragSessionKey(isActive ? selectedSessionStateKey : null);
      },
      onSelectProject() {
        void handleSelectProject();
      },
      onSelectAnalysisDocument(documentId: ProjectAnalysisDocumentId) {
        setSelectedAnalysisDocumentId(documentId);
      },
      onSelectProgressTask(taskId: string) {
        progressTasks.selectProgressTask(taskId);
      },
      onSaveAnalysisDocumentLayouts(documentLayouts: ProjectAnalysisDocumentLayoutMap) {
        void handleSaveAnalysisDocumentLayouts(documentLayouts);
      },
      onSaveSpec(input: { markdown: string; revision: number; specId: string; title: string }) {
        return handleSaveSpec(input);
      },
      onUpdateSpecMeta(input: {
        specId: string;
        revision: number;
        status: ProjectSpecStatus;
        relations: ProjectSpecRelation[];
      }) {
        return handleUpdateSpecMeta(input);
      },
      onReadSpecVersionHistory(input: { specId: string }) {
        return handleReadSpecVersionHistory(input);
      },
      onReadSpecVersionDiff(input: {
        currentMarkdown?: string | null;
        currentTitle?: string | null;
        specId: string;
        versionId: string;
      }) {
        return handleReadSpecVersionDiff(input);
      },
      onApplySpecVersion(input: { revision: number; specId: string; versionId: string }) {
        return handleApplySpecVersion(input);
      },
      onDeleteSpecVersion(input: { revision: number; specId: string; versionId: string }) {
        return handleDeleteSpecVersion(input);
      },
      onSaveReferenceTags(referenceTags: ProjectReferenceTagDocument) {
        return handleSaveReferenceTags(referenceTags);
      },
      onSelectSpec(specId: string) {
        setSelectedSpecId(specId);
      },
      onSelectWorkspacePage(page: WorkspacePageId) {
        setActiveWorkspacePage(page);
      },
      onSendMessage() {
        void handleSendMessage();
      },
      onStartDraggingProject(rootPath: string) {
        setDraggingProjectRootPath(rootPath);
        setDropTargetRootPath(rootPath);
      },
      onToggleProjectExpansion(rootPath: string) {
        setExpandedProjectRootPaths((current) =>
          current.includes(rootPath)
            ? current.filter((candidate) => candidate !== rootPath)
            : [...current, rootPath],
        );
      },
      onToggleLeftSidebar() {
        setIsLeftSidebarOpen((current) => !current);
      },
      onToggleRightSidebar() {
        setIsRightSidebarOpen((current) => !current);
      },
    },
  };
}

function createPendingAttachmentsFromDraftAttachments(
  attachments: readonly ProjectSessionDraftAttachment[],
): ProjectSessionMessagePendingAttachment[] {
  return attachments.map((attachment) => ({
    id: attachment.draftId,
    kind: attachment.kind,
    mimeType: attachment.mimeType,
    name: attachment.name,
    previewUrl: attachment.previewUrl,
    sizeBytes: attachment.sizeBytes,
  }));
}
