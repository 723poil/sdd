import { useEffect, useState } from 'react';

import type {
  AgentCliAuthMode,
  AgentCliCommandMode,
  AgentCliConnectionCheck,
  AgentCliConnectionRecord,
  AgentCliId,
  AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';

import type {
  AgentCliConnectionDraft,
  AgentCliConnectionDraftMap,
  AgentCliSettingsWorkbenchState,
} from '@/renderer/features/agent-cli-settings/types';
import {
  buildDraftsByAgentId,
  createDraftFromRecord,
  getAgentCliSettingsApi,
  patchDraftByAgentId,
} from '@/renderer/features/agent-cli-settings/agent-cli-settings.api';

export function useAgentCliSettingsWorkflow(): {
  connections: AgentCliConnectionRecord[];
  draftsByAgentId: AgentCliConnectionDraftMap;
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
    onChangeModel(agentId: AgentCliId, model: string): void;
    onChangeModelReasoningEffort(
      agentId: AgentCliId,
      modelReasoningEffort: AgentCliModelReasoningEffort,
    ): void;
    onCheckConnection(agentId: AgentCliId): Promise<void>;
    onRefresh(): Promise<void>;
    onSaveConnection(agentId: AgentCliId): Promise<void>;
  };
} {
  const [connections, setConnections] = useState<AgentCliConnectionRecord[]>([]);
  const [draftsByAgentId, setDraftsByAgentId] = useState<AgentCliConnectionDraftMap>({});
  const [checkResultsByAgentId, setCheckResultsByAgentId] = useState<
    Partial<Record<AgentCliId, AgentCliConnectionCheck>>
  >({});
  const [loadingMessage, setLoadingMessage] = useState('Codex CLI 연결 설정을 불러오는 중입니다.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingAgentIds, setSavingAgentIds] = useState<Partial<Record<AgentCliId, boolean>>>({});
  const [checkingAgentIds, setCheckingAgentIds] = useState<Partial<Record<AgentCliId, boolean>>>({});

  const applyDraftPatch = (agentId: AgentCliId, patch: Partial<AgentCliConnectionDraft>) => {
    setDraftsByAgentId((current) => patchDraftByAgentId(current, agentId, patch));
  };

  async function loadConnections(): Promise<void> {
    const settingsApi = getAgentCliSettingsApi();
    if (!settingsApi) {
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

    const result = await settingsApi.listAgentCliConnections();
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
    setDraftsByAgentId(buildDraftsByAgentId(result.value));
    setLoadingMessage('연결 설정을 확인했습니다.');
    setIsLoading(false);
  }

  useEffect(() => {
    void loadConnections();
  }, []);

  async function handleSaveConnection(agentId: AgentCliId): Promise<void> {
    const settingsApi = getAgentCliSettingsApi();
    if (!settingsApi) {
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
      const result = await settingsApi.saveAgentCliConnection({
        agentId,
        commandMode: draft.commandMode,
        executablePath: draft.commandMode === 'custom' ? draft.executablePath : null,
        authMode: draft.authMode,
        model: draft.model,
        modelReasoningEffort: draft.modelReasoningEffort,
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
    const settingsApi = getAgentCliSettingsApi();
    if (!settingsApi) {
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
      const result = await settingsApi.checkAgentCliConnection({
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

          return patchDraftByAgentId(current, agentId, {
            commandMode,
            executablePath: commandMode === 'custom' ? existing.executablePath : '',
          });
        });
      },
      onChangeExecutablePath(agentId: AgentCliId, executablePath: string) {
        applyDraftPatch(agentId, { executablePath });
      },
      onChangeAuthMode(agentId: AgentCliId, authMode: AgentCliAuthMode) {
        applyDraftPatch(agentId, { authMode });
      },
      onChangeModel(agentId: AgentCliId, model: string) {
        applyDraftPatch(agentId, { model });
      },
      onChangeModelReasoningEffort(
        agentId: AgentCliId,
        modelReasoningEffort: AgentCliModelReasoningEffort,
      ) {
        applyDraftPatch(agentId, { modelReasoningEffort });
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
