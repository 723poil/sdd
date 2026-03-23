import type { ProjectAnalysis } from '@/domain/project/project-analysis-model';
import type { ProjectInspection } from '@/domain/project/project-model';
import type { ProjectSessionSummary } from '@/domain/project/project-session-model';

interface InfoSidebarProps {
  analysis: ProjectAnalysis | null;
  inspection: ProjectInspection | null;
  sessions: ProjectSessionSummary[];
  onToggleSidebar: () => void;
}

export function InfoSidebar(props: InfoSidebarProps) {
  const lastAnalyzedAt = props.inspection?.projectMeta?.lastAnalyzedAt;
  const hasReadySummary = props.inspection?.initializationState === 'ready' && props.analysis && lastAnalyzedAt;
  const summaryAnalysis = hasReadySummary ? props.analysis : null;

  return (
    <aside className="sidebar sidebar--sessions">
      <section className="sidebar-section">
        <div className="sidebar-header">
          <p className="section-label">요약</p>
          <button
            aria-label="오른쪽 요약 패널 닫기"
            className="sidebar-icon-button"
            onClick={props.onToggleSidebar}
            type="button"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
        {hasReadySummary ? (
          <div className="info-list">
            <div className="info-item">
              <strong>감지한 스택</strong>
              <p>
                {props.inspection?.projectMeta?.detectedStack.length
                  ? props.inspection.projectMeta.detectedStack.join(', ')
                  : '아직 정리되지 않았습니다.'}
              </p>
            </div>
            <div className="info-item">
              <strong>세션</strong>
              <p>{props.sessions.length}개</p>
            </div>
            <div className="info-item">
              <strong>최근 분석</strong>
              <p>{new Date(lastAnalyzedAt).toLocaleString('ko-KR')}</p>
            </div>
          </div>
        ) : (
          <div className="info-list">
            <div className="info-item">
              <strong>지금 할 일</strong>
              <p>
                {!props.inspection
                  ? '먼저 작업할 프로젝트를 선택해 주세요.'
                  : props.inspection.initializationState !== 'ready'
                    ? '작업 공간 준비를 완료해 주세요.'
                    : '기본 분석을 실행해 주세요.'}
              </p>
            </div>
          </div>
        )}
      </section>

      {summaryAnalysis && summaryAnalysis.context.entrypoints.length > 0 ? (
        <section className="sidebar-section sidebar-section--stretch">
          <p className="section-label">진입점</p>
          <div className="info-list">
            {summaryAnalysis.context.entrypoints.slice(0, 3).map((entrypoint) => (
              <div
                className="info-item"
                key={entrypoint}
              >
                <p>{entrypoint}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
