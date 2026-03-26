export interface WorkspaceMapRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface WorkspaceMapStageSize {
  height: number;
  width: number;
}

export interface WorkspaceMapViewport {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export function buildWorkspaceMapCurvedLinkGeometry(input: {
  fromRect: WorkspaceMapRect;
  stageSize: WorkspaceMapStageSize;
  summary?: boolean;
  toRect: WorkspaceMapRect;
  viewport: WorkspaceMapViewport;
}): { midX: number; midY: number; path: string } {
  const fromCenterX = input.fromRect.x + input.fromRect.width / 2;
  const fromCenterY = input.fromRect.y + input.fromRect.height / 2;
  const toCenterX = input.toRect.x + input.toRect.width / 2;
  const toCenterY = input.toRect.y + input.toRect.height / 2;
  const fromBoundaryPoint = resolveRectBoundaryIntersection({
    rect: input.fromRect,
    targetX: toCenterX,
    targetY: toCenterY,
  });
  const toBoundaryPoint = resolveRectBoundaryIntersection({
    rect: input.toRect,
    targetX: fromCenterX,
    targetY: fromCenterY,
  });
  const horizontalDistance = Math.abs(toBoundaryPoint.x - fromBoundaryPoint.x);
  const verticalDistance = Math.abs(toBoundaryPoint.y - fromBoundaryPoint.y);
  const useHorizontal = horizontalDistance >= verticalDistance * 1.1;
  const start = toWorkspaceMapScreenPoint({
    stageSize: input.stageSize,
    viewport: input.viewport,
    x: fromBoundaryPoint.x,
    y: fromBoundaryPoint.y,
  });
  const end = toWorkspaceMapScreenPoint({
    stageSize: input.stageSize,
    viewport: input.viewport,
    x: toBoundaryPoint.x,
    y: toBoundaryPoint.y,
  });

  if (useHorizontal) {
    const drawFromRight = start.x <= end.x;
    const controlOffset = Math.max(
      Math.abs(end.x - start.x) * (input.summary ? 0.24 : 0.36),
      input.summary ? 92 : 72,
    );

    return {
      midX: (start.x + end.x) / 2,
      midY: (start.y + end.y) / 2,
      path: drawFromRight
      ? `M ${start.x} ${start.y} C ${start.x + controlOffset} ${start.y}, ${end.x - controlOffset} ${end.y}, ${end.x} ${end.y}`
      : `M ${start.x} ${start.y} C ${start.x - controlOffset} ${start.y}, ${end.x + controlOffset} ${end.y}, ${end.x} ${end.y}`,
    };
  }

  const drawFromBottom = start.y <= end.y;
  const controlOffset = Math.max(
    Math.abs(end.y - start.y) * (input.summary ? 0.28 : 0.34),
    input.summary ? 78 : 62,
  );

  return {
    midX: (start.x + end.x) / 2,
    midY: (start.y + end.y) / 2,
    path: drawFromBottom
      ? `M ${start.x} ${start.y} C ${start.x} ${start.y + controlOffset}, ${end.x} ${end.y - controlOffset}, ${end.x} ${end.y}`
      : `M ${start.x} ${start.y} C ${start.x} ${start.y - controlOffset}, ${end.x} ${end.y + controlOffset}, ${end.x} ${end.y}`,
  };
}

function resolveRectBoundaryIntersection(input: {
  rect: WorkspaceMapRect;
  targetX: number;
  targetY: number;
}): { x: number; y: number } {
  const centerX = input.rect.x + input.rect.width / 2;
  const centerY = input.rect.y + input.rect.height / 2;
  const deltaX = input.targetX - centerX;
  const deltaY = input.targetY - centerY;
  if (deltaX === 0 && deltaY === 0) {
    return {
      x: centerX,
      y: centerY,
    };
  }

  const halfWidth = input.rect.width / 2;
  const halfHeight = input.rect.height / 2;
  const scale = 1 / Math.max(Math.abs(deltaX) / halfWidth, Math.abs(deltaY) / halfHeight);

  return {
    x: centerX + deltaX * scale,
    y: centerY + deltaY * scale,
  };
}

export function toWorkspaceMapScreenPoint(input: {
  stageSize: WorkspaceMapStageSize;
  viewport: WorkspaceMapViewport;
  x: number;
  y: number;
}): { x: number; y: number } {
  return {
    x: input.stageSize.width / 2 + input.viewport.offsetX + input.x * input.viewport.scale,
    y: input.stageSize.height / 2 + input.viewport.offsetY + input.y * input.viewport.scale,
  };
}

export function toWorkspaceMapWorldPoint(input: {
  stageSize: WorkspaceMapStageSize;
  viewport: WorkspaceMapViewport;
  x: number;
  y: number;
}): { x: number; y: number } {
  return {
    x: (input.x - input.stageSize.width / 2 - input.viewport.offsetX) / input.viewport.scale,
    y: (input.y - input.stageSize.height / 2 - input.viewport.offsetY) / input.viewport.scale,
  };
}
