import { useEffect, useState } from 'react';

import type {
  AgentCliAuthMode,
  AgentCliCommandMode,
  AgentCliConnectionCheck,
  AgentCliConnectionRecord,
  AgentCliId,
} from '@/domain/app-settings/agent-cli-connection-model';
import type { RendererSddApi } from '@/shared/ipc/sdd-ipc';

import type {
  AgentCliConnectionDraft,
  AgentCliSettingsWorkbenchState,
} from '@/renderer/features/agent-cli-settings/types';

function getSddApi(): RendererSddApi | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (typeof window.sdd === 'undefined') {
    return null;
  }

  if (
    typeof window.sdd.settings?.listAgentCliConnections !== 'function' ||
    typeof window.sdd.settings?.saveAgentCliConnection !== 'function' ||
    typeof window.sdd.settings?.checkAgentCliConnection !== 'function'
  ) {
    return null;
  }

  return window.sdd;
}

function createDraftFromRecord(connection: AgentCliConnectionRecord): AgentCliConnectionDraft {
  return {
    agentId: connection.definition.agentId,
    commandMode: connection.settings.commandMode,
    executablePath: connection.settings.executablePath ?? '',
    authMode: connection.settings.authMode,
  };
}

function buildDraftsByAgentId(
  connections: AgentCliConnectionRecord[],
): Partial<Record<AgentCliId, AgentCliConnectionDraft>> {
  return connections.reduce<Partial<Record<AgentCliId, AgentCliConnectionDraft>>>((accumulator, connection) => {
    accumulator[connection.definition.agentId] = createDraftFromRecord(connection);
    return accumulator;
  }, {});
}

export function useAgentCliSettingsWorkflow(): {
  connections: AgentCliConnectionRecord[];
  draftsByAgentId: Partial<Record<AgentCliId, AgentCliConnectionDraft>>;
  checkResultsByAgentId: Partial<Record<AgentCliId, AgentCliConnectionCheck>>;
  loadingMessage: string;
  errorMessage: string | null;
  isLoading: boolean;
  savingAgentIds: Partial<Record<AgentCliId, boolean>>;
  checkingAgentIds: Partial<Record<AgentCliId, boolean>>;
  connectionCount: number;
  hasConnections: boolean;
  actions: {
    onChangeCommandMode(agentId: AgentCliId, commandMode: AgentCliCommandMode): void;
    onChangeExecutablePath(agentId: AgentCliId, executablePath: string): void;
    onChangeAuthMode(agentId: AgentCliId, authMode: AgentCliAuthMode): void;
    onCheckConnection(agentId: AgentCliId): Promise<void>;
    onRefresh(): Promise<void>;
    onSaveConnection(agentId: AgentCliId): Promise<void>;
  };
} {
  const [connections, setConnections] = useState<AgentCliConnectionRecord[]>([]);
  const [draftsByAgentId, setDraftsByAgentId] = useState<
    Partial<Record<AgentCliId, AgentCliConnectionDraft>>
  >({});
  const [checkResultsByAgentId, setCheckResultsByAgentId] = useState<
    Partial<Record<AgentCliId, AgentCliConnectionCheck>>
  >({});
  const [loadingMessage, setLoadingMessage] = useState('Codex CLI 연결 설정을 불러오는 중입니다.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingAgentIds, setSavingAgentIds] = useState<Partial<Record<AgentCliId, boolean>>>({});
  const [checkingAgentIds, setCheckingAgentIds] = useState<Partial<Record<AgentCliId, boolean>>>({});

  async function loadConnections(): Promise<void> {
    const sddApi = getSddApi();
    if (!sddApi) {
      setConnections([]);
      setDraftsByAgentId({});
      setCheckResultsByAgentId({});
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      setLoadingMessage('설정 화면을 불러오지 못했습니다.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setLoadingMessage('Codex CLI 연결 설정을 불러오는 중입니다.');

    const result = await sddApi.settings.listAgentCliConnections();
    if (!result.ok) {
      setConnections([]);
      setDraftsByAgentId({});
      setCheckResultsByAgentId({});
      setErrorMessage(result.error.message);
      setLoadingMessage('설정 정보를 불러오지 못했습니다.');
      setIsLoading(false);
      return;
    }

    setConnections(result.value);
    setDraftsByAgentId((current) => ({
      ...buildDraftsByAgentId(result.value),
      ...current,
    }));
    setLoadingMessage('연결 설정을 확인했습니다.');
    setIsLoading(false);
  }

  useEffect(() => {
    void loadConnections();
  }, []);

  async function handleSaveConnection(agentId: AgentCliId): Promise<void> {
    const sddApi = getSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return;
    }

    const draft = draftsByAgentId[agentId];
    if (!draft) {
      return;
    }

    setSavingAgentIds((current) => ({ ...current, [agentId]: true }));
    setErrorMessage(null);

    try {
      const result = await sddApi.settings.saveAgentCliConnection({
        agentId,
        commandMode: draft.commandMode,
        executablePath: draft.commandMode === 'custom' ? draft.executablePath : null,
        authMode: draft.authMode,
      });

      if (!result.ok) {
        setErrorMessage(result.error.message);
        setLoadingMessage('설정 저장에 실패했습니다.');
        return;
      }

      setConnections((current) =>
        current.map((connection) =>
          connection.definition.agentId === agentId ? result.value : connection,
        ),
      );
      setDraftsByAgentId((current) => ({
        ...current,
        [agentId]: createDraftFromRecord(result.value),
      }));
      setLoadingMessage('설정을 저장했습니다. 연결 확인을 이어서 진행할 수 있습니다.');
    } finally {
      setSavingAgentIds((current) => ({ ...current, [agentId]: false }));
    }
  }

  async function handleCheckConnection(agentId: AgentCliId): Promise<void> {
    const sddApi = getSddApi();
    if (!sddApi) {
      setErrorMessage('앱 연결 상태를 확인할 수 없습니다.');
      return;
    }

    const draft = draftsByAgentId[agentId];
    if (!draft) {
      return;
    }

    setCheckingAgentIds((current) => ({ ...current, [agentId]: true }));
    setErrorMessage(null);

    try {
      const result = await sddApi.settings.checkAgentCliConnection({
        agentId,
        commandMode: draft.commandMode,
        executablePath: draft.commandMode === 'custom' ? draft.executablePath : null,
        authMode: draft.authMode,
      });

      if (!result.ok) {
        setErrorMessage(result.error.message);
        setLoadingMessage('연결 확인에 실패했습니다.');
        return;
      }

      setCheckResultsByAgentId((current) => ({
        ...current,
        [agentId]: result.value,
      }));
      setLoadingMessage(result.value.message);
    } finally {
      setCheckingAgentIds((current) => ({ ...current, [agentId]: false }));
    }
  }

  const state: AgentCliSettingsWorkbenchState = {
    connections,
    draftsByAgentId,
    checkResultsByAgentId,
    loadingMessage,
    errorMessage,
    isLoading,
    savingAgentIds,
    checkingAgentIds,
    connectionCount: connections.length,
    hasConnections: connections.length > 0,
  };

  return {
    ...state,
    actions: {
      onChangeCommandMode(agentId: AgentCliId, commandMode: AgentCliCommandMode) {
        setDraftsByAgentId((current) => {
          const existing = current[agentId];
          if (!existing) {
            return current;
          }

          return {
            ...current,
            [agentId]: {
              ...existing,
              commandMode,
              executablePath: commandMode === 'custom' ? existing.executablePath : '',
            },
          };
        });
      },
      onChangeExecutablePath(agentId: AgentCliId, executablePath: string) {
        setDraftsByAgentId((current) => {
          const existing = current[agentId];
          if (!existing) {
            return current;
          }

          return {
            ...current,
            [agentId]: {
              ...existing,
              executablePath,
            },
          };
        });
      },
      onChangeAuthMode(agentId: AgentCliId, authMode: AgentCliAuthMode) {
        setDraftsByAgentId((current) => {
          const existing = current[agentId];
          if (!existing) {
            return current;
          }

          return {
            ...current,
            [agentId]: {
              ...existing,
              authMode,
            },
          };
        });
      },
      onCheckConnection(agentId: AgentCliId) {
        return handleCheckConnection(agentId);
      },
      onRefresh() {
        return loadConnections();
      },
      onSaveConnection(agentId: AgentCliId) {
        return handleSaveConnection(agentId);
      },
    },
  };
}
