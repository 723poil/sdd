import type {
  AgentCliAuthMode,
  AgentCliCommandMode,
  AgentCliConnectionCheck,
  AgentCliConnectionRecord,
  AgentCliId,
  AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';

import { ConnectionStatusPill } from '@/renderer/features/agent-cli-settings/components/ConnectionStatusPill';
import {
  AGENT_CLI_REASONING_EFFORT_OPTIONS,
  describeAgentCliAuthMode,
  describeAgentCliCommandMode,
  describeAgentCliModel,
  describeAgentCliReasoningEffort,
  formatSavedAt,
  getAgentCliModelOptions,
} from '@/renderer/features/agent-cli-settings/utils';
import type { AgentCliConnectionDraft } from '@/renderer/features/agent-cli-settings/types';

interface AgentCliConnectionCardProps {
  connection: AgentCliConnectionRecord;
  draft: AgentCliConnectionDraft;
  checkResult: AgentCliConnectionCheck | undefined;
  checkLabel: string;
  checkTone: 'positive' | 'warning' | 'neutral' | 'danger';
  isSaving: boolean;
  isChecking: boolean;
  onChangeCommandMode(agentId: AgentCliId, commandMode: AgentCliCommandMode): void;
  onChangeExecutablePath(agentId: AgentCliId, executablePath: string): void;
  onChangeAuthMode(agentId: AgentCliId, authMode: AgentCliAuthMode): void;
  onChangeModel(agentId: AgentCliId, model: string): void;
  onChangeModelReasoningEffort(
    agentId: AgentCliId,
    modelReasoningEffort: AgentCliModelReasoningEffort,
  ): void;
  onCheckConnection(agentId: AgentCliId): void;
  onSaveConnection(agentId: AgentCliId): void;
}

export function AgentCliConnectionCard(props: AgentCliConnectionCardProps) {
  const supportsCustomPath = props.draft.commandMode === 'custom';

  return (
    <article className="panel-card connection-card">
      <header className="card-header">
        <div className="connection-card__title">
          <p className="section-label">Codex CLI</p>
          <h3>{props.connection.definition.displayName}</h3>
        </div>
        <ConnectionStatusPill
          label={props.checkLabel}
          tone={props.checkTone}
        />
      </header>

      <p className="helper-text connection-card__description">{props.connection.definition.description}</p>

      <div className="connection-meta-grid">
        <div className="connection-meta-item">
          <span>최근 저장</span>
          <strong>{formatSavedAt(props.connection.settings.updatedAt)}</strong>
        </div>
        <div className="connection-meta-item">
          <span>인증 방식</span>
          <strong>{describeAgentCliAuthMode(props.draft.authMode)}</strong>
        </div>
        <div className="connection-meta-item">
          <span>실행 경로</span>
          <strong>{describeAgentCliCommandMode(props.draft.commandMode)}</strong>
        </div>
        <div className="connection-meta-item">
          <span>모델</span>
          <strong>{describeAgentCliModel(props.draft.model)}</strong>
        </div>
        <div className="connection-meta-item">
          <span>추론</span>
          <strong>{describeAgentCliReasoningEffort(props.draft.modelReasoningEffort)}</strong>
        </div>
      </div>

      <div className="connection-form">
        <div className="field-group">
          <label className="field-label">실행 경로</label>
          <div className="segmented-control">
            <label
              className={`segmented-control__option ${props.draft.commandMode === 'system' ? 'segmented-control__option--selected' : ''}`}
            >
              <input
                checked={props.draft.commandMode === 'system'}
                name={`command-mode-${props.connection.definition.agentId}`}
                onChange={() => {
                  props.onChangeCommandMode(props.connection.definition.agentId, 'system');
                }}
                type="radio"
                value="system"
              />
              시스템 기본값
            </label>
            <label
              className={`segmented-control__option ${props.draft.commandMode === 'custom' ? 'segmented-control__option--selected' : ''}`}
            >
              <input
                checked={props.draft.commandMode === 'custom'}
                name={`command-mode-${props.connection.definition.agentId}`}
                onChange={() => {
                  props.onChangeCommandMode(props.connection.definition.agentId, 'custom');
                }}
                type="radio"
                value="custom"
              />
              직접 지정
            </label>
          </div>
          <input
            className="text-input"
            disabled={!supportsCustomPath}
            onChange={(event) => {
              props.onChangeExecutablePath(props.connection.definition.agentId, event.target.value);
            }}
            placeholder="예: /opt/homebrew/bin/codex"
            value={props.draft.executablePath}
          />
          <p className="field-hint">
            시스템 기본값은 PATH 와 기본 설치 위치에서 `codex`를 찾습니다. 직접 지정은 실행 파일 경로를 명시할 때 사용합니다.
          </p>
        </div>

        <div className="field-group">
          <label className="field-label">인증 방식</label>
          <div className="select-row">
            <select
              className="select-input"
              onChange={(event) => {
                props.onChangeAuthMode(
                  props.connection.definition.agentId,
                  event.target.value as AgentCliAuthMode,
                );
              }}
              value={props.draft.authMode}
            >
              {props.connection.definition.supportedAuthModes.map((authMode) => (
                <option
                  key={authMode}
                  value={authMode}
                >
                  {describeAgentCliAuthMode(authMode)}
                </option>
              ))}
            </select>
          </div>
          <p className="field-hint">
            개인 사용이면 ChatGPT 로그인을, 앱 자동화용 환경이면 API key를 선택하세요.
          </p>
        </div>

        <div className="field-group">
          <label className="field-label">모델</label>
          <div className="select-row">
            <select
              className="select-input"
              onChange={(event) => {
                props.onChangeModel(props.connection.definition.agentId, event.target.value);
              }}
              value={props.draft.model}
            >
              {getAgentCliModelOptions(props.draft.model).map((model) => (
                <option key={model} value={model}>
                  {describeAgentCliModel(model)}
                </option>
              ))}
            </select>
          </div>
          <p className="field-hint">분석과 채팅 실행에 사용할 Codex 모델입니다.</p>
        </div>

        <div className="field-group">
          <label className="field-label">추론 강도</label>
          <div className="select-row">
            <select
              className="select-input"
              onChange={(event) => {
                props.onChangeModelReasoningEffort(
                  props.connection.definition.agentId,
                  event.target.value as AgentCliModelReasoningEffort,
                );
              }}
              value={props.draft.modelReasoningEffort}
            >
              {AGENT_CLI_REASONING_EFFORT_OPTIONS.map((modelReasoningEffort) => (
                <option key={modelReasoningEffort} value={modelReasoningEffort}>
                  {describeAgentCliReasoningEffort(modelReasoningEffort)}
                </option>
              ))}
            </select>
          </div>
          <p className="field-hint">깊이보다 속도가 중요하면 낮추고, 복잡한 작업이면 높이세요.</p>
        </div>
      </div>

      {props.checkResult ? (
        <div className="connection-check-result">
          <strong>{props.checkResult.message}</strong>
          <p>
            {props.checkResult.resolvedCommand
              ? `실행 경로: ${props.checkResult.resolvedCommand}`
              : '실행 경로를 확인하지 못했습니다.'}
          </p>
          {props.checkResult.version ? <p>버전 정보: {props.checkResult.version}</p> : null}
        </div>
      ) : null}

      <div className="connection-card__actions">
        <button
          className="secondary-button"
          disabled={props.isChecking}
          onClick={() => {
            props.onCheckConnection(props.connection.definition.agentId);
          }}
          type="button"
        >
          {props.isChecking ? '확인 중...' : '연결 확인'}
        </button>
        <button
          className="primary-button"
          disabled={props.isSaving}
          onClick={() => {
            props.onSaveConnection(props.connection.definition.agentId);
          }}
          type="button"
        >
          {props.isSaving ? '저장 중...' : '설정 저장'}
        </button>
      </div>
    </article>
  );
}
