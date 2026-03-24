import { useEffect, useRef, useState } from 'react';

import type { ProjectInspection } from '@/domain/project/project-model';

import type { AppView } from '@/renderer/app-view';
import { AppViewSwitcher } from '@/renderer/components/AppViewSwitcher';
import type {
  ProjectAnalysisRunStatus,
  StatusBadgeModel,
  WorkspacePageId,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

interface BottomStatusBarProps {
  activeAppView: AppView;
  activeWorkspacePage: WorkspacePageId;
  analysisRunStatus: ProjectAnalysisRunStatus | null;
  analysisStatus: StatusBadgeModel;
  errorMessage: string | null;
  inspection: ProjectInspection | null;
  message: string;
  onCancelAnalysis: () => void;
  onSelectAppView: (view: AppView) => void;
  storageStatus: StatusBadgeModel;
}

interface StatusMetaItem {
  label: string;
  value: string;
}

export function BottomStatusBar(props: BottomStatusBarProps) {
  const [now, setNow] = useState(() => Date.now());
  const [isExpanded, setIsExpanded] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (
      (props.analysisRunStatus?.status !== 'running' &&
        props.analysisRunStatus?.status !== 'cancelling') ||
      !props.analysisRunStatus.startedAt
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [props.analysisRunStatus?.startedAt, props.analysisRunStatus?.status]);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (hostRef.current?.contains(event.target)) {
        return;
      }

      setIsExpanded(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isExpanded]);

  const badge = resolveStatusBadge(props);
  const statusVariant = resolveStatusVariant({
    analysisRunStatus: props.analysisRunStatus,
    badge,
    errorMessage: props.errorMessage,
  });
  const progressPercent = props.analysisRunStatus ? getProgressPercent(props.analysisRunStatus) : null;
  const detailItems = buildDetailItems({
    activeWorkspacePage: props.activeWorkspacePage,
    analysisRunStatus: props.analysisRunStatus,
    inspection: props.inspection,
    now,
    storageStatus: props.storageStatus,
  });
  const canToggleDetails = props.inspection !== null || props.analysisRunStatus !== null;
  const canCancelAnalysis =
    props.analysisRunStatus !== null &&
    (props.analysisRunStatus.status === 'running' ||
      props.analysisRunStatus.status === 'cancelling') &&
    props.analysisRunStatus.stepIndex < props.analysisRunStatus.stepTotal;

  return (
    <div className="bottom-status-host" ref={hostRef}>
      <footer className={`bottom-status-strip bottom-status-strip--${statusVariant}`}>
        <div className="bottom-status-strip__main">
          <strong className="bottom-status-strip__project">
            {props.inspection?.projectName ?? '프로젝트 선택 필요'}
          </strong>
          <span aria-hidden="true" className="bottom-status-strip__separator" />
          <span className="bottom-status-strip__page">{getWorkspacePageLabel(props.activeWorkspacePage)}</span>
          <span className={`bottom-status-strip__state bottom-status-strip__state--${badge.tone}`}>
            {badge.label}
          </span>
          <p className="bottom-status-strip__message">{getStripMessage(props)}</p>
        </div>

        <div className="bottom-status-strip__actions">
          <div className="bottom-status-strip__anchor">
            {isExpanded ? (
              <section
                aria-label="작업 상태 상세"
                className={`bottom-status-panel bottom-status-panel--${statusVariant}`}
                role="dialog"
              >
                <div className="bottom-status-panel__header">
                  <div className="bottom-status-panel__title">
                    <span className="bottom-status-panel__eyebrow">작업 상태</span>
                    <strong>{props.inspection?.projectName ?? '프로젝트 선택 필요'}</strong>
                  </div>
                  <div className="bottom-status-panel__header-actions">
                    <span
                      className={`bottom-status-panel__state bottom-status-panel__state--${badge.tone}`}
                    >
                      {badge.label}
                    </span>
                    {canCancelAnalysis ? (
                      <button
                        className="bottom-status-panel__cancel"
                        disabled={props.analysisRunStatus?.status === 'cancelling'}
                        onClick={props.onCancelAnalysis}
                        type="button"
                      >
                        {props.analysisRunStatus?.status === 'cancelling'
                          ? '취소 요청 중...'
                          : '분석 취소'}
                      </button>
                    ) : null}
                    <button
                      aria-label="작업 상태 상세 닫기"
                      className="bottom-status-panel__close"
                      onClick={() => {
                        setIsExpanded(false);
                      }}
                      type="button"
                    >
                      닫기
                    </button>
                  </div>
                </div>

                <p className="bottom-status-panel__headline">{getPanelHeadline(props)}</p>
                <p className="bottom-status-panel__detail">{getPanelDetail(props)}</p>

                {progressPercent !== null ? (
                  <div className="bottom-status-panel__progress">
                    <div className="bottom-status-panel__progress-track">
                      <div
                        className={`bottom-status-panel__progress-fill ${
                          props.analysisRunStatus?.status === 'running' ||
                          props.analysisRunStatus?.status === 'cancelling'
                            ? 'bottom-status-panel__progress-fill--running'
                            : ''
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <dl
                  className={`bottom-status-panel__meta ${
                    progressPercent === null ? 'bottom-status-panel__meta--idle' : ''
                  }`}
                >
                  {detailItems.map((item) => (
                    <div className="bottom-status-panel__meta-item" key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>

                {props.analysisRunStatus?.status === 'failed' && props.analysisRunStatus.lastError ? (
                  <p className="bottom-status-panel__error">{props.analysisRunStatus.lastError}</p>
                ) : null}
              </section>
            ) : null}

            <button
              aria-expanded={isExpanded}
              aria-haspopup="dialog"
              className="bottom-status-strip__toggle"
              disabled={!canToggleDetails}
              onClick={() => {
                setIsExpanded((current) => !current);
              }}
              type="button"
            >
              {buildStripMetrics({
                analysisRunStatus: props.analysisRunStatus,
                inspection: props.inspection,
                now,
                storageStatus: props.storageStatus,
              }).map((metric) => (
                <span className="bottom-status-strip__metric" key={metric.label}>
                  <span className="bottom-status-strip__metric-label">{metric.label}</span>
                  <strong>{metric.value}</strong>
                </span>
              ))}
              <span
                aria-hidden="true"
                className={`bottom-status-strip__chevron ${
                  isExpanded ? 'bottom-status-strip__chevron--expanded' : ''
                }`}
              >
                ▾
              </span>
            </button>
          </div>

          <AppViewSwitcher
            activeView={props.activeAppView}
            className="app-switcher app-switcher--embedded bottom-status-strip__view-switcher"
            onSelectView={props.onSelectAppView}
          />
        </div>
      </footer>
    </div>
  );
}

function resolveStatusBadge(input: BottomStatusBarProps): StatusBadgeModel {
  if (
    input.analysisRunStatus?.status === 'running' ||
    input.analysisRunStatus?.status === 'cancelling'
  ) {
    return input.analysisStatus;
  }

  if (input.errorMessage) {
    return {
      label: '오류',
      tone: 'warning',
    };
  }

  return input.analysisStatus;
}

function resolveStatusVariant(input: {
  analysisRunStatus: ProjectAnalysisRunStatus | null;
  badge: StatusBadgeModel;
  errorMessage: string | null;
}): 'idle' | 'running' | 'cancelling' | 'cancelled' | 'succeeded' | 'failed' {
  if (input.analysisRunStatus) {
    return input.analysisRunStatus.status;
  }

  if (input.errorMessage || input.badge.tone === 'warning') {
    return 'failed';
  }

  if (input.badge.tone === 'positive') {
    return 'succeeded';
  }

  return 'idle';
}

function getStripMessage(input: BottomStatusBarProps): string {
  if (
    input.analysisRunStatus?.status === 'running' ||
    input.analysisRunStatus?.status === 'cancelling'
  ) {
    return input.analysisRunStatus.progressMessage ?? input.analysisRunStatus.stageMessage;
  }

  if (input.errorMessage) {
    return input.errorMessage;
  }

  if (input.analysisRunStatus) {
    return input.analysisRunStatus.stageMessage;
  }

  if (input.inspection?.projectMeta?.lastAnalyzedAt) {
    return `최근 분석 ${formatCompactTimestamp(input.inspection.projectMeta.lastAnalyzedAt)}`;
  }

  return input.message.trim() || '작업 상태가 여기에 표시됩니다.';
}

function getPanelHeadline(input: BottomStatusBarProps): string {
  if (
    input.analysisRunStatus?.status === 'running' ||
    input.analysisRunStatus?.status === 'cancelling'
  ) {
    return input.analysisRunStatus.stageMessage;
  }

  if (input.errorMessage) {
    return input.errorMessage;
  }

  if (input.analysisRunStatus) {
    return input.analysisRunStatus.stageMessage;
  }

  if (!input.inspection) {
    return '프로젝트를 선택하면 작업 진행 상태가 이곳에 표시됩니다.';
  }

  if (input.inspection.initializationState !== 'ready') {
    return input.inspection.isWritable
      ? '저장 공간을 준비하고 있습니다.'
      : '쓰기 권한을 확인해야 합니다.';
  }

  if (input.inspection.projectMeta?.lastAnalyzedAt) {
    return '최근 분석 결과가 준비되어 있습니다.';
  }

  return '에이전트 분석을 실행하면 진행 단계가 표시됩니다.';
}

function getPanelDetail(input: BottomStatusBarProps): string {
  if (input.analysisRunStatus?.progressMessage) {
    return input.analysisRunStatus.progressMessage;
  }

  if (input.errorMessage) {
    return input.errorMessage;
  }

  if (input.analysisRunStatus?.status === 'cancelled') {
    return '요청에 따라 분석 실행을 중단했고, 저장 결과는 반영하지 않았습니다.';
  }

  if (!input.inspection) {
    return '왼쪽 프로젝트 패널에서 로컬 프로젝트를 선택해 시작하세요.';
  }

  if (input.inspection.initializationState !== 'ready') {
    return input.inspection.isWritable
      ? '프로젝트 내부 .sdd 작업 공간을 준비하면 분석과 명세 작업을 이어갈 수 있습니다.'
      : '분석 결과와 채팅을 저장하려면 현재 프로젝트 경로에 쓰기 권한이 필요합니다.';
  }

  if (input.analysisRunStatus?.status === 'succeeded') {
    return '구조화된 분석 결과가 프로젝트 내부 .sdd/analysis에 저장되었습니다.';
  }

  if (input.inspection.projectMeta?.lastAnalyzedAt) {
    return `최근 분석 기록 ${formatVerboseTimestamp(input.inspection.projectMeta.lastAnalyzedAt)}`;
  }

  return '에이전트 분석을 실행하면 진행률과 최근 상태를 이곳에서 바로 확인할 수 있습니다.';
}

function buildStripMetrics(input: {
  analysisRunStatus: ProjectAnalysisRunStatus | null;
  inspection: ProjectInspection | null;
  now: number;
  storageStatus: StatusBadgeModel;
}): StatusMetaItem[] {
  if (input.analysisRunStatus) {
    return [
      {
        label: '단계',
        value: `${input.analysisRunStatus.stepIndex}/${input.analysisRunStatus.stepTotal}`,
      },
      {
        label: '진행',
        value: `${getProgressPercent(input.analysisRunStatus)}%`,
      },
      {
        label:
          input.analysisRunStatus.status === 'running' ||
          input.analysisRunStatus.status === 'cancelling'
            ? '경과'
            : '소요',
        value: formatElapsedDuration(input.analysisRunStatus, input.now),
      },
    ];
  }

  return [
    {
      label: '저장',
      value: input.storageStatus.label,
    },
    {
      label: '최근 분석',
      value: formatCompactTimestamp(input.inspection?.projectMeta?.lastAnalyzedAt ?? null),
    },
  ];
}

function buildDetailItems(input: {
  activeWorkspacePage: WorkspacePageId;
  analysisRunStatus: ProjectAnalysisRunStatus | null;
  inspection: ProjectInspection | null;
  now: number;
  storageStatus: StatusBadgeModel;
}): StatusMetaItem[] {
  if (input.analysisRunStatus) {
    const progressPercent = getProgressPercent(input.analysisRunStatus);
    const completedLabel =
      input.analysisRunStatus.status === 'running' ||
      input.analysisRunStatus.status === 'cancelling'
        ? '시작 시각'
        : input.analysisRunStatus.status === 'failed'
          ? '실패 시각'
          : input.analysisRunStatus.status === 'cancelled'
            ? '취소 시각'
          : '완료 시각';
    const completedValue =
      input.analysisRunStatus.status === 'running' ||
      input.analysisRunStatus.status === 'cancelling'
        ? formatCompactTimestamp(input.analysisRunStatus.startedAt)
        : formatCompactTimestamp(
            input.analysisRunStatus.completedAt ??
              input.analysisRunStatus.updatedAt ??
              input.analysisRunStatus.startedAt,
          );

    return [
      {
        label: '진행 단계',
        value: `${input.analysisRunStatus.stepIndex}/${input.analysisRunStatus.stepTotal}`,
      },
      {
        label: '진행률',
        value: `${progressPercent}%`,
      },
      {
        label:
          input.analysisRunStatus.status === 'running' ||
          input.analysisRunStatus.status === 'cancelling'
            ? '경과 시간'
            : '총 소요',
        value: formatElapsedDuration(input.analysisRunStatus, input.now),
      },
      {
        label: completedLabel,
        value: completedValue,
      },
    ];
  }

  return [
    {
      label: '저장 상태',
      value: input.storageStatus.label,
    },
    {
      label: '현재 페이지',
      value: getWorkspacePageLabel(input.activeWorkspacePage),
    },
    {
      label: '최근 분석',
      value: formatCompactTimestamp(input.inspection?.projectMeta?.lastAnalyzedAt ?? null),
    },
  ];
}

function getWorkspacePageLabel(value: WorkspacePageId): string {
  switch (value) {
    case 'analysis':
      return '분석';
    case 'specs':
      return '명세';
  }
}

function getProgressPercent(status: ProjectAnalysisRunStatus): number {
  if (status.stepTotal <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((status.stepIndex / status.stepTotal) * 100)));
}

function formatElapsedDuration(status: ProjectAnalysisRunStatus, now: number): string {
  if (!status.startedAt) {
    return '기록 없음';
  }

  const startedAtMs = new Date(status.startedAt).getTime();
  if (Number.isNaN(startedAtMs)) {
    return '기록 없음';
  }

  const endedAtCandidate = status.completedAt ?? status.updatedAt;
  const endedAtMs =
    status.status === 'running' || status.status === 'cancelling' || !endedAtCandidate
      ? now
      : new Date(endedAtCandidate).getTime();

  if (Number.isNaN(endedAtMs)) {
    return '기록 없음';
  }

  const elapsedMs = Math.max(0, endedAtMs - startedAtMs);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }

  if (minutes > 0) {
    return `${minutes}분 ${seconds}초`;
  }

  return `${seconds}초`;
}

function formatCompactTimestamp(value: string | null): string {
  if (!value) {
    return '기록 없음';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '기록 없음';
  }

  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  return new Intl.DateTimeFormat('ko-KR', {
    ...(isSameDay
      ? { hour: 'numeric', minute: '2-digit' }
      : { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
  }).format(date);
}

function formatVerboseTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '기록 없음';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
