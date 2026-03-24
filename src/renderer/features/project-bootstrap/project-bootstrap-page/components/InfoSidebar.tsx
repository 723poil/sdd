import { useEffect, useRef } from 'react';

import {
  AGENT_CLI_MODEL_OPTIONS,
  AGENT_CLI_MODEL_REASONING_EFFORTS,
  type AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';
import type { ProjectInspection } from '@/domain/project/project-model';
import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
import type {
  ProjectSessionMessage,
  ProjectSessionMessageRole,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';
import type {
  SelectedProjectAnalysisDocumentId,
  StructuredProjectAnalysis,
  WorkspacePageId,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

interface InfoSidebarProps {
  activeWorkspacePage: WorkspacePageId;
  analysis: StructuredProjectAnalysis | null;
  canAnalyzeProject: boolean;
  canAnalyzeReferences: boolean;
  canCancelAnalysis: boolean;
  canCreateSpec: boolean;
  inspection: ProjectInspection | null;
  isAnalyzing: boolean;
  isCancellingAnalysis: boolean;
  isCreatingSpec: boolean;
  selectedAnalysisDocumentId: SelectedProjectAnalysisDocumentId;
  selectedSpec: ProjectSpecDocument | null;
  selectedSession: ProjectSessionSummary | null;
  sessionMessages: ProjectSessionMessage[];
  draftMessage: string;
  chatModel: string;
  chatReasoningEffort: AgentCliModelReasoningEffort;
  isCreatingSession: boolean;
  isSendingMessage: boolean;
  isSavingChatRuntimeSettings: boolean;
  onChangeChatModel: (value: string) => void;
  onChangeChatReasoningEffort: (value: AgentCliModelReasoningEffort) => void;
  onChangeDraftMessage: (value: string) => void;
  onAnalyzeProject: () => void;
  onAnalyzeReferences: () => void;
  onCancelAnalysis: () => void;
  onCreateSpec: () => void;
  onSendMessage: () => void;
  onToggleSidebar: () => void;
}

interface TimelineMessage {
  createdAt: string;
  id: string;
  pending?: boolean;
  role: ProjectSessionMessageRole;
  text: string;
}

export function InfoSidebar(props: InfoSidebarProps) {
  const hasProjectContext = props.inspection?.initializationState === 'ready';
  const canWriteMessage =
    props.activeWorkspacePage === 'specs' &&
    props.selectedSpec !== null &&
    props.selectedSession !== null &&
    !props.isCreatingSession;
  const canSendMessage =
    canWriteMessage && props.draftMessage.trim().length > 0 && !props.isSendingMessage;
  const composerStatusMessage = props.isSavingChatRuntimeSettings
    ? '채팅 설정을 저장 중입니다.'
    : props.isSendingMessage
      ? '전송 중입니다.'
      : null;
  const chatLogEndRef = useRef<HTMLDivElement | null>(null);
  const timelineMessages = getTimelineMessages({
    draftMessage: props.draftMessage,
    isSendingMessage: props.isSendingMessage,
    sessionMessages: props.sessionMessages,
  });

  useEffect(() => {
    chatLogEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [timelineMessages.length]);

  return (
    <aside className="sidebar sidebar--sessions info-sidebar">
      <section className="sidebar-section info-sidebar__shell info-sidebar__shell--chat">
        <div className="sidebar-header info-sidebar__header">
          <div className="info-sidebar__heading">
            <div className="info-sidebar__brand-row">
              <span className="info-sidebar__brand">CODEX</span>
              <h3 className="info-sidebar__title">채팅</h3>
            </div>
            <p className="info-sidebar__subtitle">
              {!props.inspection
                ? '프로젝트를 선택하면 채팅을 시작할 수 있습니다.'
                : props.activeWorkspacePage !== 'specs'
                  ? '명세 페이지에서 채팅을 사용할 수 있습니다.'
                  : hasProjectContext
                  ? '질문을 입력해 주세요.'
                  : '채팅을 준비하는 중입니다.'}
            </p>
          </div>
          <button
            aria-label="오른쪽 채팅 패널 닫기"
            className="sidebar-icon-button"
            onClick={props.onToggleSidebar}
            type="button"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>

        {props.inspection ? (
          <>
            <div className="info-sidebar__action-bar">
              <button
                className="info-sidebar__action-button"
                disabled={!props.canAnalyzeProject || props.isAnalyzing}
                onClick={props.onAnalyzeProject}
                type="button"
              >
                전체 분석
              </button>
              <button
                className="info-sidebar__action-button"
                disabled={!props.canAnalyzeReferences || props.isAnalyzing}
                onClick={props.onAnalyzeReferences}
                type="button"
              >
                참조 분석
              </button>
              {props.isAnalyzing ? (
                <button
                  className="info-sidebar__action-button info-sidebar__action-button--danger"
                  disabled={!props.canCancelAnalysis || props.isCancellingAnalysis}
                  onClick={props.onCancelAnalysis}
                  type="button"
                >
                  {props.isCancellingAnalysis ? '취소 요청 중' : '분석 취소'}
                </button>
              ) : null}
              <button
                className="info-sidebar__action-button"
                disabled={!props.canCreateSpec || props.isCreatingSpec}
                onClick={props.onCreateSpec}
                type="button"
              >
                {props.isCreatingSpec ? '새 명세 준비 중' : '새 명세'}
              </button>
            </div>
            <div className="info-sidebar__context-bar">
              <span className="info-sidebar__context-label">선택한 명세</span>
              <span className="info-sidebar__context-value">
                {props.selectedSpec?.meta.title ?? '명세 선택 필요'}
              </span>
            </div>
          </>
        ) : null}

        <div className="info-sidebar__body info-sidebar__body--chat">
          <>
            <div className="info-sidebar-chat-log">
              {props.isCreatingSession ? (
                <div className="info-sidebar-chat-empty info-sidebar-chat-empty--centered">
                  <strong>채팅을 준비하고 있습니다.</strong>
                  <p>잠시만 기다려 주세요.</p>
                </div>
              ) : timelineMessages.length > 0 ? (
                <div className="info-sidebar-chat-log__items">
                  {timelineMessages.map((message) => renderTimelineMessage(message))}
                  <div ref={chatLogEndRef} />
                </div>
              ) : (
                <div className="info-sidebar-chat-empty info-sidebar-chat-empty--centered">
                  <strong>{getEmptyStateTitle(props.activeWorkspacePage, props.inspection)}</strong>
                  <p>
                    {getEmptyStateDescription(
                      props.activeWorkspacePage,
                      props.inspection,
                      props.selectedSpec,
                    )}
                  </p>
                </div>
              )}
            </div>

            <div
              className={`info-sidebar-chat-composer ${
                canWriteMessage ? '' : 'info-sidebar-chat-composer--locked'
              }`}
            >
              <textarea
                className="info-sidebar-chat-composer__textarea"
                onChange={(event) => {
                  props.onChangeDraftMessage(event.target.value);
                }}
                placeholder={canWriteMessage ? '메시지를 입력하세요.' : '명세를 선택하면 채팅할 수 있습니다.'}
                readOnly={!canWriteMessage}
                rows={canWriteMessage ? 3 : 1}
                value={props.draftMessage}
              />

              {composerStatusMessage ? (
                <span className="info-sidebar-chat-composer__status">{composerStatusMessage}</span>
              ) : null}

              <div className="info-sidebar-chat-composer__footer">
                <div aria-label="현재 채팅 설정" className="info-sidebar-chat-composer__runtime">
                  <select
                    aria-label="현재 모델"
                    className="info-sidebar-chat-composer__runtime-select"
                    disabled={props.isSavingChatRuntimeSettings}
                    onChange={(event) => {
                      props.onChangeChatModel(event.target.value);
                    }}
                    value={props.chatModel}
                  >
                    {getChatModelOptions(props.chatModel).map((model) => (
                      <option key={model} value={model}>
                        {describeChatModel(model)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="현재 추론 강도"
                    className="info-sidebar-chat-composer__runtime-select"
                    disabled={props.isSavingChatRuntimeSettings}
                    onChange={(event) => {
                      props.onChangeChatReasoningEffort(
                        event.target.value as AgentCliModelReasoningEffort,
                      );
                    }}
                    value={props.chatReasoningEffort}
                  >
                    {AGENT_CLI_MODEL_REASONING_EFFORTS.map((modelReasoningEffort) => (
                      <option key={modelReasoningEffort} value={modelReasoningEffort}>
                        {describeChatReasoningEffort(modelReasoningEffort)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  aria-label={props.isSendingMessage ? '메시지 전송 중' : '메시지 전송'}
                  className="primary-button info-sidebar-chat-composer__submit"
                  disabled={!canSendMessage}
                  onClick={props.onSendMessage}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="info-sidebar-chat-composer__submit-icon"
                    fill="none"
                    viewBox="0 0 20 20"
                  >
                    <path
                      d="M10 15V5M5 10l5-5 5 5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.9"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </>
        </div>
      </section>
    </aside>
  );
}

function renderTimelineMessage(message: TimelineMessage) {
  if (message.role === 'system') {
    return (
      <article className="info-sidebar-chat-message info-sidebar-chat-message--system" key={message.id}>
        <span className="info-sidebar-chat-message__system-chip">{message.text}</span>
      </article>
    );
  }

  if (message.role === 'user') {
    return (
      <article
        className={`info-sidebar-chat-message info-sidebar-chat-message--user ${
          message.pending ? 'info-sidebar-chat-message--pending' : ''
        }`}
        key={message.id}
      >
        <div className="info-sidebar-chat-message__bubble">
          <p>{message.text}</p>
        </div>
        <span className="info-sidebar-chat-message__meta">
          {message.pending ? '전송 중...' : formatMessageTimestamp(message.createdAt)}
        </span>
      </article>
    );
  }

  return (
    <article className="info-sidebar-chat-message info-sidebar-chat-message--assistant" key={message.id}>
      <div className="info-sidebar-chat-message__header">
        <strong>{getMessageRoleLabel(message.role)}</strong>
        <span>{formatMessageTimestamp(message.createdAt)}</span>
      </div>
      <div className="info-sidebar-chat-message__body">
        <p>{message.text}</p>
      </div>
    </article>
  );
}

function getMessageRoleLabel(role: ProjectSessionMessageRole): string {
  switch (role) {
    case 'user':
      return '나';
    case 'assistant':
      return '코덱스';
    case 'system':
      return '시스템';
  }
}

function getEmptyStateTitle(
  activeWorkspacePage: WorkspacePageId,
  inspection: ProjectInspection | null,
): string {
  if (!inspection) {
    return '프로젝트를 먼저 선택해 주세요.';
  }

  if (inspection.initializationState !== 'ready') {
    return inspection.isWritable ? '채팅을 준비하고 있습니다.' : '쓰기 권한이 필요합니다.';
  }

  if (activeWorkspacePage !== 'specs') {
    return '명세 페이지에서 채팅할 수 있습니다.';
  }

  return '질문을 입력해 주세요.';
}

function getEmptyStateDescription(
  activeWorkspacePage: WorkspacePageId,
  inspection: ProjectInspection | null,
  selectedSpec: ProjectSpecDocument | null,
): string {
  if (!inspection) {
    return '왼쪽 프로젝트 목록에서 작업할 프로젝트를 선택하면 채팅이 열립니다.';
  }

  if (inspection.initializationState !== 'ready') {
    return inspection.isWritable
      ? '잠시만 기다려 주세요.'
      : '저장할 수 있어야 채팅을 사용할 수 있습니다.';
  }

  if (activeWorkspacePage !== 'specs') {
    return '중앙의 명세 페이지로 이동한 뒤 원하는 명세를 선택하면 채팅을 이어갈 수 있습니다.';
  }

  if (!selectedSpec) {
    return '명세 페이지에서 채팅할 명세를 먼저 선택해 주세요.';
  }

  return '오른쪽 아래 입력창에 질문을 남겨 주세요.';
}

function getTimelineMessages(input: {
  draftMessage: string;
  isSendingMessage: boolean;
  sessionMessages: ProjectSessionMessage[];
}): TimelineMessage[] {
  const baseMessages = input.sessionMessages.map((message) => ({
    createdAt: message.createdAt,
    id: message.id,
    role: message.role,
    text: message.text,
  }));

  const trimmedDraftMessage = input.draftMessage.trim();
  if (!input.isSendingMessage || trimmedDraftMessage.length === 0) {
    return baseMessages;
  }

  return [
    ...baseMessages,
    {
      createdAt: new Date().toISOString(),
      id: 'pending-user-message',
      pending: true,
      role: 'user',
      text: trimmedDraftMessage,
    },
  ];
}

function formatMessageTimestamp(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  return new Intl.DateTimeFormat('ko-KR', {
    day: 'numeric',
    month: 'numeric',
  }).format(date);
}

function getChatModelOptions(currentModel: string): string[] {
  return [...new Set([currentModel, ...AGENT_CLI_MODEL_OPTIONS])];
}

function describeChatModel(model: string): string {
  const knownLabels: Record<string, string> = {
    'gpt-5.4': 'GPT-5.4',
    'gpt-5.4-mini': 'GPT-5.4 Mini',
    'gpt-5.3-codex': 'GPT-5.3 Codex',
    'gpt-5.3-codex-spark': 'GPT-5.3 Codex Spark',
    'gpt-5.2': 'GPT-5.2',
    'gpt-5.2-codex': 'GPT-5.2 Codex',
  };

  return knownLabels[model] ?? model;
}

function describeChatReasoningEffort(
  modelReasoningEffort: AgentCliModelReasoningEffort,
): string {
  switch (modelReasoningEffort) {
    case 'low':
      return '낮음';
    case 'medium':
      return '보통';
    case 'high':
      return '높음';
    case 'xhigh':
      return '매우 높음';
  }
}
