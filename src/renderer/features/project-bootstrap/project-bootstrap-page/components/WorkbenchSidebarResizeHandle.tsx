import type { KeyboardEvent, PointerEvent } from 'react';

export type WorkbenchSidebarResizeSide = 'left' | 'right';

interface WorkbenchSidebarResizeHandleProps {
  isActive: boolean;
  onAdjustByKeyboard: (delta: number) => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  side: WorkbenchSidebarResizeSide;
}

export function WorkbenchSidebarResizeHandle(props: WorkbenchSidebarResizeHandleProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      props.onAdjustByKeyboard(props.side === 'left' ? -16 : 16);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      props.onAdjustByKeyboard(props.side === 'left' ? 16 : -16);
    }
  };

  return (
    <div
      aria-label={props.side === 'left' ? '왼쪽 패널 너비 조절' : '오른쪽 패널 너비 조절'}
      className={`workbench-resize-handle workbench-resize-handle--${props.side} ${
        props.isActive ? 'workbench-resize-handle--active' : ''
      }`}
      onKeyDown={handleKeyDown}
      onPointerDown={props.onPointerDown}
      role="separator"
      tabIndex={0}
    />
  );
}
