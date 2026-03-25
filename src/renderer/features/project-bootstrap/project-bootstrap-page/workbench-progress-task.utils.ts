import type { ProjectAnalysisRunStatus } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';
import type {
  WorkbenchProgressTask,
  WorkbenchProgressTaskKind,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';
import type { ProjectInspection, RecentProject } from '@/domain/project/project-model';

const WORKBENCH_PROGRESS_TASK_LIMIT = 10;
const WORKBENCH_SUCCESS_HISTORY_KINDS = new Set<WorkbenchProgressTaskKind>([
  'analysis',
  'spec-create',
  'session-create',
  'reference-tags-generate',
]);
const WORKBENCH_CANCELLED_HISTORY_KINDS = new Set<WorkbenchProgressTaskKind>([
  'analysis',
  'reference-tags-generate',
]);

export function createWorkbenchProgressTask(input: {
  detail: string;
  id: string;
  isCancellable?: boolean;
  kind: WorkbenchProgressTaskKind;
  now: string;
  projectName?: string | null;
  rootPath?: string | null;
  title: string;
}): WorkbenchProgressTask {
  return {
    id: input.id,
    kind: input.kind,
    title: input.title,
    detail: input.detail,
    projectName: input.projectName ?? null,
    rootPath: input.rootPath ?? null,
    status: 'running',
    startedAt: input.now,
    updatedAt: input.now,
    completedAt: null,
    errorMessage: null,
    stepIndex: null,
    stepTotal: null,
    progressPercent: null,
    isCancellable: input.isCancellable ?? false,
  };
}

export function updateWorkbenchProgressTaskList(
  tasks: WorkbenchProgressTask[],
  task: WorkbenchProgressTask,
): WorkbenchProgressTask[] {
  if (!shouldRetainWorkbenchProgressTask(task)) {
    return sortWorkbenchProgressTasks(
      tasks.filter((candidate) => candidate.id !== task.id),
    ).slice(0, WORKBENCH_PROGRESS_TASK_LIMIT);
  }

  const existingIndex = tasks.findIndex((candidate) => candidate.id === task.id);
  const nextTasks =
    existingIndex >= 0
      ? tasks.map((candidate, index) => (index === existingIndex ? task : candidate))
      : [...tasks, task];

  return sortWorkbenchProgressTasks(nextTasks).slice(0, WORKBENCH_PROGRESS_TASK_LIMIT);
}

export function patchWorkbenchProgressTask(input: {
  patch: Partial<WorkbenchProgressTask>;
  task: WorkbenchProgressTask;
}): WorkbenchProgressTask {
  const nextStatus = input.patch.status ?? input.task.status;
  const nextUpdatedAt = input.patch.updatedAt ?? new Date().toISOString();
  const shouldComplete =
    nextStatus === 'succeeded' || nextStatus === 'failed' || nextStatus === 'cancelled';

  return {
    ...input.task,
    ...input.patch,
    status: nextStatus,
    updatedAt: nextUpdatedAt,
    completedAt:
      typeof input.patch.completedAt !== 'undefined'
        ? input.patch.completedAt
        : shouldComplete
          ? nextUpdatedAt
          : input.task.completedAt,
  };
}

export function buildWorkbenchProgressTasks(input: {
  analysisRunStatusesByRootPath: Record<string, ProjectAnalysisRunStatus>;
  inspection: ProjectInspection | null;
  recentProjects: RecentProject[];
  requestProgressTasks: WorkbenchProgressTask[];
}): WorkbenchProgressTask[] {
  const projectNamesByRootPath = new Map(
    input.recentProjects.map((project) => [project.rootPath, project.projectName] as const),
  );
  if (input.inspection) {
    projectNamesByRootPath.set(input.inspection.rootPath, input.inspection.projectName);
  }

  const analysisTasks = Object.values(input.analysisRunStatusesByRootPath)
    .map((status) =>
      toAnalysisProgressTask({
        projectName: projectNamesByRootPath.get(status.rootPath) ?? null,
        status,
      }),
    )
    .filter((task): task is WorkbenchProgressTask => task !== null);

  return sortWorkbenchProgressTasks([...input.requestProgressTasks, ...analysisTasks]).slice(
    0,
    WORKBENCH_PROGRESS_TASK_LIMIT,
  );
}

export function getActiveWorkbenchProgressTask(
  tasks: WorkbenchProgressTask[],
  preferredTaskId?: string | null,
): WorkbenchProgressTask | null {
  if (preferredTaskId) {
    const preferredTask = tasks.find(
      (task) =>
        task.id === preferredTaskId && (task.status === 'running' || task.status === 'cancelling'),
    );
    if (preferredTask) {
      return preferredTask;
    }
  }

  return (
    tasks.find((task) => task.status === 'running' || task.status === 'cancelling') ??
    tasks.find((task) => task.status === 'failed') ??
    null
  );
}

function shouldRetainWorkbenchProgressTask(task: WorkbenchProgressTask): boolean {
  switch (task.status) {
    case 'running':
    case 'cancelling':
    case 'failed':
      return true;
    case 'cancelled':
      return WORKBENCH_CANCELLED_HISTORY_KINDS.has(task.kind);
    case 'succeeded':
      return WORKBENCH_SUCCESS_HISTORY_KINDS.has(task.kind);
  }
}

function toAnalysisProgressTask(input: {
  projectName: string | null;
  status: ProjectAnalysisRunStatus;
}): WorkbenchProgressTask | null {
  if (input.status.status === 'idle') {
    return null;
  }

  const progressPercent = getAnalysisProgressPercent(input.status);
  const title = input.status.stageMessage.includes('참조') ? '참조 분석' : '전체 분석';
  const isRunning = input.status.status === 'running' || input.status.status === 'cancelling';

  return {
    id: `analysis:${input.status.rootPath}`,
    kind: 'analysis',
    title,
    detail: input.status.progressMessage ?? input.status.stageMessage,
    projectName: input.projectName,
    rootPath: input.status.rootPath,
    status: input.status.status,
    startedAt: input.status.startedAt ?? input.status.updatedAt ?? new Date(0).toISOString(),
    updatedAt:
      input.status.updatedAt ?? input.status.completedAt ?? input.status.startedAt ?? new Date().toISOString(),
    completedAt: input.status.completedAt,
    errorMessage: input.status.lastError,
    stepIndex: input.status.stepIndex,
    stepTotal: input.status.stepTotal,
    progressPercent,
    isCancellable: isRunning && input.status.stepIndex < input.status.stepTotal,
  };
}

function sortWorkbenchProgressTasks(tasks: WorkbenchProgressTask[]): WorkbenchProgressTask[] {
  return [...tasks].sort((left, right) => {
    const leftRank = getWorkbenchProgressTaskSortRank(left.status);
    const rightRank = getWorkbenchProgressTaskSortRank(right.status);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function getWorkbenchProgressTaskSortRank(
  status: WorkbenchProgressTask['status'],
): number {
  switch (status) {
    case 'running':
    case 'cancelling':
      return 0;
    case 'failed':
      return 1;
    case 'cancelled':
      return 2;
    case 'succeeded':
      return 3;
  }
}

function getAnalysisProgressPercent(status: ProjectAnalysisRunStatus): number {
  if (status.stepTotal <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((status.stepIndex / status.stepTotal) * 100)));
}
