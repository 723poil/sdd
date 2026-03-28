import { useState } from 'react';

import type {
  AgentCliAuthMode,
  AgentCliCommandMode,
  AgentCliConnectionCheck,
  AgentCliConnectionRecord,
  AgentCliId,
  AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';
import { IconActionButton } from '@/renderer/components/IconActionButton';
import { ConnectionStatusPill } from '@/renderer/features/agent-cli-settings/components/ConnectionStatusPill';
import type { AgentCliConnectionDraft } from '@/renderer/features/agent-cli-settings/types';
import {
  AGENT_CLI_REASONING_EFFORT_OPTIONS,
  describeAgentCliAuthMode,
  describeAgentCliCommandMode,
  describeAgentCliModel,
  describeAgentCliReasoningEffort,
  formatSavedAt,
  getAgentCliCapabilityItems,
  getAgentCliModelOptionsForAgent,
} from '@/renderer/features/agent-cli-settings/utils';

interface AgentCliConnectionCardProps {
  checkLabel: string;
  checkTone: 'positive' | 'warning' | 'neutral' | 'danger';
  checkResult: AgentCliConnectionCheck | undefined;
  connection: AgentCliConnectionRecord;
  draft: AgentCliConnectionDraft;
  errorMessage: string | null;
  hasPendingChanges: boolean;
  isChecking: boolean;
  isDefaultAgent: boolean;
  isRefreshing: boolean;
  isSaving: boolean;
  isSavingSelection: boolean;
  onChangeAuthMode(agentId: AgentCliId, authMode: AgentCliAuthMode): void;
  onChangeCommandMode(agentId: AgentCliId, commandMode: AgentCliCommandMode): void;
  onChangeExecutablePath(agentId: AgentCliId, executablePath: string): void;
  onChangeModel(agentId: AgentCliId, model: string): void;
  onChangeModelReasoningEffort(
    agentId: AgentCliId,
    modelReasoningEffort: AgentCliModelReasoningEffort,
  ): void;
  onCheckConnection(agentId: AgentCliId): void;
  onRefresh(): void;
  onSaveConnection(agentId: AgentCliId): void;
  onSetDefaultAgent(agentId: AgentCliId): void;
}

export function AgentCliConnectionCard(props: AgentCliConnectionCardProps) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const agentId = props.connection.definition.agentId;
  const supportsModelSelection = props.connection.definition.capabilities.modelSelection;
  const supportsReasoningEffortSelection = props.connection.definition.capabilities.reasoningEffort;
  const supportsCustomPath = props.draft.commandMode === 'custom';
  const capabilityItems = getAgentCliCapabilityItems(props.connection);
  const saveStateLabel = props.hasPendingChanges ? '저장 필요' : '저장됨';
  const saveStateTone = props.hasPendingChanges ? 'warning' : 'neutral';
  const defaultActionLabel = props.isDefaultAgent
    ? props.isSavingSelection
      ? '기본 에이전트 저장 중'
      : '현재 기본 에이전트'
    : props.isSavingSelection
      ? '기본 에이전트 저장 중'
      : '기본 에이전트 지정';
  const checkActionLabel = props.isChecking ? '연결 확인 중' : '연결 확인';
  const saveActionLabel = props.isSaving ? '설정 저장 중' : '설정 저장';
  const refreshActionLabel = props.isRefreshing ? '설정 다시 불러오는 중' : '설정 다시 불러오기';
  const helpActionLabel = isHelpOpen ? '도움말 닫기' : '도움말 열기';
  const statusMessage = getInlineStatusMessage({
    isChecking: props.isChecking,
    isDefaultAgent: props.isDefaultAgent,
    isRefreshing: props.isRefreshing,
    isSaving: props.isSaving,
    isSavingSelection: props.isSavingSelection,
  });

  return (
    <article className="panel-card connection-inspector">
      <header className="connection-inspector__header">
        <div className="connection-inspector__heading">
          <div className="connection-inspector__title-row">
            <h3>{props.connection.definition.displayName}</h3>
            <div className="connection-inspector__pills">
              {props.isDefaultAgent ? <ConnectionStatusPill label="기본" tone="positive" /> : null}
              <ConnectionStatusPill label={props.checkLabel} tone={props.checkTone} />
              <ConnectionStatusPill label={saveStateLabel} tone={saveStateTone} />
            </div>
          </div>
          <div className="connection-inspector__meta">
            <div className="connection-inspector__meta-item">
              <span>최근 저장</span>
              <strong>{formatSavedAt(props.connection.settings.updatedAt)}</strong>
            </div>
            <div className="connection-inspector__meta-item">
              <span>실행 방식</span>
              <strong>{describeAgentCliCommandMode(props.draft.commandMode)}</strong>
            </div>
            {supportsModelSelection ? (
              <div className="connection-inspector__meta-item">
                <span>모델</span>
                <strong>{describeAgentCliModel(props.draft.model)}</strong>
              </div>
            ) : null}
          </div>
        </div>

        <div className="connection-inspector__actions" aria-label="선택된 에이전트 작업">
          <IconActionButton
            aria-pressed={props.isDefaultAgent}
            disabled={props.isSavingSelection}
            icon={<StarIcon />}
            isActive={props.isDefaultAgent}
            label={defaultActionLabel}
            onClick={() => {
              props.onSetDefaultAgent(agentId);
            }}
          />
          <IconActionButton
            disabled={props.isChecking}
            icon={<CheckConnectionIcon />}
            label={checkActionLabel}
            onClick={() => {
              props.onCheckConnection(agentId);
            }}
          />
          <IconActionButton
            disabled={props.isSaving}
            icon={<SaveIcon />}
            label={saveActionLabel}
            onClick={() => {
              props.onSaveConnection(agentId);
            }}
            tone="primary"
          />
          <IconActionButton
            disabled={props.isRefreshing}
            icon={<RefreshIcon />}
            label={refreshActionLabel}
            onClick={() => {
              props.onRefresh();
            }}
          />
          <IconActionButton
            aria-expanded={isHelpOpen}
            icon={<HelpIcon />}
            isActive={isHelpOpen}
            label={helpActionLabel}
            onClick={() => {
              setIsHelpOpen((current) => !current);
            }}
          />
        </div>
      </header>

      {statusMessage ? <p className="connection-inspector__status-note">{statusMessage}</p> : null}
      {props.errorMessage ? (
        <p className="helper-text helper-text--alert connection-inspector__status-note">
          {props.errorMessage}
        </p>
      ) : null}

      {isHelpOpen ? (
        <div className="connection-inspector__help">
          <section className="connection-inspector__help-section">
            <strong>에이전트</strong>
            <p>{props.connection.definition.description}</p>
          </section>
          <section className="connection-inspector__help-section">
            <strong>실행 경로</strong>
            <p>
              시스템 기본값은 PATH와 대표 설치 위치를 함께 탐색합니다. 직접 지정은 실행 파일 위치를
              명확히 알고 있을 때만 사용하면 됩니다.
            </p>
          </section>
          <section className="connection-inspector__help-section">
            <strong>인증 방식</strong>
            <p>
              이 에이전트에서 지원하는 인증만 보여줍니다.
              {` ${props.connection.definition.supportedAuthModes.map(describeAgentCliAuthMode).join(' · ')}`}
            </p>
          </section>
          <section className="connection-inspector__help-section">
            <strong>모델과 추론</strong>
            <p>
              모델은 현재 에이전트가 지원하는 항목만 노출합니다.
              {supportsReasoningEffortSelection
                ? ' 추론 강도는 속도보다 깊이가 중요할수록 높게 조정하면 됩니다.'
                : ' 이 에이전트는 추론 강도 조정을 제공하지 않습니다.'}
            </p>
          </section>
        </div>
      ) : null}

      <div className="connection-inspector__capabilities" aria-label="현재 지원 기능">
        {capabilityItems.map((item) => (
          <span
            className={`connection-inspector__capability${item.enabled ? ' connection-inspector__capability--enabled' : ''}`}
            key={item.label}
          >
            {item.label}
          </span>
        ))}
      </div>

      <div className="connection-form connection-form--dense">
        <div className="field-group connection-form__field connection-form__field--wide">
          <label className="field-label">실행 방식</label>
          <div className="segmented-control">
            <label
              className={`segmented-control__option ${props.draft.commandMode === 'system' ? 'segmented-control__option--selected' : ''}`}
            >
              <input
                checked={props.draft.commandMode === 'system'}
                name={`command-mode-${agentId}`}
                onChange={() => {
                  props.onChangeCommandMode(agentId, 'system');
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
                name={`command-mode-${agentId}`}
                onChange={() => {
                  props.onChangeCommandMode(agentId, 'custom');
                }}
                type="radio"
                value="custom"
              />
              직접 지정
            </label>
          </div>
        </div>

        <div className="field-group connection-form__field connection-form__field--wide">
          <label className="field-label">실행 경로</label>
          <input
            className="text-input"
            disabled={!supportsCustomPath}
            onChange={(event) => {
              props.onChangeExecutablePath(agentId, event.target.value);
            }}
            placeholder={`예: /opt/homebrew/bin/${props.connection.definition.defaultExecutableName}`}
            value={props.draft.executablePath}
          />
          {!supportsCustomPath ? (
            <p className="field-hint">직접 지정을 선택하면 실행 경로를 입력할 수 있습니다.</p>
          ) : null}
        </div>

        <div className="field-group connection-form__field">
          <label className="field-label">인증 방식</label>
          <div className="select-row">
            <select
              className="select-input"
              onChange={(event) => {
                props.onChangeAuthMode(agentId, event.target.value as AgentCliAuthMode);
              }}
              value={props.draft.authMode}
            >
              {props.connection.definition.supportedAuthModes.map((authMode) => (
                <option key={authMode} value={authMode}>
                  {describeAgentCliAuthMode(authMode)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {supportsModelSelection ? (
          <div className="field-group connection-form__field">
            <label className="field-label">모델</label>
            <div className="select-row">
              <select
                className="select-input"
                onChange={(event) => {
                  props.onChangeModel(agentId, event.target.value);
                }}
                value={props.draft.model}
              >
                {getAgentCliModelOptionsForAgent(agentId, props.draft.model).map((model) => (
                  <option key={model} value={model}>
                    {describeAgentCliModel(model)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        {supportsReasoningEffortSelection ? (
          <div className="field-group connection-form__field">
            <label className="field-label">추론 강도</label>
            <div className="select-row">
              <select
                className="select-input"
                onChange={(event) => {
                  props.onChangeModelReasoningEffort(
                    agentId,
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
          </div>
        ) : null}
      </div>

      {!supportsReasoningEffortSelection ? (
        <p className="field-hint connection-inspector__status-note">
          이 에이전트는 추론 강도 조정을 지원하지 않아 관련 필드를 숨겼습니다.
        </p>
      ) : null}

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
    </article>
  );
}

function getInlineStatusMessage(input: {
  isChecking: boolean;
  isDefaultAgent: boolean;
  isRefreshing: boolean;
  isSaving: boolean;
  isSavingSelection: boolean;
}): string | null {
  if (input.isSaving) {
    return '설정을 저장하는 중입니다.';
  }

  if (input.isChecking) {
    return '연결을 확인하는 중입니다.';
  }

  if (input.isSavingSelection && input.isDefaultAgent) {
    return '기본 에이전트를 저장하는 중입니다.';
  }

  if (input.isRefreshing) {
    return '설정을 다시 불러오는 중입니다.';
  }

  return null;
}

function StarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path
        d="m10 3 2.1 4.35 4.8.7-3.45 3.35.82 4.78L10 13.95 5.73 16.2l.82-4.78L3.1 8.05l4.8-.7Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CheckConnectionIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path
        d="M4.5 10.5h3l2 3 4-7h2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="10" cy="10" fill="none" r="7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path
        d="M4.5 4.5h8l3 3v8h-11Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M7 4.5v4h5v-4M7 15.5h6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path
        d="M15.5 7.5V4.5h-3M4.5 12.5v3h3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M14.8 9a5.5 5.5 0 0 0-9.18-2.85L4.5 7.5M5.2 11A5.5 5.5 0 0 0 14.38 13.85l1.12-1.35"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path
        d="M7.8 7.4a2.45 2.45 0 1 1 4.1 1.82c-.77.63-1.4 1.12-1.4 2.28M10 14.7h.01"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="10" cy="10" fill="none" r="7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
