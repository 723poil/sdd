import { useEffect, useState } from 'react';

import type { ProjectAnalysis } from '@/domain/project/project-analysis-model';
import type { ProjectInspection, RecentProject } from '@/domain/project/project-model';
import type {
  ProjectSessionMessage,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';
import type { RendererSddApi } from '@/shared/ipc/project-ipc';

import {
  describeInitializationState,
  reorderItems,
  resolveSelectedSession,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.utils';
import type { ProjectBootstrapWorkbenchState } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

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
    onChangeDraftMessage(value: string): void;
    onCreateSession(): void;
    onDragOverProject(rootPath: string): void;
    onDropProject(rootPath: string): void;
    onEndDraggingProject(): void;
    onInitializeStorage(): void;
    onSelectProject(): void;
    onSelectSession(sessionId: string): void;
    onSendMessage(): void;
    onStartDraggingProject(rootPath: string): void;
    onToggleLeftSidebar(): void;
    onToggleRightSidebar(): void;
  };
} {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [inspection, setInspection] = useState<ProjectInspection | null>(null);
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
  const [sessions, setSessions] = useState<ProjectSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ProjectSessionMessage[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [draggingProjectRootPath, setDraggingProjectRootPath] = useState<string | null>(null);
  const [dropTargetRootPath, setDropTargetRootPath] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [message, setMessage] = useState<string>('로컬 프로젝트를 선택해 시작하세요.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const sddApi = getSddApi();
      if (!sddApi) {
        return;
      }

      const result = await sddApi.project.listRecentProjects();
      if (!result.ok) {
        return;
      }

      setRecentProjects(result.value);
    })();
  }, []);

  const selectedSession = resolveSelectedSession(sessions, selectedSessionId);

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

  async function activateProject(rootPath: string): Promise<void> {
    const sddApi = getSddApi();
    if (!sddApi) {
      setMessage('프로젝트를 여는 데 필요한 연결을 찾지 못했습니다.');
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return;
    }

    setMessage('프로젝트를 불러오는 중입니다.');
    setErrorMessage(null);

    const result = await sddApi.project.activate({ rootPath });
    if (!result.ok) {
      setInspection(null);
      setAnalysis(null);
      setSessions([]);
      setSelectedSessionId(null);
      setSessionMessages([]);
      setErrorMessage(result.error.message);
      setMessage('프로젝트를 열지 못했습니다.');
      return;
    }

    setSelectedPath(result.value.inspection.rootPath);
    setInspection(result.value.inspection);
    setRecentProjects(result.value.recentProjects);
    setDraftMessage('');
    setErrorMessage(null);
    setMessage(describeInitializationState(result.value.inspection));
    await Promise.all([
      loadProjectAnalysis({
        inspection: result.value.inspection,
        rootPath: result.value.inspection.rootPath,
      }),
      loadProjectSessions({
        inspection: result.value.inspection,
        rootPath: result.value.inspection.rootPath,
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
      return;
    }

    const result = await sddApi.project.readAnalysis({
      rootPath: input.rootPath,
    });

    if (!result.ok) {
      setAnalysis(null);
      setErrorMessage(result.error.message);
      return;
    }

    setAnalysis(result.value);
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

    const result = await sddApi.project.listSessions({
      rootPath: input.rootPath,
    });
    if (!result.ok) {
      setSessions([]);
      setSelectedSessionId(null);
      setErrorMessage(result.error.message);
      return;
    }

    setSessions(result.value);
    setSelectedSessionId((currentId) => {
      if (currentId && result.value.some((session) => session.id === currentId)) {
        return currentId;
      }

      return result.value[0]?.id ?? null;
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

  async function handleInitializeStorage(): Promise<void> {
    if (!selectedPath) {
      return;
    }

    const sddApi = getSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      setMessage('작업 공간을 준비할 수 없습니다.');
      return;
    }

    setIsInitializing(true);
    setErrorMessage(null);

    try {
      const initializationResult = await sddApi.project.initializeStorage({
        rootPath: selectedPath,
      });

      if (!initializationResult.ok) {
        setMessage('작업 공간 준비에 실패했습니다.');
        setErrorMessage(initializationResult.error.message);
        return;
      }

      setInspection(initializationResult.value.inspection);
      setMessage(
        initializationResult.value.createdSddDirectory
          ? '작업 공간 준비가 끝났습니다. 이제 기본 분석과 대화 세션을 사용할 수 있습니다.'
          : '이미 준비된 작업 공간을 확인했습니다. 바로 분석과 대화로 이어갈 수 있습니다.',
      );
      await Promise.all([
        loadProjectAnalysis({
          inspection: initializationResult.value.inspection,
          rootPath: selectedPath,
        }),
        loadProjectSessions({
          inspection: initializationResult.value.inspection,
          rootPath: selectedPath,
        }),
      ]);
    } finally {
      setIsInitializing(false);
    }
  }

  async function handleAnalyzeProject(): Promise<void> {
    if (!selectedPath) {
      return;
    }

    const sddApi = getSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      setMessage('기본 분석을 시작할 수 없습니다.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setMessage('프로젝트 구조를 분석하고 있습니다.');

    try {
      const result = await sddApi.project.analyze({
        rootPath: selectedPath,
      });

      if (!result.ok) {
        setErrorMessage(result.error.message);
        setMessage('기본 분석에 실패했습니다.');
        return;
      }

      setInspection(result.value.inspection);
      setAnalysis(result.value.analysis);
      setMessage('기본 분석이 완료되었습니다. 이제 대화 세션을 만들어 작업을 이어갈 수 있습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleCreateSession(): Promise<void> {
    if (!selectedPath || inspection?.initializationState !== 'ready') {
      return;
    }

    const sddApi = getSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return;
    }

    setIsCreatingSession(true);
    setErrorMessage(null);

    try {
      const result = await sddApi.project.createSession({
        rootPath: selectedPath,
      });
      if (!result.ok) {
        setErrorMessage(result.error.message);
        setMessage('대화 세션을 만들지 못했습니다.');
        return;
      }

      await loadProjectSessions({
        inspection,
        rootPath: selectedPath,
      });
      setSelectedSessionId(result.value.id);
      setSessionMessages([]);
      setDraftMessage('');
      setMessage('새 대화 세션을 만들었습니다.');
    } finally {
      setIsCreatingSession(false);
    }
  }

  async function handleSendMessage(): Promise<void> {
    if (!selectedPath || !selectedSession) {
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
      setMessage('메시지를 저장했습니다. 이후 Codex 연결이 붙어도 이 세션을 그대로 이어갈 수 있습니다.');
    } finally {
      setIsSendingMessage(false);
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
      inspection,
      analysis,
      sessions,
      selectedSessionId,
      sessionMessages,
      draftMessage,
      recentProjects,
      draggingProjectRootPath,
      dropTargetRootPath,
      isSelecting,
      isInitializing,
      isAnalyzing,
      isCreatingSession,
      isSendingMessage,
      isLeftSidebarOpen,
      isRightSidebarOpen,
      message,
      errorMessage,
    },
    actions: {
      onActivateProject: activateProject,
      onAnalyzeProject() {
        void handleAnalyzeProject();
      },
      onChangeDraftMessage(value: string) {
        setDraftMessage(value);
      },
      onCreateSession() {
        void handleCreateSession();
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
      onInitializeStorage() {
        void handleInitializeStorage();
      },
      onSelectProject() {
        void handleSelectProject();
      },
      onSelectSession(sessionId: string) {
        setSelectedSessionId(sessionId);
      },
      onSendMessage() {
        void handleSendMessage();
      },
      onStartDraggingProject(rootPath: string) {
        setDraggingProjectRootPath(rootPath);
        setDropTargetRootPath(rootPath);
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
