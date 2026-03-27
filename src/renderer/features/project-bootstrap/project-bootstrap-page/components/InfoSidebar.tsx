import { useEffect, useRef, type ChangeEvent, type ClipboardEvent, type DragEvent } from 'react';

import {
  AGENT_CLI_MODEL_REASONING_EFFORTS,
  type AgentCliModelReasoningEffort,
} from '@/domain/app-settings/agent-cli-connection-model';
import type { ProjectInspection } from '@/domain/project/project-model';
import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
import {
  PROJECT_SESSION_MESSAGE_ATTACHMENT_PICKER_ACCEPT,
  type ProjectSessionMessage,
  type ProjectSessionMessageAttachmentManifest,
  type ProjectSessionMessageAttachmentSource,
  type ProjectSessionMessagePendingAttachment,
  type ProjectSessionMessageRunStatus,
  type ProjectSessionMessageRole,
  type ProjectSessionSummary,
} from '@/domain/project/project-session-model';
import type { ProjectSessionDraftAttachment } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-session-attachment-draft';
import type { WorkspacePageId } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';
import {
  ProjectSessionAttachmentList,
  type ProjectSessionAttachmentListItem,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/ProjectSessionAttachmentList';
import {
  describeAgentCliModel,
  describeAgentCliReasoningEffort,
  getAgentCliModelOptions,
} from '@/renderer/features/agent-cli-settings';

interface InfoSidebarProps {
  activeWorkspacePage: WorkspacePageId;
  canAnalyzeProject: boolean;
  canAnalyzeReferences: boolean;
  canCancelAnalysis: boolean;
  canCreateSpec: boolean;
  inspection: ProjectInspection | null;
  isAnalyzing: boolean;
  isCancellingAnalysis: boolean;
  isCreatingSpec: boolean;
  selectedSpec: ProjectSpecDocument | null;
  selectedSession: ProjectSessionSummary | null;
  sessionMessages: ProjectSessionMessage[];
  draftMessage: string;
  draftAttachments: ProjectSessionDraftAttachment[];
  draftAttachmentErrors: string[];
  isComposerDragActive: boolean;
  chatModel: string;
  chatReasoningEffort: AgentCliModelReasoningEffort;
  isCreatingSession: boolean;
  canCancelMessage: boolean;
  isCancellingMessage: boolean;
  isSendingMessage: boolean;
  isSavingChatRuntimeSettings: boolean;
  sessionMessageRunStatus: ProjectSessionMessageRunStatus | null;
  onAddDraftAttachments: (files: File[], source: ProjectSessionMessageAttachmentSource) => void;
  onChangeChatModel: (value: string) => void;
  onChangeChatReasoningEffort: (value: AgentCliModelReasoningEffort) => void;
  onChangeDraftMessage: (value: string) => void;
  onAnalyzeProject: () => void;
  onAnalyzeReferences: () => void;
  onCancelAnalysis: () => void;
  onCancelMessage: () => void;
  onCreateSpec: () => void;
  onRemoveDraftAttachment: (draftId: string) => void;
  onSendMessage: () => void;
  onSetComposerDragActive: (isActive: boolean) => void;
  onToggleSidebar: () => void;
}

interface TimelineMessage {
  attachments: ProjectSessionAttachmentListItem[];
  createdAt: string;
  id: string;
  pending?: boolean;
  role: ProjectSessionMessageRole;
  summaryText: string | null;
  text: string;
}

export function InfoSidebar(props: InfoSidebarProps) {
  const hasProjectContext = props.inspection?.initializationState === 'ready';
  const canWriteMessage =
    props.activeWorkspacePage === 'specs' &&
    props.selectedSpec !== null &&
    props.selectedSession !== null &&
    !props.isCreatingSession;
  const isMessageRequestActive = props.isSendingMessage || props.isCancellingMessage;
  const isComposerDisabled = !canWriteMessage || isMessageRequestActive;
  const canSendMessage =
    canWriteMessage &&
    (props.draftMessage.trim().length > 0 || props.draftAttachments.length > 0) &&
    !isMessageRequestActive;
  const composerStatusMessage = props.sessionMessageRunStatus
    ? getComposerStatusMessage(props.sessionMessageRunStatus)
    : props.isSavingChatRuntimeSettings
      ? '채팅 설정을 저장 중입니다.'
      : null;
  const chatLogEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerDragDepthRef = useRef(0);
  const timelineMessages = getTimelineMessages({
    sessionMessages: props.sessionMessages,
    sessionMessageRunStatus: props.sessionMessageRunStatus,
  });
  const draftAttachmentItems = props.draftAttachments.map(toAttachmentListItemFromDraftAttachment);

  useEffect(() => {
    chatLogEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [timelineMessages.length]);

  useEffect(() => {
    if (!props.isComposerDragActive) {
      composerDragDepthRef.current = 0;
    }
  }, [props.isComposerDragActive]);

  const handleAttachmentInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length > 0) {
      props.onAddDraftAttachments(files, 'picker');
    }

    event.target.value = '';
  };

  const handleComposerPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = readDataTransferFiles(event.clipboardData);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    props.onAddDraftAttachments(files, 'paste');
  };

  const handleComposerDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFileTransferData(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    composerDragDepthRef.current += 1;
    props.onSetComposerDragActive(true);
  };

  const handleComposerDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFileTransferData(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';

    if (!props.isComposerDragActive) {
      props.onSetComposerDragActive(true);
    }
  };

  const handleComposerDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFileTransferData(event.dataTransfer)) {
      return;
    }

    composerDragDepthRef.current = Math.max(0, composerDragDepthRef.current - 1);
    if (composerDragDepthRef.current === 0) {
      props.onSetComposerDragActive(false);
    }
  };

  const handleComposerDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFileTransferData(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    composerDragDepthRef.current = 0;
    props.onSetComposerDragActive(false);

    const files = readDataTransferFiles(event.dataTransfer);
    if (files.length > 0) {
      props.onAddDraftAttachments(files, 'drop');
    }
  };

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
                    ? '질문이나 요구사항을 입력하면 명세 초안을 함께 갱신합니다.'
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
                isComposerDisabled ? 'info-sidebar-chat-composer--locked' : ''
              } ${props.isComposerDragActive ? 'info-sidebar-chat-composer--drag-active' : ''}`}
              onDragEnter={handleComposerDragEnter}
              onDragLeave={handleComposerDragLeave}
              onDragOver={handleComposerDragOver}
              onDrop={handleComposerDrop}
            >
              <textarea
                className="info-sidebar-chat-composer__textarea"
                onChange={(event) => {
                  props.onChangeDraftMessage(event.target.value);
                }}
                onPaste={handleComposerPaste}
                placeholder={
                  canWriteMessage
                    ? isMessageRequestActive
                      ? '응답을 기다리는 동안에는 입력할 수 없습니다.'
                      : '명세에 반영할 요구사항이나 질문을 입력하세요.'
                    : '명세를 선택하면 채팅할 수 있습니다.'
                }
                readOnly={isComposerDisabled}
                rows={canWriteMessage ? 3 : 1}
                value={props.draftMessage}
              />

              <input
                accept={PROJECT_SESSION_MESSAGE_ATTACHMENT_PICKER_ACCEPT}
                className="info-sidebar-chat-composer__file-input"
                hidden
                multiple
                onChange={handleAttachmentInputChange}
                ref={fileInputRef}
                type="file"
              />

              {draftAttachmentItems.length > 0 ? (
                <ProjectSessionAttachmentList
                  attachments={draftAttachmentItems}
                  onRemove={props.onRemoveDraftAttachment}
                  variant="composer"
                />
              ) : null}

              {props.draftAttachmentErrors.length > 0 ? (
                <div className="info-sidebar-chat-composer__errors" role="status">
                  {props.draftAttachmentErrors.map((error) => (
                    <p className="info-sidebar-chat-composer__error" key={error}>
                      {error}
                    </p>
                  ))}
                </div>
              ) : null}

              {composerStatusMessage ? (
                <span className="info-sidebar-chat-composer__status">{composerStatusMessage}</span>
              ) : null}

              <div className="info-sidebar-chat-composer__footer">
                <button
                  aria-label="파일 첨부"
                  className="sidebar-icon-button info-sidebar-chat-composer__action info-sidebar-chat-composer__attach"
                  disabled={isComposerDisabled}
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  title="파일 첨부"
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="info-sidebar-chat-composer__action-icon"
                    fill="none"
                    viewBox="0 0 20 20"
                  >
                    <path
                      d="M7.75 10.75 12 6.5a2.475 2.475 0 0 1 3.5 3.5l-5 5a4.242 4.242 0 1 1-6-6l5.25-5.25"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                </button>
                <div aria-label="현재 채팅 설정" className="info-sidebar-chat-composer__runtime">
                  <div className="info-sidebar-chat-composer__runtime-field">
                    <select
                      aria-label="현재 모델"
                      className="info-sidebar-chat-composer__runtime-select"
                      disabled={props.isSavingChatRuntimeSettings || isMessageRequestActive}
                      onChange={(event) => {
                        props.onChangeChatModel(event.target.value);
                      }}
                      value={props.chatModel}
                    >
                      {getChatModelOptions(props.chatModel).map((model) => (
                        <option key={model} value={model}>
                          {describeAgentCliModel(model)}
                        </option>
                      ))}
                    </select>
                    <svg
                      aria-hidden="true"
                      className="info-sidebar-chat-composer__runtime-caret"
                      fill="none"
                      viewBox="0 0 12 12"
                    >
                      <path
                        d="m3 4.5 3 3 3-3"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.4"
                      />
                    </svg>
                  </div>
                  <div className="info-sidebar-chat-composer__runtime-field info-sidebar-chat-composer__runtime-field--effort">
                    <select
                      aria-label="현재 추론 강도"
                      className="info-sidebar-chat-composer__runtime-select"
                      disabled={props.isSavingChatRuntimeSettings || isMessageRequestActive}
                      onChange={(event) => {
                        props.onChangeChatReasoningEffort(
                          event.target.value as AgentCliModelReasoningEffort,
                        );
                      }}
                      value={props.chatReasoningEffort}
                    >
                      {AGENT_CLI_MODEL_REASONING_EFFORTS.map((modelReasoningEffort) => (
                        <option key={modelReasoningEffort} value={modelReasoningEffort}>
                          {describeAgentCliReasoningEffort(modelReasoningEffort)}
                        </option>
                      ))}
                    </select>
                    <svg
                      aria-hidden="true"
                      className="info-sidebar-chat-composer__runtime-caret"
                      fill="none"
                      viewBox="0 0 12 12"
                    >
                      <path
                        d="m3 4.5 3 3 3-3"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.4"
                      />
                    </svg>
                  </div>
                </div>
                {props.canCancelMessage ? (
                  <button
                    aria-label={props.isCancellingMessage ? '요청 취소 중' : '요청 취소'}
                    className="primary-button info-sidebar-chat-composer__submit info-sidebar-chat-composer__submit--cancel"
                    disabled={props.isCancellingMessage}
                    onClick={props.onCancelMessage}
                    title={props.isCancellingMessage ? '요청 취소 중' : '요청 취소'}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="info-sidebar-chat-composer__submit-icon"
                      fill="none"
                      viewBox="0 0 20 20"
                    >
                      <path
                        d="M6.5 6.5h7v7h-7Z"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </button>
                ) : (
                  <button
                    aria-label="메시지 전송"
                    className="primary-button info-sidebar-chat-composer__submit"
                    disabled={!canSendMessage}
                    onClick={props.onSendMessage}
                    title="메시지 전송"
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
                )}
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
      <article
        className="info-sidebar-chat-message info-sidebar-chat-message--system"
        key={message.id}
      >
        <span className="info-sidebar-chat-message__system-chip">{message.text}</span>
      </article>
    );
  }

  const hasText = message.text.trim().length > 0;
  const fallbackSummary = !hasText ? message.summaryText : null;

  if (message.role === 'user') {
    return (
      <article
        className={`info-sidebar-chat-message info-sidebar-chat-message--user ${
          message.pending ? 'info-sidebar-chat-message--pending' : ''
        }`}
        key={message.id}
      >
        <div className="info-sidebar-chat-message__bubble">
          {hasText ? <p>{message.text}</p> : null}
          {message.attachments.length > 0 ? (
            <ProjectSessionAttachmentList attachments={message.attachments} variant="message" />
          ) : null}
          {!hasText && fallbackSummary ? <p>{fallbackSummary}</p> : null}
        </div>
        <span className="info-sidebar-chat-message__meta">
          {message.pending ? '전송 중...' : formatMessageTimestamp(message.createdAt)}
        </span>
      </article>
    );
  }

  return (
    <article
      className="info-sidebar-chat-message info-sidebar-chat-message--assistant"
      key={message.id}
    >
      <div className="info-sidebar-chat-message__header">
        <strong>{getMessageRoleLabel(message.role)}</strong>
        <span>{formatMessageTimestamp(message.createdAt)}</span>
      </div>
      <div className="info-sidebar-chat-message__body">
        {hasText ? <p>{message.text}</p> : null}
        {message.attachments.length > 0 ? (
          <ProjectSessionAttachmentList attachments={message.attachments} variant="message" />
        ) : null}
        {!hasText && fallbackSummary ? <p>{fallbackSummary}</p> : null}
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

  return '명세 초안을 같이 만들어 보세요.';
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

  return '오른쪽 아래 입력창에 요구사항, 변경점, 제약, 확인할 내용을 남겨 주세요.';
}

function getTimelineMessages(input: {
  sessionMessages: ProjectSessionMessage[];
  sessionMessageRunStatus: ProjectSessionMessageRunStatus | null;
}): TimelineMessage[] {
  const baseMessages = input.sessionMessages.map((message) => ({
    attachments: message.attachments.map(toAttachmentListItemFromMessageAttachment),
    createdAt: message.createdAt,
    id: message.id,
    role: message.role,
    summaryText: null,
    text: message.text,
  }));

  if (
    !input.sessionMessageRunStatus ||
    (input.sessionMessageRunStatus.status !== 'running' &&
      input.sessionMessageRunStatus.status !== 'cancelling')
  ) {
    return baseMessages;
  }

  const pendingRequestText = input.sessionMessageRunStatus.requestText?.trim() ?? '';
  const pendingSummary = input.sessionMessageRunStatus.requestSummary?.trim() ?? '';
  const pendingAttachments = input.sessionMessageRunStatus.requestAttachments.map(
    toAttachmentListItemFromPendingAttachment,
  );
  const lastMessage = baseMessages[baseMessages.length - 1];
  const matchesLastUserMessage =
    lastMessage?.role === 'user' &&
    lastMessage.text.trim() === pendingRequestText &&
    lastMessage.attachments.length === input.sessionMessageRunStatus.attachmentCount;

  if (matchesLastUserMessage) {
    return baseMessages.map((message, index) =>
      index === baseMessages.length - 1 ? { ...message, pending: true } : message,
    );
  }

  if (
    pendingRequestText.length === 0 &&
    pendingSummary.length === 0 &&
    pendingAttachments.length === 0
  ) {
    return baseMessages;
  }

  return [
    ...baseMessages,
    {
      attachments: pendingAttachments,
      createdAt: input.sessionMessageRunStatus.startedAt ?? new Date().toISOString(),
      id: 'pending-user-message',
      pending: true,
      role: 'user',
      summaryText: pendingSummary.length > 0 ? pendingSummary : null,
      text: pendingRequestText,
    },
  ];
}

function getComposerStatusMessage(
  sessionMessageRunStatus: ProjectSessionMessageRunStatus,
): string | null {
  switch (sessionMessageRunStatus.status) {
    case 'running':
    case 'cancelling':
      return sessionMessageRunStatus.progressMessage ?? sessionMessageRunStatus.stageMessage;
    case 'cancelled':
      return '요청을 취소했습니다.';
    case 'failed':
      return sessionMessageRunStatus.lastError ?? '응답을 만들지 못했습니다.';
    case 'idle':
    case 'succeeded':
      return null;
  }
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
  return getAgentCliModelOptions(currentModel);
}

function hasFileTransferData(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) {
    return false;
  }

  return Array.from(dataTransfer.types).includes('Files');
}

function readDataTransferFiles(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) {
    return [];
  }

  if (dataTransfer.files.length > 0) {
    return Array.from(dataTransfer.files);
  }

  return Array.from(dataTransfer.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

function toAttachmentListItemFromDraftAttachment(
  attachment: ProjectSessionDraftAttachment,
): ProjectSessionAttachmentListItem {
  return {
    id: attachment.draftId,
    kind: attachment.kind,
    mimeType: attachment.mimeType,
    name: attachment.name,
    previewUrl: attachment.previewUrl ?? null,
    sizeBytes: attachment.sizeBytes,
  };
}

function toAttachmentListItemFromMessageAttachment(
  attachment: ProjectSessionMessageAttachmentManifest,
): ProjectSessionAttachmentListItem {
  return {
    id: attachment.id,
    kind: attachment.kind,
    mimeType: attachment.mimeType,
    name: attachment.name,
    previewUrl: attachment.previewUrl ?? null,
    sizeBytes: attachment.sizeBytes,
  };
}

function toAttachmentListItemFromPendingAttachment(
  attachment: ProjectSessionMessagePendingAttachment,
): ProjectSessionAttachmentListItem {
  return {
    id: attachment.id,
    kind: attachment.kind,
    mimeType: attachment.mimeType,
    name: attachment.name,
    previewUrl: attachment.previewUrl ?? null,
    sizeBytes: attachment.sizeBytes,
  };
}
