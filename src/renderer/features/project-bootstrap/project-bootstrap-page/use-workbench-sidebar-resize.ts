import { type CSSProperties, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import type { WorkbenchSidebarResizeSide } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/WorkbenchSidebarResizeHandle';

const DEFAULT_LEFT_SIDEBAR_WIDTH = 252;
const DEFAULT_RIGHT_SIDEBAR_WIDTH = 320;
const MIN_LEFT_SIDEBAR_WIDTH = 220;
const MAX_LEFT_SIDEBAR_WIDTH = 420;
const MIN_RIGHT_SIDEBAR_WIDTH = 280;
const MAX_RIGHT_SIDEBAR_WIDTH = 520;
const MIN_MAIN_PANEL_WIDTH = 520;

interface SidebarResizeState {
  side: WorkbenchSidebarResizeSide;
  startClientX: number;
  startLeftSidebarWidth: number;
  startRightSidebarWidth: number;
}

export function useWorkbenchSidebarResize() {
  const workbenchRef = useRef<HTMLElement | null>(null);
  const resizeStateRef = useRef<SidebarResizeState | null>(null);
  const workbenchWidthRef = useRef(0);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(DEFAULT_LEFT_SIDEBAR_WIDTH);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(DEFAULT_RIGHT_SIDEBAR_WIDTH);
  const [activeResizeSide, setActiveResizeSide] = useState<WorkbenchSidebarResizeSide | null>(null);
  const leftSidebarWidthRef = useRef(leftSidebarWidth);
  const rightSidebarWidthRef = useRef(rightSidebarWidth);

  leftSidebarWidthRef.current = leftSidebarWidth;
  rightSidebarWidthRef.current = rightSidebarWidth;

  const workbenchStyle = useMemo<CSSProperties>(
    () => ({
      ['--left-sidebar-width' as string]: `${leftSidebarWidth}px`,
      ['--right-sidebar-width' as string]: `${rightSidebarWidth}px`,
    }),
    [leftSidebarWidth, rightSidebarWidth],
  );

  const stopResize = useEffectEvent(() => {
    resizeStateRef.current = null;
    setActiveResizeSide(null);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  const handleGlobalPointerMove = useEffectEvent((event: PointerEvent) => {
    const resizeState = resizeStateRef.current;
    if (!resizeState) {
      return;
    }

    if (resizeState.side === 'left') {
      const deltaX = event.clientX - resizeState.startClientX;
      setLeftSidebarWidth(
        getClampedLeftSidebarWidth(
          resizeState.startLeftSidebarWidth + deltaX,
          workbenchWidthRef.current,
          resizeState.startRightSidebarWidth,
        ),
      );
      return;
    }

    const deltaX = event.clientX - resizeState.startClientX;
    setRightSidebarWidth(
      getClampedRightSidebarWidth(
        resizeState.startRightSidebarWidth - deltaX,
        workbenchWidthRef.current,
        resizeState.startLeftSidebarWidth,
      ),
    );
  });

  const updateWorkbenchWidth = useEffectEvent((width: number) => {
    workbenchWidthRef.current = width;
    setLeftSidebarWidth((current) =>
      getClampedLeftSidebarWidth(current, width, rightSidebarWidthRef.current),
    );
    setRightSidebarWidth((current) =>
      getClampedRightSidebarWidth(current, width, leftSidebarWidthRef.current),
    );
  });

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      handleGlobalPointerMove(event);
    };
    const handlePointerUp = () => {
      stopResize();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      stopResize();
    };
  }, []);

  useEffect(() => {
    const workbenchElement = workbenchRef.current;
    if (!workbenchElement) {
      return;
    }

    updateWorkbenchWidth(workbenchElement.getBoundingClientRect().width);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        updateWorkbenchWidth(workbenchElement.getBoundingClientRect().width);
        return;
      }

      updateWorkbenchWidth(entry.contentRect.width);
    });

    resizeObserver.observe(workbenchElement);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const startResize = (side: WorkbenchSidebarResizeSide, clientX: number) => {
    resizeStateRef.current = {
      side,
      startClientX: clientX,
      startLeftSidebarWidth: leftSidebarWidth,
      startRightSidebarWidth: rightSidebarWidth,
    };
    setActiveResizeSide(side);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const nudgeSidebarWidth = (side: WorkbenchSidebarResizeSide, delta: number) => {
    if (side === 'left') {
      setLeftSidebarWidth((current) =>
        getClampedLeftSidebarWidth(current + delta, workbenchWidthRef.current, rightSidebarWidth),
      );
      return;
    }

    setRightSidebarWidth((current) =>
      getClampedRightSidebarWidth(current + delta, workbenchWidthRef.current, leftSidebarWidth),
    );
  };

  return {
    activeResizeSide,
    nudgeSidebarWidth,
    startResize,
    workbenchRef,
    workbenchStyle,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function getClampedLeftSidebarWidth(
  nextWidth: number,
  containerWidth: number,
  currentRightSidebarWidth: number,
): number {
  const maxWidth = Math.max(
    MIN_LEFT_SIDEBAR_WIDTH,
    Math.min(
      MAX_LEFT_SIDEBAR_WIDTH,
      containerWidth - currentRightSidebarWidth - MIN_MAIN_PANEL_WIDTH,
    ),
  );

  return clamp(nextWidth, MIN_LEFT_SIDEBAR_WIDTH, maxWidth);
}

function getClampedRightSidebarWidth(
  nextWidth: number,
  containerWidth: number,
  currentLeftSidebarWidth: number,
): number {
  const maxWidth = Math.max(
    MIN_RIGHT_SIDEBAR_WIDTH,
    Math.min(
      MAX_RIGHT_SIDEBAR_WIDTH,
      containerWidth - currentLeftSidebarWidth - MIN_MAIN_PANEL_WIDTH,
    ),
  );

  return clamp(nextWidth, MIN_RIGHT_SIDEBAR_WIDTH, maxWidth);
}
