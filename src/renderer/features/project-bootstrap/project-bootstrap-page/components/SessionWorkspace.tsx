import type { ProjectInspection } from '@/domain/project/project-model';
import type {
  ProjectSessionMessage,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';

interface SessionWorkspaceProps {
  inspection: ProjectInspection | null;
  draftMessage: string;
  isCreatingSession: boolean;
  isSendingMessage: boolean;
  selectedSession: ProjectSessionSummary | null;
  sessionMessages: ProjectSessionMessage[];
  sessionCount: number;
  onChangeDraftMessage: (value: string) => void;
  onCreateSession: () => void;
  onSendMessage: () => void;
}

export function SessionWorkspace(props: SessionWorkspaceProps) {
  const canUseSessions = props.inspection?.initializationState === 'ready';

  return (
    <section className="panel-card">
      <header className="card-header">
        <h3>대화 세션</h3>
        <button
          className="secondary-button"
          onClick={props.onCreateSession}
          disabled={!canUseSessions || props.isCreatingSession}
          type="button"
        >
          {props.isCreatingSession ? '만드는 중...' : '새 대화'}
        </button>
      </header>

      {!props.inspection ? (
        <p className="helper-text">프로젝트를 선택하면 이 영역에서 세션을 만들고 대화를 이어갈 수 있습니다.</p>
      ) : null}

      {props.inspection && props.inspection.initializationState !== 'ready' ? (
        <p className="helper-text">작업 공간 준비를 먼저 완료해야 대화 세션을 저장할 수 있습니다.</p>
      ) : null}

      {canUseSessions && props.sessionCount === 0 ? (
        <div className="session-empty-state">
          <p className="helper-text">
            아직 대화 세션이 없습니다. 프로젝트별로 주제나 작업 단위를 나눠 여러 대화를 관리할 수
            있습니다.
          </p>
        </div>
      ) : null}

      {canUseSessions && props.selectedSession ? (
        <div className="session-workspace">
          <div className="session-workspace-header">
            <div>
              <strong>{props.selectedSession.title}</strong>
              <p>
                메시지 {props.selectedSession.messageCount}개
                {props.selectedSession.lastMessageAt
                  ? ` · ${new Date(props.selectedSession.lastMessageAt).toLocaleString('ko-KR')}`
                  : ''}
              </p>
            </div>
          </div>

          <div className="session-message-list">
            {props.sessionMessages.length > 0 ? (
              props.sessionMessages.map((message) => (
                <article
                  className={`session-message session-message--${message.role}`}
                  key={message.id}
                >
                  <p className="session-message-role">
                    {message.role === 'user'
                      ? '나'
                      : message.role === 'assistant'
                        ? '어시스턴트'
                        : '시스템'}
                  </p>
                  <p className="session-message-text">{message.text}</p>
                </article>
              ))
            ) : (
              <p className="helper-text">
                아직 메시지가 없습니다. 질문이나 메모를 남겨두면 나중에 Codex 연결 단계에서도 같은
                세션을 이어서 사용할 수 있습니다.
              </p>
            )}
          </div>

          <div className="session-composer">
            <textarea
              className="session-textarea"
              onChange={(event) => {
                props.onChangeDraftMessage(event.target.value);
              }}
              placeholder="이 세션에 남길 질문이나 메모를 입력하세요."
              rows={4}
              value={props.draftMessage}
            />
            <div className="session-composer-actions">
              <button
                className="primary-button"
                onClick={props.onSendMessage}
                disabled={props.isSendingMessage || props.draftMessage.trim().length === 0}
                type="button"
              >
                {props.isSendingMessage ? '저장 중...' : '메시지 저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
