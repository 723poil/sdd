import { useEffect, useEffectEvent, useRef, useState } from 'react';

import type {
  AgentCliConnectionSettings,
  AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';
import { createDefaultAgentCliConnectionSettings } from '@/domain/app-settings/agent-cli-connection-model';
import type {
  ProjectAnalysis,
  ProjectAnalysisDocumentId,
  ProjectAnalysisDocumentLayoutMap,
  ProjectAnalysisMode,
  ProjectAnalysisRunStatus,
} from '@/domain/project/project-analysis-model';
import type { ProjectInspection, RecentProject } from '@/domain/project/project-model';
import type { ProjectReferenceTagDocument } from '@/domain/project/project-reference-tag-model';
import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
import type {
  ProjectSessionMessage,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';
import { err, ok, type Result } from '@/shared/contracts/result';
import type { RendererSddApi } from '@/shared/ipc/sdd-ipc';

import {
  describeInitializationState,
  reorderItems,
  resolveSelectedSession,
  resolveSelectedSpec,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.utils';
import type {
  ProjectBootstrapWorkbenchState,
  ReferenceTagGenerationStatus,
  SelectedProjectAnalysisDocumentId,
  StructuredProjectAnalysis,
  WorkbenchProgressTask,
  WorkbenchProgressTaskKind,
  WorkspacePageId,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';
import {
  createWorkbenchProgressTask,
  patchWorkbenchProgressTask,
  updateWorkbenchProgressTaskList,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/workbench-progress-task.utils';

interface ProjectWorkspaceSnapshot {
  analysis: StructuredProjectAnalysis | null;
  sessions: ProjectSessionSummary[];
  specs: ProjectSpecDocument[];
}

function getSddApi(): RendererSddApi | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (typeof window.sdd === 'undefined') {
    return null;
  }

  if (typeof window.sdd.project?.selectDirectory !== 'function') {
    return null;
  }

  return window.sdd;
}

function createEmptyProjectWorkspaceSnapshot(): ProjectWorkspaceSnapshot {
  return {
    analysis: null,
    sessions: [],
    specs: [],
  };
}

export function useProjectBootstrapWorkbenchWorkflow(): {
  state: ProjectBootstrapWorkbenchState;
  actions: {
    onActivateProject(rootPath: string): Promise<void>;
    onAnalyzeProject(): void;
    onAnalyzeReferences(): void;
    onCancelAnalysis(rootPath?: string): void;
    onCancelReferenceTagGeneration(rootPath?: string): void;
    onChangeDraftMessage(value: string): void;
    onCreateSpec(): void;
    onDragOverProject(rootPath: string): void;
    onDropProject(rootPath: string): void;
    onEndDraggingProject(): void;
    onChangeChatModel(model: string): void;
    onChangeChatReasoningEffort(modelReasoningEffort: AgentCliModelReasoningEffort): void;
    onGenerateReferenceTags(): Promise<'succeeded' | 'failed' | 'cancelled'>;
    onSelectProject(): void;
    onSelectAnalysisDocument(documentId: ProjectAnalysisDocumentId): void;
    onSelectProgressTask(taskId: string): void;
    onSaveAnalysisDocumentLayouts(documentLayouts: ProjectAnalysisDocumentLayoutMap): void;
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
  const [analysisRunStatusesByRootPath, setAnalysisRunStatusesByRootPath] = useState<
    Record<string, ProjectAnalysisRunStatus>
  >({});
  const [referenceTagGenerationStatusesByRootPath, setReferenceTagGenerationStatusesByRootPath] =
    useState<Record<string, ReferenceTagGenerationStatus>>({});
  const [requestProgressTasks, setRequestProgressTasks] = useState<WorkbenchProgressTask[]>([]);
  const [selectedProgressTaskId, setSelectedProgressTaskId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ProjectSessionMessage[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [expandedProjectRootPaths, setExpandedProjectRootPaths] = useState<string[]>([]);
  const [draggingProjectRootPath, setDraggingProjectRootPath] = useState<string | null>(null);
  const [dropTargetRootPath, setDropTargetRootPath] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isCreatingSpec, setIsCreatingSpec] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSavingReferenceTags, setIsSavingReferenceTags] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSavingChatRuntimeSettings, setIsSavingChatRuntimeSettings] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [codexConnectionSettings, setCodexConnectionSettings] =
    useState<AgentCliConnectionSettings>(() => createDefaultAgentCliConnectionSettings('codex'));
  const [message, setMessage] = useState<string>('로컬 프로젝트를 선택해 시작하세요.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedPathRef = useRef<string | null>(null);
  const progressTaskSequenceRef = useRef(0);
  const referenceTagGenerationStatusesByRootPathRef = useRef<
    Record<string, ReferenceTagGenerationStatus>
  >({});
  const referenceTagGenerationTaskIdsByRootPathRef = useRef<Record<string, string>>({});
  const analysis = transientAnalysis ?? storedAnalysis;

  const selectedSpec = resolveSelectedSpec(specs, selectedSpecId);
  const specSessions = selectedSpec
    ? sessions.filter((session) => session.specId === selectedSpec.meta.id)
    : [];
  const selectedSession = resolveSelectedSession(specSessions, selectedSessionId);

  const applyProjectWorkspaceSnapshot = (input: {
    snapshot: ProjectWorkspaceSnapshot;
    transientAnalysis?: StructuredProjectAnalysis | null;
  }) => {
    setStoredAnalysis(input.snapshot.analysis);
    setTransientAnalysis(input.transientAnalysis ?? null);
    setSpecs(input.snapshot.specs);
    setSessions(input.snapshot.sessions);
  };

  const clearProjectWorkspaceSnapshot = () => {
    applyProjectWorkspaceSnapshot({
      snapshot: createEmptyProjectWorkspaceSnapshot(),
    });
  };

  const setReferenceTagGenerationStatus = (
    rootPath: string,
    status: ReferenceTagGenerationStatus | null,
  ) => {
    setReferenceTagGenerationStatusesByRootPath((current) => {
      const nextStatuses = { ...current };

      if (status === null) {
        delete nextStatuses[rootPath];
      } else {
        nextStatuses[rootPath] = status;
      }

      referenceTagGenerationStatusesByRootPathRef.current = nextStatuses;
      return nextStatuses;
    });
  };

  const setReferenceTagGenerationTaskId = (rootPath: string, taskId: string | null) => {
    if (taskId === null) {
      delete referenceTagGenerationTaskIdsByRootPathRef.current[rootPath];
      return;
    }

    referenceTagGenerationTaskIdsByRootPathRef.current[rootPath] = taskId;
  };

  const createRequestProgressTaskId = (kind: WorkbenchProgressTaskKind): string => {
    progressTaskSequenceRef.current += 1;
    return `${kind}:${progressTaskSequenceRef.current}`;
  };

  const applyRequestProgressTask = (task: WorkbenchProgressTask) => {
    setRequestProgressTasks((current) => updateWorkbenchProgressTaskList(current, task));
  };

  const startRequestProgressTask = (input: {
    detail: string;
    isCancellable?: boolean;
    kind: WorkbenchProgressTaskKind;
    projectName?: string | null;
    rootPath?: string | null;
    title: string;
  }): WorkbenchProgressTask => {
    const now = new Date().toISOString();
    const task = createWorkbenchProgressTask({
      detail: input.detail,
      id: createRequestProgressTaskId(input.kind),
      kind: input.kind,
      now,
      projectName: input.projectName ?? null,
      rootPath: input.rootPath ?? null,
      title: input.title,
      ...(typeof input.isCancellable === 'boolean' ? { isCancellable: input.isCancellable } : {}),
    });
    applyRequestProgressTask(task);
    return task;
  };

  const updateRequestProgressTask = (
    task: WorkbenchProgressTask,
    patch: Partial<WorkbenchProgressTask>,
  ): WorkbenchProgressTask => {
    const nextTask = patchWorkbenchProgressTask({
      patch,
      task,
    });
    applyRequestProgressTask(nextTask);
    return nextTask;
  };

  const updateRequestProgressTaskById = (
    taskId: string,
    patch: Partial<WorkbenchProgressTask>,
  ): void => {
    setRequestProgressTasks((current) => {
      const task = current.find((candidate) => candidate.id === taskId);
      if (!task) {
        return current;
      }

      return updateWorkbenchProgressTaskList(
        current,
        patchWorkbenchProgressTask({
          patch,
          task,
        }),
      );
    });
  };

  const startSessionCreateProgressTask = useEffectEvent(
    (input: { rootPath: string; specTitle: string }) =>
      startRequestProgressTask({
        detail: `"${input.specTitle}" 명세 채팅 세션을 준비하고 있습니다.`,
        kind: 'session-create',
        projectName: inspection?.projectName ?? null,
        rootPath: input.rootPath,
        title: '명세 채팅 준비',
      }),
  );

  const updateSessionCreateProgressTask = useEffectEvent(
    (task: WorkbenchProgressTask, patch: Partial<WorkbenchProgressTask>) => {
      updateRequestProgressTask(task, patch);
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
    const sddApi = getSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return;
    }

    const snapshotResult = await readProjectWorkspaceSnapshot({
      inspection: input.inspection,
      rootPath: input.rootPath,
      sddApi,
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
    void (async () => {
      const sddApi = getSddApi();
      if (!sddApi) {
        return;
      }

      const [recentProjectsResult, codexConnectionSettingsResult] = await Promise.all([
        sddApi.project.listRecentProjects(),
        readCodexConnectionSettings(sddApi),
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

        setAnalysisRunStatusesByRootPath((current) => ({
          ...current,
          [result.rootPath]: result,
        }));

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
      setSessionMessages([]);
      return;
    }

    void (async () => {
      const sddApi = getSddApi();
      if (!sddApi) {
        setSessionMessages([]);
        return;
      }

      const result = await sddApi.project.readSessionMessages({
        rootPath: selectedPath,
        sessionId: selectedSession.id,
      });
      if (!result.ok) {
        setSessionMessages([]);
        setErrorMessage(result.error.message);
        return;
      }

      setSessionMessages(result.value);
    })();
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

    const sddApi = getSddApi();
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
    const sddApi = getSddApi();
    if (!sddApi) {
      setMessage('프로젝트를 여는 데 필요한 연결을 찾지 못했습니다.');
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return;
    }

    const activationTask = startRequestProgressTask({
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
      updateRequestProgressTask(activationTask, {
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
      setSessionMessages([]);
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
    setSessionMessages([]);
    setDraftMessage('');
    setErrorMessage(null);
    setMessage(describeInitializationState(result.value.inspection));

    await syncProjectWorkspaceSnapshot({
      inspection: result.value.inspection,
      rootPath: nextRootPath,
    });
    updateRequestProgressTask(activationTask, {
      detail: '프로젝트 작업 공간을 열고 최신 상태를 준비했습니다.',
      projectName: result.value.inspection.projectName,
      rootPath: nextRootPath,
      status: 'succeeded',
    });
  }

  async function handleSelectProject(): Promise<void> {
    const sddApi = getSddApi();
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

    const sddApi = getSddApi();
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
    setAnalysisRunStatusesByRootPath((current) => {
      const startedAt = new Date().toISOString();
      return {
        ...current,
        [analysisRootPath]: {
          rootPath: analysisRootPath,
          status: 'running',
          stepIndex: 1,
          stepTotal: mode === 'references' ? 3 : 4,
          stageMessage: mode === 'references' ? '참조 분석 준비 중' : '전체 분석 준비 중',
          progressMessage:
            mode === 'references'
              ? '참조 분석 요청을 전송했습니다.'
              : '전체 분석 요청을 전송했습니다.',
          startedAt,
          updatedAt: startedAt,
          completedAt: null,
          lastError: null,
        },
      };
    });

    try {
      const result = await sddApi.project.analyze({
        mode,
        rootPath: analysisRootPath,
      });

      const latestRunStatus = await readAnalysisRunStatus(analysisRootPath);
      if (latestRunStatus) {
        setAnalysisRunStatusesByRootPath((current) => ({
          ...current,
          [analysisRootPath]: latestRunStatus,
        }));
      }

      if (!result.ok) {
        if (selectedPathRef.current === analysisRootPath) {
          if (result.error.code === 'PROJECT_ANALYSIS_CANCELLED') {
            setErrorMessage(null);
            setMessage(
              mode === 'references' ? '참조 분석이 취소되었습니다.' : '전체 분석이 취소되었습니다.',
            );
          } else {
            setErrorMessage(result.error.message);
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
            ? toStructuredProjectAnalysis(result.value.analysis)
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
        setAnalysisRunStatusesByRootPath((current) => ({
          ...current,
          [analysisRootPath]: latestRunStatus,
        }));
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

    const sddApi = getSddApi();
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

    setAnalysisRunStatusesByRootPath((current) => ({
      ...current,
      [rootPath]: result.value,
    }));
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

    const sddApi = getSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return;
    }

    const createSpecTask = startRequestProgressTask({
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
        updateRequestProgressTask(createSpecTask, {
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
      setSessionMessages([]);
      setDraftMessage('');
      setMessage(`"${result.value.spec.meta.title}" 명세 채팅을 시작할 수 있습니다.`);

      await syncProjectWorkspaceSnapshot({
        inspection: result.value.inspection,
        rootPath: result.value.inspection.rootPath,
      });
      updateRequestProgressTask(createSpecTask, {
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

    const sddApi = getSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return;
    }

    const sendMessageTask = startRequestProgressTask({
      detail: `"${selectedSpec.meta.title}" 명세 채팅에 메시지를 보내고 응답을 기다리고 있습니다.`,
      kind: 'message-send',
      projectName: inspection?.projectName ?? null,
      rootPath: selectedPath,
      title: '채팅 메시지 전송',
    });

    setIsSendingMessage(true);
    setErrorMessage(null);

    try {
      const result = await sddApi.project.sendSessionMessage({
        model: codexConnectionSettings.model,
        modelReasoningEffort: codexConnectionSettings.modelReasoningEffort,
        rootPath: selectedPath,
        sessionId: selectedSession.id,
        text: draftMessage,
      });
      if (!result.ok) {
        updateRequestProgressTask(sendMessageTask, {
          detail: result.error.message,
          errorMessage: result.error.message,
          status: 'failed',
        });
        setErrorMessage(result.error.message);
        setMessage('메시지를 저장하지 못했습니다.');
        return;
      }

      setSessionMessages((current) => [...current, ...result.value.messages]);
      setSessions((current) =>
        current
          .map((session) =>
            session.id === result.value.session.id
              ? {
                  id: result.value.session.id,
                  specId: result.value.session.specId,
                  title: result.value.session.title,
                  updatedAt: result.value.session.updatedAt,
                  lastMessageAt: result.value.session.lastMessageAt,
                  lastMessagePreview: result.value.session.lastMessagePreview,
                  messageCount: result.value.session.messageCount,
                }
              : session,
          )
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      );
      setDraftMessage('');

      if (result.value.assistantErrorMessage) {
        updateRequestProgressTask(sendMessageTask, {
          detail: result.value.assistantErrorMessage,
          errorMessage: result.value.assistantErrorMessage,
          status: 'failed',
        });
        setErrorMessage(result.value.assistantErrorMessage);
        setMessage(
          `"${selectedSpec.meta.title}" 명세 채팅에 메시지를 저장했지만 응답은 받지 못했습니다.`,
        );
        return;
      }

      setMessage(`"${selectedSpec.meta.title}" 명세 채팅에서 응답을 받았습니다.`);
      updateRequestProgressTask(sendMessageTask, {
        detail: `"${selectedSpec.meta.title}" 명세 채팅에서 응답을 받았습니다.`,
        status: 'succeeded',
      });
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function handleSaveAnalysisDocumentLayouts(
    documentLayouts: ProjectAnalysisDocumentLayoutMap,
  ): Promise<void> {
    const rootPath = selectedPathRef.current;
    const sddApi = getSddApi();
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
    const sddApi = getSddApi();
    if (!rootPath || !sddApi || typeof sddApi.project.saveReferenceTags !== 'function') {
      return false;
    }

    const saveReferenceTagsTask = startRequestProgressTask({
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
        updateRequestProgressTask(saveReferenceTagsTask, {
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
      updateRequestProgressTask(saveReferenceTagsTask, {
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
    const sddApi = getSddApi();
    if (
      !rootPath ||
      !sddApi ||
      typeof sddApi.project.generateReferenceTags !== 'function' ||
      referenceTagGenerationStatusesByRootPathRef.current[rootPath]
    ) {
      return 'failed';
    }

    const projectName = inspection?.projectName ?? null;
    const generateReferenceTagsTask = startRequestProgressTask({
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
          updateRequestProgressTask(generateReferenceTagsTask, {
            detail: '에이전트 파일 태그 자동 생성을 취소했습니다.',
            errorMessage: null,
            isCancellable: false,
            status: 'cancelled',
          });
          setMessage(`${projectName ?? '프로젝트'} 파일 태그 자동 생성을 취소했습니다.`);
          return 'cancelled';
        }

        updateRequestProgressTask(generateReferenceTagsTask, {
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
      updateRequestProgressTask(generateReferenceTagsTask, {
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
    const sddApi = getSddApi();
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
      updateRequestProgressTaskById(taskId, {
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
      updateRequestProgressTaskById(taskId, {
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
    const sddApi = getSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return;
    }

    const saveSettingsTask = startRequestProgressTask({
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
        updateRequestProgressTask(saveSettingsTask, {
          detail: result.error.message,
          errorMessage: result.error.message,
          status: 'failed',
        });
        setCodexConnectionSettings(previousSettings);
        setErrorMessage(result.error.message);
        return;
      }

      setCodexConnectionSettings(result.value.settings);
      updateRequestProgressTask(saveSettingsTask, {
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

    const sddApi = getSddApi();
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
    const reorderProjectsTask = startRequestProgressTask({
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
      updateRequestProgressTask(reorderProjectsTask, {
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
    updateRequestProgressTask(reorderProjectsTask, {
      detail: '최근 프로젝트 목록 순서를 저장했습니다.',
      status: 'succeeded',
    });
    setErrorMessage(null);
    setDraggingProjectRootPath(null);
    setDropTargetRootPath(null);
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
      requestProgressTasks,
      selectedProgressTaskId,
      selectedAnalysisDocumentId,
      selectedSpecId,
      sessions,
      selectedSessionId,
      sessionMessages,
      draftMessage,
      recentProjects,
      expandedProjectRootPaths,
      draggingProjectRootPath,
      dropTargetRootPath,
      isSelecting,
      isCreatingSpec,
      isCreatingSession,
      isSavingReferenceTags,
      isSendingMessage,
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
      onChangeDraftMessage(value: string) {
        setDraftMessage(value);
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
      onSelectProject() {
        void handleSelectProject();
      },
      onSelectAnalysisDocument(documentId: ProjectAnalysisDocumentId) {
        setSelectedAnalysisDocumentId(documentId);
      },
      onSelectProgressTask(taskId: string) {
        setSelectedProgressTaskId(taskId);
      },
      onSaveAnalysisDocumentLayouts(documentLayouts: ProjectAnalysisDocumentLayoutMap) {
        void handleSaveAnalysisDocumentLayouts(documentLayouts);
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

function toStructuredProjectAnalysis(
  value: ProjectAnalysis | null,
): StructuredProjectAnalysis | null {
  return value;
}

async function readProjectWorkspaceSnapshot(input: {
  inspection: ProjectInspection;
  rootPath: string;
  sddApi: RendererSddApi;
}): Promise<Result<ProjectWorkspaceSnapshot>> {
  if (input.inspection.initializationState !== 'ready') {
    return ok(createEmptyProjectWorkspaceSnapshot());
  }

  const [analysisResult, specsResult, sessionsResult] = await Promise.all([
    input.sddApi.project.readAnalysis({
      rootPath: input.rootPath,
    }),
    input.sddApi.project.readSpecs({
      rootPath: input.rootPath,
    }),
    input.sddApi.project.listSessions({
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
    analysis: toStructuredProjectAnalysis(analysisResult.value),
    specs: specsResult.value,
    sessions: sessionsResult.value,
  });
}

async function readAnalysisRunStatus(rootPath: string): Promise<ProjectAnalysisRunStatus | null> {
  const sddApi = getSddApi();
  if (!sddApi || typeof sddApi.project.readAnalysisRunStatus !== 'function') {
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

async function readCodexConnectionSettings(
  sddApi: RendererSddApi,
): Promise<{ ok: true; value: AgentCliConnectionSettings } | { ok: false }> {
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
