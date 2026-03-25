import type {
  AgentCliAuthMode,
  AgentCliCommandMode,
  AgentCliId,
  AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';

import type { AppView } from '@/renderer/app-view';
import { AppViewSwitcher } from '@/renderer/components/AppViewSwitcher';
import { AgentCliConnectionCard } from '@/renderer/features/agent-cli-settings/components/AgentCliConnectionCard';
import { ConnectionStatusPill } from '@/renderer/features/agent-cli-settings/components/ConnectionStatusPill';
import { useAgentCliSettingsWorkflow } from '@/renderer/features/agent-cli-settings/use-agent-cli-settings-workflow';
import {
  getConnectionCheckLabel,
  getConnectionCheckTone,
} from '@/renderer/features/agent-cli-settings/utils';

interface AgentCliSettingsPageProps {
  activeAppView: AppView;
  onSelectAppView: (view: AppView) => void;
}

export function AgentCliSettingsPage(props: AgentCliSettingsPageProps) {
  const workbench = useAgentCliSettingsWorkflow();
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

  return (
    <div className="settings-shell">
      <main className="settings-page">
        <section className="settings-overview panel-card">
          <div className="settings-overview__copy">
            <p className="section-label">설정</p>
            <h2>Codex 연결</h2>
            <p className="hero-description">
              Codex CLI 경로, 인증 방식, 모델, 추론 강도를 저장하고 연결을 확인합니다.
            </p>
          </div>
          <div className="settings-overview__actions">
            <ConnectionStatusPill
              label={workbench.isLoading ? '불러오는 중' : 'Codex CLI'}
              tone={workbench.isLoading ? 'neutral' : 'positive'}
            />
            <button
              className="secondary-button"
              onClick={() => {
                void workbench.actions.onRefresh();
              }}
              type="button"
            >
              다시 불러오기
            </button>
          </div>
        </section>

        {workbench.errorMessage ? (
          <section className="panel-card panel-card--alert">
            <header className="card-header">
              <h3>알림</h3>
            </header>
            <p className="helper-text helper-text--alert">{workbench.errorMessage}</p>
          </section>
        ) : null}

        {workbench.hasConnections ? (
          <section className="settings-connection-list">
            {workbench.connections.map((connection) => {
              const draft = workbench.draftsByAgentId[connection.definition.agentId];
              if (!draft) {
                return null;
              }

              const checkResult = workbench.checkResultsByAgentId[connection.definition.agentId];

              return (
                <AgentCliConnectionCard
                  checkLabel={getConnectionCheckLabel(checkResult)}
                  checkTone={getConnectionCheckTone(checkResult)}
                  checkResult={checkResult}
                  connection={connection}
                  draft={draft}
                  isChecking={Boolean(workbench.checkingAgentIds[connection.definition.agentId])}
                  isSaving={Boolean(workbench.savingAgentIds[connection.definition.agentId])}
                  key={connection.definition.agentId}
                  onChangeAuthMode={handleChangeAuthMode}
                  onChangeCommandMode={handleChangeCommandMode}
                  onChangeExecutablePath={handleChangeExecutablePath}
                  onChangeModel={handleChangeModel}
                  onChangeModelReasoningEffort={handleChangeModelReasoningEffort}
                  onCheckConnection={handleCheckConnection}
                  onSaveConnection={handleSaveConnection}
                />
              );
            })}
          </section>
        ) : (
          <section className="panel-card">
            <header className="card-header">
              <h3>Codex 설정을 불러오지 못했습니다</h3>
            </header>
            <p className="helper-text">{workbench.loadingMessage}</p>
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
