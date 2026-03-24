import { useEffect, useRef, useState } from 'react';

import type {
  AgentCliConnectionSettings,
  AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';
import { createDefaultAgentCliConnectionSettings } from '@/domain/app-settings/agent-cli-connection-model';
import type {
  ProjectAnalysis,
  ProjectAnalysisDocumentId,
  ProjectAnalysisDocumentLayoutMap,
  ProjectAnalysisRunStatus,
} from '@/domain/project/project-analysis-model';
import type { ProjectInspection, RecentProject } from '@/domain/project/project-model';
import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
import type {
  ProjectSessionMessage,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';
import type { RendererSddApi } from '@/shared/ipc/sdd-ipc';

import {
  describeInitializationState,
  reorderItems,
  resolveSelectedSession,
  resolveSelectedSpec,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.utils';
import type {
  ProjectBootstrapWorkbenchState,
  SelectedProjectAnalysisDocumentId,
  StructuredProjectAnalysis,
  WorkspacePageId,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

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

export function useProjectBootstrapWorkbenchWorkflow(): {
  state: ProjectBootstrapWorkbenchState;
  actions: {
    onActivateProject(rootPath: string): Promise<void>;
    onAnalyzeProject(): void;
    onCancelAnalysis(): void;
    onChangeDraftMessage(value: string): void;
    onCreateSpec(): void;
    onDragOverProject(rootPath: string): void;
    onDropProject(rootPath: string): void;
    onEndDraggingProject(): void;
    onChangeChatModel(model: string): void;
    onChangeChatReasoningEffort(modelReasoningEffort: AgentCliModelReasoningEffort): void;
    onSelectProject(): void;
    onSelectAnalysisDocument(documentId: ProjectAnalysisDocumentId): void;
    onSaveAnalysisDocumentLayouts(documentLayouts: ProjectAnalysisDocumentLayoutMap): void;
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
  const [analysis, setAnalysis] = useState<StructuredProjectAnalysis | null>(null);
  const [specs, setSpecs] = useState<ProjectSpecDocument[]>([]);
  const [sessions, setSessions] = useState<ProjectSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedAnalysisDocumentId, setSelectedAnalysisDocumentId] =
    useState<SelectedProjectAnalysisDocumentId>(null);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [analysisRunStatusesByRootPath, setAnalysisRunStatusesByRootPath] = useState<
    Record<string, ProjectAnalysisRunStatus>
  >({});
  const [sessionMessages, setSessionMessages] = useState<ProjectSessionMessage[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [expandedProjectRootPaths, setExpandedProjectRootPaths] = useState<string[]>([]);
  const [draggingProjectRootPath, setDraggingProjectRootPath] = useState<string | null>(null);
  const [dropTargetRootPath, setDropTargetRootPath] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isCreatingSpec, setIsCreatingSpec] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSavingChatRuntimeSettings, setIsSavingChatRuntimeSettings] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [codexConnectionSettings, setCodexConnectionSettings] = useState<AgentCliConnectionSettings>(
    () => createDefaultAgentCliConnectionSettings('codex'),
  );
  const [message, setMessage] = useState<string>('로컬 프로젝트를 선택해 시작하세요.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedPathRef = useRef<string | null>(null);

  const selectedSpec = resolveSelectedSpec(specs, selectedSpecId);
  const specSessions = selectedSpec
    ? sessions.filter((session) => session.specId === selectedSpec.meta.id)
    : [];
  const selectedSession = resolveSelectedSession(specSessions, selectedSessionId);

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

    void (async () => {
      setIsCreatingSession(true);
      try {
        const createSessionResult = await sddApi.project.createSession({
          rootPath: selectedPath,
          specId: selectedSpec.meta.id,
          title: `${selectedSpec.meta.title} 채팅`,
        });
        if (!createSessionResult.ok) {
          if (!isCancelled) {
            setErrorMessage(createSessionResult.error.message);
          }
          return;
        }

        const sessionsResult = await sddApi.project.listSessions({
          rootPath: selectedPath,
        });
        if (!sessionsResult.ok) {
          if (!isCancelled) {
            setErrorMessage(sessionsResult.error.message);
          }
          return;
        }

        if (isCancelled) {
          return;
        }

        setSessions(sessionsResult.value);
        setSelectedSessionId(createSessionResult.value.id);
      } finally {
        if (!isCancelled) {
          setIsCreatingSession(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
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

    setMessage('프로젝트를 불러오고 작업 공간을 확인하는 중입니다.');
    setErrorMessage(null);

    const result = await sddApi.project.activate({ rootPath });
    if (!result.ok) {
      setInspection(null);
      setAnalysis(null);
      setSpecs([]);
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
    setSelectedPath(nextRootPath);
    setInspection(result.value.inspection);
    setRecentProjects(result.value.recentProjects);
    setExpandedProjectRootPaths((current) =>
      current.includes(nextRootPath) ? current : [...current, nextRootPath],
    );
    setDraftMessage('');
    setErrorMessage(null);
    setMessage(describeInitializationState(result.value.inspection));

    await Promise.all([
      loadProjectAnalysis({
        inspection: result.value.inspection,
        rootPath: nextRootPath,
      }),
      loadProjectSpecs({
        inspection: result.value.inspection,
        rootPath: nextRootPath,
      }),
      loadProjectSessions({
        inspection: result.value.inspection,
        rootPath: nextRootPath,
      }),
    ]);
  }

  async function loadProjectAnalysis(input: {
    inspection: ProjectInspection;
    rootPath: string;
  }): Promise<void> {
    const sddApi = getSddApi();
    if (!sddApi || input.inspection.initializationState !== 'ready') {
      setAnalysis(null);
      setSelectedAnalysisDocumentId(null);
      return;
    }

    const result = await sddApi.project.readAnalysis({
      rootPath: input.rootPath,
    });
    if (!result.ok) {
      setAnalysis(null);
      setSelectedAnalysisDocumentId(null);
      setErrorMessage(result.error.message);
      return;
    }

    const structuredAnalysis = toStructuredProjectAnalysis(result.value);
    setAnalysis(structuredAnalysis);
    setSelectedAnalysisDocumentId(structuredAnalysis?.documents?.[0]?.id ?? null);
  }

  async function loadProjectSpecs(input: {
    inspection: ProjectInspection;
    rootPath: string;
  }): Promise<void> {
    const sddApi = getSddApi();
    if (!sddApi || input.inspection.initializationState !== 'ready') {
      setSpecs([]);
      setSelectedSpecId(null);
      return;
    }

    const result = await sddApi.project.readSpecs({
      rootPath: input.rootPath,
    });
    if (!result.ok) {
      setSpecs([]);
      setSelectedSpecId(null);
      setErrorMessage(result.error.message);
      return;
    }

    setSpecs(result.value);
  }

  async function loadProjectSessions(input: {
    inspection: ProjectInspection;
    rootPath: string;
  }): Promise<void> {
    const sddApi = getSddApi();
    if (!sddApi || input.inspection.initializationState !== 'ready') {
      setSessions([]);
      setSelectedSessionId(null);
      return;
    }

    const sessionsResult = await sddApi.project.listSessions({
      rootPath: input.rootPath,
    });
    if (!sessionsResult.ok) {
      setSessions([]);
      setSelectedSessionId(null);
      setErrorMessage(sessionsResult.error.message);
      return;
    }

    setSessions(sessionsResult.value);
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

  async function handleAnalyzeProject(): Promise<void> {
    if (!selectedPath) {
      return;
    }

    const analysisRootPath = selectedPath;
    const sddApi = getSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      setMessage('에이전트 분석을 시작할 수 없습니다.');
      return;
    }

    setErrorMessage(null);
    setMessage('에이전트 분석을 시작했습니다. 아래 상태 카드에서 진행 상황을 확인하세요.');
    setAnalysisRunStatusesByRootPath((current) => {
      const startedAt = new Date().toISOString();
      return {
        ...current,
        [analysisRootPath]: {
          rootPath: analysisRootPath,
          status: 'running',
          stepIndex: 1,
          stepTotal: 4,
          stageMessage: 'Codex CLI 실행 준비 중',
          progressMessage: '분석 요청을 전송했습니다.',
          startedAt,
          updatedAt: startedAt,
          completedAt: null,
          lastError: null,
        },
      };
    });

    try {
      const result = await sddApi.project.analyze({
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
            setMessage('에이전트 분석이 취소되었습니다.');
          } else {
            setErrorMessage(result.error.message);
            setMessage('에이전트 분석에 실패했습니다.');
          }
        }
        return;
      }

      if (selectedPathRef.current !== analysisRootPath) {
        return;
      }

      setInspection(result.value.inspection);
      const structuredAnalysis = toStructuredProjectAnalysis(result.value.analysis);
      setAnalysis(structuredAnalysis);
      setSelectedAnalysisDocumentId(structuredAnalysis?.documents?.[0]?.id ?? null);
      setMessage('에이전트 분석이 완료되었습니다. 분석 페이지에서 문서를 확인해 주세요.');
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : '에이전트 분석을 실행하지 못했습니다.';
      const latestRunStatus = await readAnalysisRunStatus(analysisRootPath);
      if (latestRunStatus) {
        setAnalysisRunStatusesByRootPath((current) => ({
          ...current,
          [analysisRootPath]: latestRunStatus,
        }));
      }

      if (selectedPathRef.current === analysisRootPath) {
        setErrorMessage(nextMessage);
        setMessage('에이전트 분석에 실패했습니다.');
      }
    }
  }

  async function handleCancelAnalysis(): Promise<void> {
    const rootPath = selectedPathRef.current;
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
        ? '에이전트 분석 취소를 요청했습니다.'
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

    setIsCreatingSpec(true);
    setErrorMessage(null);
    setMessage('새 명세 채팅을 준비하는 중입니다.');

    try {
      const result = await sddApi.project.createSpec({
        rootPath: selectedPath,
      });
      if (!result.ok) {
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

      await Promise.all([
        loadProjectSpecs({
          inspection: result.value.inspection,
          rootPath: result.value.inspection.rootPath,
        }),
        loadProjectSessions({
          inspection: result.value.inspection,
          rootPath: result.value.inspection.rootPath,
        }),
      ]);
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

    setIsSendingMessage(true);
    setErrorMessage(null);

    try {
      const result = await sddApi.project.sendSessionMessage({
        rootPath: selectedPath,
        sessionId: selectedSession.id,
        text: draftMessage,
      });
      if (!result.ok) {
        setErrorMessage(result.error.message);
        setMessage('메시지를 저장하지 못했습니다.');
        return;
      }

      setSessionMessages((current) => [...current, result.value.message]);
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
      setMessage(`"${selectedSpec.meta.title}" 명세 채팅에 메시지를 저장했습니다.`);
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

    setAnalysis((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        context: {
          ...current.context,
          documentLayouts: result.value,
        },
      };
    });
  }

  async function saveCodexConnectionSettings(
    patch: Partial<Pick<AgentCliConnectionSettings, 'model' | 'modelReasoningEffort'>>,
  ): Promise<void> {
    const sddApi = getSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return;
    }

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
        setCodexConnectionSettings(previousSettings);
        setErrorMessage(result.error.message);
        return;
      }

      setCodexConnectionSettings(result.value.settings);
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

    const result = await sddApi.project.reorderRecentProjects({
      rootPaths: nextRootPaths,
    });

    if (!result.ok) {
      setErrorMessage(result.error.message);
      setMessage('프로젝트 순서를 저장하지 못했습니다.');
      setDraggingProjectRootPath(null);
      setDropTargetRootPath(null);
      return;
    }

    setRecentProjects(result.value);
    setMessage('프로젝트 목록 순서를 저장했습니다.');
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
        void handleAnalyzeProject();
      },
      onCancelAnalysis() {
        void handleCancelAnalysis();
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
      onSaveAnalysisDocumentLayouts(documentLayouts: ProjectAnalysisDocumentLayoutMap) {
        void handleSaveAnalysisDocumentLayouts(documentLayouts);
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
