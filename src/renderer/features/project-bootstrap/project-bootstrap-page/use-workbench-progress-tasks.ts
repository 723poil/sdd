import { useRef, useState } from 'react';

import type {
  WorkbenchProgressTask,
  WorkbenchProgressTaskKind,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';
import {
  createWorkbenchProgressTask,
  patchWorkbenchProgressTask,
  updateWorkbenchProgressTaskList,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/workbench-progress-task.utils';

export function useWorkbenchProgressTasks() {
  const [requestProgressTasks, setRequestProgressTasks] = useState<WorkbenchProgressTask[]>([]);
  const [selectedProgressTaskId, setSelectedProgressTaskId] = useState<string | null>(null);
  const progressTaskSequenceRef = useRef(0);

  const createRequestProgressTaskId = (kind: WorkbenchProgressTaskKind): string => {
    progressTaskSequenceRef.current += 1;
    return `${kind}:${progressTaskSequenceRef.current}`;
  };

  const applyRequestProgressTask = (task: WorkbenchProgressTask) => {
    setRequestProgressTasks((current) => updateWorkbenchProgressTaskList(current, task));
  };

  const startRequestProgressTask = (input: {
    detail: string;
    isCancellable?: boolean;
    kind: WorkbenchProgressTaskKind;
    projectName?: string | null;
    rootPath?: string | null;
    title: string;
  }): WorkbenchProgressTask => {
    const now = new Date().toISOString();
    const task = createWorkbenchProgressTask({
      detail: input.detail,
      id: createRequestProgressTaskId(input.kind),
      kind: input.kind,
      now,
      projectName: input.projectName ?? null,
      rootPath: input.rootPath ?? null,
      title: input.title,
      ...(typeof input.isCancellable === 'boolean' ? { isCancellable: input.isCancellable } : {}),
    });
    applyRequestProgressTask(task);
    return task;
  };

  const updateRequestProgressTask = (
    task: WorkbenchProgressTask,
    patch: Partial<WorkbenchProgressTask>,
  ): WorkbenchProgressTask => {
    const nextTask = patchWorkbenchProgressTask({
      patch,
      task,
    });
    applyRequestProgressTask(nextTask);
    return nextTask;
  };

  const updateRequestProgressTaskById = (
    taskId: string,
    patch: Partial<WorkbenchProgressTask>,
  ): void => {
    setRequestProgressTasks((current) => {
      const task = current.find((candidate) => candidate.id === taskId);
      if (!task) {
        return current;
      }

      return updateWorkbenchProgressTaskList(
        current,
        patchWorkbenchProgressTask({
          patch,
          task,
        }),
      );
    });
  };

  return {
    requestProgressTasks,
    selectedProgressTaskId,
    startRequestProgressTask,
    updateRequestProgressTask,
    updateRequestProgressTaskById,
    selectProgressTask(taskId: string) {
      setSelectedProgressTaskId(taskId);
    },
  };
}
