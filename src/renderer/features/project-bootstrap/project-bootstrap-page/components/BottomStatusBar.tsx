import { useEffect, useRef, useState } from 'react';

import type { ProjectInspection } from '@/domain/project/project-model';

import type { AppView } from '@/renderer/app-view';
import { AppViewSwitcher } from '@/renderer/components/AppViewSwitcher';
import type {
  StatusBadgeModel,
  WorkbenchProgressTask,
  WorkspacePageId,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

interface BottomStatusBarProps {
  activeAppView: AppView;
  activeProgressTask: WorkbenchProgressTask | null;
  activeWorkspacePage: WorkspacePageId;
  errorMessage: string | null;
  inspection: ProjectInspection | null;
  message: string;
  onCancelTask: (task: WorkbenchProgressTask) => void;
  onSelectAppView: (view: AppView) => void;
  onSelectTask: (task: WorkbenchProgressTask) => void;
  progressTasks: WorkbenchProgressTask[];
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
  const activeTaskCount = props.progressTasks.filter(
    (task) => task.status === 'running' || task.status === 'cancelling',
  ).length;
  const badge = resolveStatusBadge(props.activeProgressTask, props.errorMessage, props.storageStatus);
  const statusVariant = resolveStatusVariant(props.activeProgressTask, props.errorMessage, props.storageStatus);
  const detailItems = buildDetailItems({
    activeTask: props.activeProgressTask,
    activeTaskCount,
    activeWorkspacePage: props.activeWorkspacePage,
    inspection: props.inspection,
    now,
    storageStatus: props.storageStatus,
  });
  const shouldShowTaskSummary =
    props.activeProgressTask !== null || props.progressTasks.length === 0;
  const canToggleDetails = props.inspection !== null || props.progressTasks.length > 0;
  const cancellableTask = getCancellableTask(props.activeProgressTask);

  useEffect(() => {
    if (
      !props.activeProgressTask ||
      (props.activeProgressTask.status !== 'running' &&
        props.activeProgressTask.status !== 'cancelling')
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [props.activeProgressTask]);

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

  return (
    <div className="bottom-status-host" ref={hostRef}>
      <footer className={`bottom-status-strip bottom-status-strip--${statusVariant}`}>
        <div className="bottom-status-strip__main">
          <strong className="bottom-status-strip__project">
            {props.activeProgressTask?.projectName ?? props.inspection?.projectName ?? '프로젝트 선택 필요'}
          </strong>
          <span aria-hidden="true" className="bottom-status-strip__separator" />
          <span className="bottom-status-strip__page">
            {props.activeProgressTask ? props.activeProgressTask.title : getWorkspacePageLabel(props.activeWorkspacePage)}
          </span>
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
                    <strong>
                      {props.activeProgressTask?.projectName ??
                        props.inspection?.projectName ??
                        '프로젝트 선택 필요'}
                    </strong>
                  </div>
                  <div className="bottom-status-panel__header-actions">
                    <span
                      className={`bottom-status-panel__state bottom-status-panel__state--${badge.tone}`}
                    >
                      {badge.label}
                    </span>
                    {cancellableTask ? (
                      <button
                        className="bottom-status-panel__cancel"
                        disabled={cancellableTask.status === 'cancelling'}
                        onClick={() => {
                          props.onCancelTask(cancellableTask);
                        }}
                        type="button"
                      >
                        {getCancelTaskButtonLabel(cancellableTask)}
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

                {shouldShowTaskSummary ? (
                  <>
                    <p className="bottom-status-panel__headline">{getPanelHeadline(props)}</p>
                    <p className="bottom-status-panel__detail">{getPanelDetail(props)}</p>
                  </>
                ) : null}

                {props.activeProgressTask ? (
                  <div className="bottom-status-panel__progress">
                    <div className="bottom-status-panel__progress-track">
                      <div
                        className={`bottom-status-panel__progress-fill ${
                          props.activeProgressTask.status === 'running' ||
                          props.activeProgressTask.status === 'cancelling'
                            ? 'bottom-status-panel__progress-fill--running'
                            : ''
                        } ${
                          props.activeProgressTask.progressPercent === null
                            ? 'bottom-status-panel__progress-fill--indeterminate'
                            : ''
                        }`}
                        style={{
                          width:
                            props.activeProgressTask.progressPercent === null
                              ? '38%'
                              : `${props.activeProgressTask.progressPercent}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {shouldShowTaskSummary ? (
                  <dl
                    className={`bottom-status-panel__meta ${
                      props.activeProgressTask === null ? 'bottom-status-panel__meta--idle' : ''
                    }`}
                  >
                    {detailItems.map((item) => (
                      <div className="bottom-status-panel__meta-item" key={item.label}>
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                {props.activeProgressTask?.errorMessage ? (
                  <p className="bottom-status-panel__error">{props.activeProgressTask.errorMessage}</p>
                ) : null}

                {props.progressTasks.length > 0 ? (
                  <section className="bottom-status-panel__task-list">
                    <div className="bottom-status-panel__task-list-header">
                      <span className="bottom-status-panel__eyebrow">요청 목록</span>
                      <strong>최근 {Math.min(props.progressTasks.length, 6)}건</strong>
                    </div>
                    <ul className="bottom-status-panel__task-items">
                      {props.progressTasks.slice(0, 6).map((task) => (
                        <li key={task.id}>
                          {isTaskSelectable(task) ? (
                            <button
                              aria-pressed={props.activeProgressTask?.id === task.id}
                              className={`bottom-status-panel__task-item bottom-status-panel__task-item--interactive ${
                                props.activeProgressTask?.id === task.id
                                  ? 'bottom-status-panel__task-item--selected'
                                  : ''
                              }`}
                              onClick={() => {
                                props.onSelectTask(task);
                              }}
                              type="button"
                            >
                              <TaskItemContent task={task} />
                            </button>
                          ) : (
                            <div className="bottom-status-panel__task-item">
                              <TaskItemContent task={task} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
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
                activeTask: props.activeProgressTask,
                activeTaskCount,
                inspection: props.inspection,
                now,
                storageStatus: props.storageStatus,
                taskCount: props.progressTasks.length,
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

function TaskItemContent(props: { task: WorkbenchProgressTask }) {
  return (
    <div className="bottom-status-panel__task-copy">
      <div className="bottom-status-panel__task-title-row">
        <strong>{props.task.title}</strong>
        <span
          className={`bottom-status-panel__task-state bottom-status-panel__task-state--${resolveTaskTone(props.task.status)}`}
        >
          {getTaskStatusLabel(props.task.status)}
        </span>
      </div>
      <p>{props.task.detail}</p>
      <div className="bottom-status-panel__task-meta">
        <span>{props.task.projectName ?? '전역 작업'}</span>
        <span>{formatTaskTimestamp(props.task)}</span>
        {props.task.progressPercent !== null ? <span>{props.task.progressPercent}%</span> : null}
        {props.task.stepIndex !== null && props.task.stepTotal !== null ? (
          <span>
            {props.task.stepIndex}/{props.task.stepTotal}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function resolveStatusBadge(
  activeTask: WorkbenchProgressTask | null,
  errorMessage: string | null,
  storageStatus: StatusBadgeModel,
): StatusBadgeModel {
  if (activeTask) {
    return {
      label: getTaskStatusLabel(activeTask.status),
      tone: resolveTaskTone(activeTask.status),
    };
  }

  if (errorMessage) {
    return {
      label: '오류',
      tone: 'warning',
    };
  }

  return storageStatus;
}

function isTaskSelectable(task: WorkbenchProgressTask): boolean {
  return task.status === 'running' || task.status === 'cancelling';
}

function resolveStatusVariant(
  activeTask: WorkbenchProgressTask | null,
  errorMessage: string | null,
  storageStatus: StatusBadgeModel,
): 'idle' | 'running' | 'cancelling' | 'cancelled' | 'succeeded' | 'failed' {
  if (activeTask) {
    return activeTask.status;
  }

  if (errorMessage || storageStatus.tone === 'warning') {
    return 'failed';
  }

  if (storageStatus.tone === 'positive') {
    return 'succeeded';
  }

  return 'idle';
}

function getStripMessage(input: BottomStatusBarProps): string {
  if (input.activeProgressTask) {
    return input.activeProgressTask.detail;
  }

  if (input.errorMessage) {
    return input.errorMessage;
  }

  if (input.inspection?.projectMeta?.lastAnalyzedAt) {
    return `최근 분석 ${formatCompactTimestamp(input.inspection.projectMeta.lastAnalyzedAt)}`;
  }

  return input.message.trim() || '작업 상태가 여기에 표시됩니다.';
}

function getPanelHeadline(input: BottomStatusBarProps): string {
  if (input.activeProgressTask) {
    return input.activeProgressTask.title;
  }

  if (input.errorMessage) {
    return input.errorMessage;
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
    return '최근 작업과 분석 기록이 준비되어 있습니다.';
  }

  return '작업을 실행하면 하단에서 공통 진행 상태를 확인할 수 있습니다.';
}

function getPanelDetail(input: BottomStatusBarProps): string {
  if (input.activeProgressTask) {
    return input.activeProgressTask.detail;
  }

  if (input.errorMessage) {
    return input.errorMessage;
  }

  if (!input.inspection) {
    return '왼쪽 프로젝트 패널에서 로컬 프로젝트를 선택해 시작하세요.';
  }

  if (input.inspection.initializationState !== 'ready') {
    return input.inspection.isWritable
      ? '프로젝트 내부 .sdd 작업 공간을 준비하면 분석과 명세 작업을 이어갈 수 있습니다.'
      : '분석 결과와 채팅을 저장하려면 현재 프로젝트 경로에 쓰기 권한이 필요합니다.';
  }

  if (input.inspection.projectMeta?.lastAnalyzedAt) {
    return `최근 분석 기록 ${formatVerboseTimestamp(input.inspection.projectMeta.lastAnalyzedAt)}`;
  }

  return '전체 분석, 참조 분석, 태그 생성, 명세 채팅 같은 요청이 여기 공통 작업 목록에 쌓입니다.';
}

function buildStripMetrics(input: {
  activeTask: WorkbenchProgressTask | null;
  activeTaskCount: number;
  inspection: ProjectInspection | null;
  now: number;
  storageStatus: StatusBadgeModel;
  taskCount: number;
}): StatusMetaItem[] {
  if (input.activeTask) {
    return [
      {
        label: '활성',
        value: `${input.activeTaskCount}건`,
      },
      {
        label:
          input.activeTask.stepIndex !== null && input.activeTask.stepTotal !== null ? '단계' : '상태',
        value:
          input.activeTask.stepIndex !== null && input.activeTask.stepTotal !== null
            ? `${input.activeTask.stepIndex}/${input.activeTask.stepTotal}`
            : getTaskStatusLabel(input.activeTask.status),
      },
      {
        label:
          input.activeTask.status === 'running' || input.activeTask.status === 'cancelling'
            ? '경과'
            : '최근',
        value: formatElapsedDuration(input.activeTask, input.now),
      },
    ];
  }

  return [
    {
      label: '저장',
      value: input.storageStatus.label,
    },
    {
      label: '요청',
      value: `${input.taskCount}건`,
    },
    {
      label: '최근 분석',
      value: formatCompactTimestamp(input.inspection?.projectMeta?.lastAnalyzedAt ?? null),
    },
  ];
}

function buildDetailItems(input: {
  activeTask: WorkbenchProgressTask | null;
  activeTaskCount: number;
  activeWorkspacePage: WorkspacePageId;
  inspection: ProjectInspection | null;
  now: number;
  storageStatus: StatusBadgeModel;
}): StatusMetaItem[] {
  if (input.activeTask) {
    return [
      {
        label: '프로젝트',
        value: input.activeTask.projectName ?? '전역 작업',
      },
      {
        label: '상태',
        value: getTaskStatusLabel(input.activeTask.status),
      },
      {
        label: '활성 요청',
        value: `${input.activeTaskCount}건`,
      },
      {
        label: '시작 시각',
        value: formatCompactTimestamp(input.activeTask.startedAt),
      },
      {
        label:
          input.activeTask.status === 'running' || input.activeTask.status === 'cancelling'
            ? '경과 시간'
            : '총 소요',
        value: formatElapsedDuration(input.activeTask, input.now),
      },
      {
        label:
          input.activeTask.progressPercent !== null
            ? '진행률'
            : input.activeTask.stepIndex !== null && input.activeTask.stepTotal !== null
              ? '진행 단계'
              : '최근 갱신',
        value:
          input.activeTask.progressPercent !== null
            ? `${input.activeTask.progressPercent}%`
            : input.activeTask.stepIndex !== null && input.activeTask.stepTotal !== null
              ? `${input.activeTask.stepIndex}/${input.activeTask.stepTotal}`
              : formatCompactTimestamp(input.activeTask.updatedAt),
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
    case 'references':
      return '참조';
  }
}

function getTaskStatusLabel(status: WorkbenchProgressTask['status']): string {
  switch (status) {
    case 'running':
      return '진행 중';
    case 'cancelling':
      return '취소 중';
    case 'cancelled':
      return '취소됨';
    case 'failed':
      return '실패';
    case 'succeeded':
      return '완료';
  }
}

function getCancellableTask(
  task: WorkbenchProgressTask | null,
): WorkbenchProgressTask | null {
  if (!task || typeof task.rootPath !== 'string') {
    return null;
  }

  if (task.kind === 'message-send') {
    if (typeof task.sessionId !== 'string') {
      return null;
    }
  } else if (task.kind !== 'analysis' && task.kind !== 'reference-tags-generate') {
    return null;
  }

  if (task.status === 'cancelling') {
    return task;
  }

  return task.isCancellable ? task : null;
}

function getCancelTaskButtonLabel(task: WorkbenchProgressTask): string {
  if (task.status === 'cancelling') {
    return '취소 요청 중...';
  }

  switch (task.kind) {
    case 'analysis':
      return '분석 취소';
    case 'message-send':
      return '응답 취소';
    case 'reference-tags-generate':
      return '태그 생성 취소';
    default:
      return '취소';
  }
}

function resolveTaskTone(status: WorkbenchProgressTask['status']): StatusBadgeModel['tone'] {
  switch (status) {
    case 'failed':
      return 'warning';
    case 'running':
    case 'cancelling':
    case 'cancelled':
      return 'neutral';
    case 'succeeded':
      return 'positive';
  }
}

function formatElapsedDuration(task: WorkbenchProgressTask, now: number): string {
  const startedAtMs = new Date(task.startedAt).getTime();
  if (Number.isNaN(startedAtMs)) {
    return '기록 없음';
  }

  const endedAtCandidate = task.completedAt ?? task.updatedAt;
  const endedAtMs =
    task.status === 'running' || task.status === 'cancelling' || !endedAtCandidate
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

function formatTaskTimestamp(task: WorkbenchProgressTask): string {
  const timestamp =
    task.status === 'running' || task.status === 'cancelling'
      ? task.startedAt
      : task.completedAt ?? task.updatedAt;

  return formatCompactTimestamp(timestamp);
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
