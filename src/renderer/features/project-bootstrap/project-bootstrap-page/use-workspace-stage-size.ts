import { useEffect, useState, type RefObject } from 'react';

export interface WorkspaceStageSize {
  height: number;
  width: number;
}

export const EMPTY_WORKSPACE_STAGE_SIZE: WorkspaceStageSize = {
  width: 0,
  height: 0,
};

export function useWorkspaceStageSize(input: {
  isEnabled: boolean;
  stageRef: RefObject<HTMLDivElement | null>;
}): WorkspaceStageSize {
  const [stageSize, setStageSize] = useState<WorkspaceStageSize>(EMPTY_WORKSPACE_STAGE_SIZE);

  useEffect(() => {
    if (!input.isEnabled) {
      return;
    }

    const stageElement = input.stageRef.current;
    if (!stageElement) {
      return;
    }

    let animationFrameId = 0;
    const updateStageSize = () => {
      const stageRect = stageElement.getBoundingClientRect();
      setStageSize({
        width: stageRect.width,
        height: stageRect.height,
      });
    };

    updateStageSize();
    animationFrameId = window.requestAnimationFrame(updateStageSize);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        updateStageSize();
        return;
      }

      setStageSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    resizeObserver.observe(stageElement);
    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [input.isEnabled, input.stageRef]);

  return stageSize;
}
