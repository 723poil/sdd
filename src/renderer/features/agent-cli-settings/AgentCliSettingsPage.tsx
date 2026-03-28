import { useEffect, useState } from 'react';

import type {
  AgentCliAuthMode,
  AgentCliCommandMode,
  AgentCliId,
  AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';
import type { AppView } from '@/renderer/app-view';
import { AppViewSwitcher } from '@/renderer/components/AppViewSwitcher';
import { AgentCliConnectionCard } from '@/renderer/features/agent-cli-settings/components/AgentCliConnectionCard';
import { AgentCliConnectionListItem } from '@/renderer/features/agent-cli-settings/components/AgentCliConnectionListItem';
import { useAgentCliSettingsWorkflow } from '@/renderer/features/agent-cli-settings/use-agent-cli-settings-workflow';
import {
  getConnectionCheckLabel,
  getConnectionCheckTone,
  hasAgentCliConnectionDraftChanges,
} from '@/renderer/features/agent-cli-settings/utils';

interface AgentCliSettingsPageProps {
  activeAppView: AppView;
  onSelectAppView: (view: AppView) => void;
}

export function AgentCliSettingsPage(props: AgentCliSettingsPageProps) {
  const workbench = useAgentCliSettingsWorkflow();
  const [activeAgentId, setActiveAgentId] = useState<AgentCliId | null>(null);

  useEffect(() => {
    if (workbench.connections.length === 0) {
      setActiveAgentId(null);
      return;
    }

    setActiveAgentId((current) => {
      if (
        current &&
        workbench.connections.some((connection) => connection.definition.agentId === current)
      ) {
        return current;
      }

      const matchingDefaultConnection = workbench.connections.find(
        (connection) => connection.definition.agentId === workbench.selectedAgentId,
      );
      const firstConnection = workbench.connections[0];

      return (
        matchingDefaultConnection?.definition.agentId ?? firstConnection?.definition.agentId ?? null
      );
    });
  }, [workbench.connections, workbench.selectedAgentId]);

  const activeConnection =
    workbench.connections.find((connection) => connection.definition.agentId === activeAgentId) ??
    null;
  const activeDraft = activeAgentId ? workbench.draftsByAgentId[activeAgentId] : undefined;
  const activeCheckResult = activeAgentId
    ? workbench.checkResultsByAgentId[activeAgentId]
    : undefined;
  const activeHasPendingChanges =
    activeConnection && activeDraft
      ? hasAgentCliConnectionDraftChanges(activeConnection, activeDraft)
      : false;

  const handleChangeAuthMode = (agentId: AgentCliId, authMode: AgentCliAuthMode) => {
    workbench.actions.onChangeAuthMode(agentId, authMode);
  };
  const handleChangeCommandMode = (agentId: AgentCliId, commandMode: AgentCliCommandMode) => {
    workbench.actions.onChangeCommandMode(agentId, commandMode);
  };
  const handleChangeExecutablePath = (agentId: AgentCliId, executablePath: string) => {
    workbench.actions.onChangeExecutablePath(agentId, executablePath);
  };
  const handleCheckConnection = (agentId: AgentCliId) => {
    void workbench.actions.onCheckConnection(agentId);
  };
  const handleChangeModel = (agentId: AgentCliId, model: string) => {
    workbench.actions.onChangeModel(agentId, model);
  };
  const handleChangeModelReasoningEffort = (
    agentId: AgentCliId,
    modelReasoningEffort: AgentCliModelReasoningEffort,
  ) => {
    workbench.actions.onChangeModelReasoningEffort(agentId, modelReasoningEffort);
  };
  const handleSaveConnection = (agentId: AgentCliId) => {
    void workbench.actions.onSaveConnection(agentId);
  };
  const handleSetDefaultAgent = (agentId: AgentCliId) => {
    void workbench.actions.onSelectAgent(agentId);
  };
  const handleRefresh = () => {
    void workbench.actions.onRefresh();
  };

  return (
    <div className="settings-shell">
      <main className="settings-page">
        <header className="settings-page__header">
          <div>
            <p className="section-label">설정</p>
            <h2>CLI 에이전트</h2>
          </div>
        </header>

        {workbench.hasConnections ? (
          <section className="settings-agent-workspace">
            <aside className="panel-card settings-agent-list">
              <header className="settings-agent-list__header">
                <h3>에이전트 목록</h3>
                <span className="settings-agent-list__count">{workbench.connectionCount}</span>
              </header>

              <div className="settings-agent-list__body">
                {workbench.connections.map((connection) => {
                  const draft = workbench.draftsByAgentId[connection.definition.agentId];
                  if (!draft) {
                    return null;
                  }

                  const checkResult =
                    workbench.checkResultsByAgentId[connection.definition.agentId];

                  return (
                    <AgentCliConnectionListItem
                      checkLabel={getConnectionCheckLabel(checkResult)}
                      checkTone={getConnectionCheckTone(checkResult)}
                      connection={connection}
                      draft={draft}
                      hasPendingChanges={hasAgentCliConnectionDraftChanges(connection, draft)}
                      isActive={activeAgentId === connection.definition.agentId}
                      isChecking={Boolean(
                        workbench.checkingAgentIds[connection.definition.agentId],
                      )}
                      isDefaultAgent={workbench.selectedAgentId === connection.definition.agentId}
                      isSaving={Boolean(workbench.savingAgentIds[connection.definition.agentId])}
                      key={connection.definition.agentId}
                      onSelect={setActiveAgentId}
                    />
                  );
                })}
              </div>
            </aside>

            <section className="settings-agent-detail">
              {activeConnection && activeDraft ? (
                <AgentCliConnectionCard
                  checkLabel={
                    workbench.checkingAgentIds[activeConnection.definition.agentId]
                      ? '확인 중'
                      : getConnectionCheckLabel(activeCheckResult)
                  }
                  checkResult={activeCheckResult}
                  checkTone={
                    workbench.checkingAgentIds[activeConnection.definition.agentId]
                      ? 'neutral'
                      : getConnectionCheckTone(activeCheckResult)
                  }
                  connection={activeConnection}
                  draft={activeDraft}
                  errorMessage={workbench.errorMessage}
                  hasPendingChanges={activeHasPendingChanges}
                  isChecking={Boolean(
                    workbench.checkingAgentIds[activeConnection.definition.agentId],
                  )}
                  isDefaultAgent={workbench.selectedAgentId === activeConnection.definition.agentId}
                  isRefreshing={workbench.isLoading}
                  isSaving={Boolean(workbench.savingAgentIds[activeConnection.definition.agentId])}
                  isSavingSelection={workbench.isSavingSelectedAgentId}
                  onChangeAuthMode={handleChangeAuthMode}
                  onChangeCommandMode={handleChangeCommandMode}
                  onChangeExecutablePath={handleChangeExecutablePath}
                  onChangeModel={handleChangeModel}
                  onChangeModelReasoningEffort={handleChangeModelReasoningEffort}
                  onCheckConnection={handleCheckConnection}
                  onRefresh={handleRefresh}
                  onSaveConnection={handleSaveConnection}
                  onSetDefaultAgent={handleSetDefaultAgent}
                />
              ) : (
                <section className="panel-card settings-empty-state">
                  <header className="card-header">
                    <h3>에이전트를 선택해 주세요</h3>
                  </header>
                  <p className="helper-text">
                    목록에서 항목을 선택하면 해당 에이전트 설정만 집중해서 수정할 수 있습니다.
                  </p>
                </section>
              )}
            </section>
          </section>
        ) : (
          <section className="panel-card settings-empty-state">
            <header className="card-header">
              <h3>
                {workbench.isLoading
                  ? '설정을 불러오는 중입니다'
                  : 'CLI 에이전트를 불러오지 못했습니다'}
              </h3>
            </header>
            <p className="helper-text">{workbench.errorMessage ?? workbench.loadingMessage}</p>
            <div className="settings-empty-state__actions">
              <button className="secondary-button" onClick={handleRefresh} type="button">
                다시 불러오기
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="settings-footer-bar">
        <AppViewSwitcher
          activeView={props.activeAppView}
          className="app-switcher app-switcher--embedded settings-footer-bar__switcher"
          onSelectView={props.onSelectAppView}
        />
      </footer>
    </div>
  );
}
