import type { ProjectInspection } from '@/domain/project/project-model';
import type {
  ProjectSessionMessage,
  ProjectSessionSummary,
} from '@/domain/project/project-session-model';

import { SessionWorkspace } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/SessionWorkspace';
import { StatusBadge } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/StatusBadge';
import type {
  StatusBadgeModel,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

interface MainWorkspaceProps {
  analysisStatus: StatusBadgeModel;
  inspection: ProjectInspection | null;
  storageStatus: StatusBadgeModel;
  message: string;
  errorMessage: string | null;
  canAnalyze: boolean;
  draftMessage: string;
  isSelecting: boolean;
  isAnalyzing: boolean;
  isCreatingSession: boolean;
  isSendingMessage: boolean;
  selectedSession: ProjectSessionSummary | null;
  sessionMessages: ProjectSessionMessage[];
  sessionCount: number;
  onAnalyzeProject: () => void;
  onChangeDraftMessage: (value: string) => void;
  onCreateSession: () => void;
  onSendMessage: () => void;
  onSelectProject: () => void;
}

export function MainWorkspace(props: MainWorkspaceProps) {
  return (
    <section className="main-panel">
      <header className="topbar">
        <div className="topbar-leading">
          <div>
            <p className="topbar-label">현재 작업</p>
            <h2>{props.inspection?.projectName ?? '프로젝트를 선택해 주세요'}</h2>
          </div>
        </div>

        <div className="topbar-actions">
          <StatusBadge
            label={props.storageStatus.label}
            tone={props.storageStatus.tone}
          />
          <StatusBadge
            label={props.analysisStatus.label}
            tone={props.analysisStatus.tone}
          />
        </div>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <p className="section-label">워크스페이스</p>
          <h3>{props.inspection?.projectName ?? '로컬 프로젝트 연결'}</h3>
          <p className="hero-description">{props.message}</p>
        </div>

        <div className="hero-actions">
          <button
            className="primary-button"
            onClick={props.onSelectProject}
            disabled={props.isSelecting}
          >
            {props.isSelecting ? '프로젝트 불러오는 중...' : '프로젝트 선택'}
          </button>
          <button
            className="secondary-button"
            onClick={props.onAnalyzeProject}
            disabled={!props.canAnalyze || props.isAnalyzing}
          >
            {props.isAnalyzing ? '기본 분석 실행 중...' : '기본 분석 실행'}
          </button>
        </div>
      </section>

      {props.errorMessage ? (
        <section className="panel-card panel-card--alert">
          <header className="card-header">
            <h3>알림</h3>
          </header>
          <p className="helper-text helper-text--alert">{props.errorMessage}</p>
        </section>
      ) : null}
      <SessionWorkspace
        draftMessage={props.draftMessage}
        inspection={props.inspection}
        isCreatingSession={props.isCreatingSession}
        isSendingMessage={props.isSendingMessage}
        selectedSession={props.selectedSession}
        sessionCount={props.sessionCount}
        sessionMessages={props.sessionMessages}
        onChangeDraftMessage={props.onChangeDraftMessage}
        onCreateSession={props.onCreateSession}
        onSendMessage={props.onSendMessage}
      />
    </section>
  );
}
