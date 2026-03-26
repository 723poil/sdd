import {
  DOCUMENT_MAP_VIEWPORT_PRESET,
  WORKSPACE_MAP_GRID_SIZE,
  getWorkspaceMapFitScale,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/workspace-map.shared';
import { buildWorkspaceMapCurvedLinkGeometry } from '@/renderer/features/project-bootstrap/project-bootstrap-page/workspace-map-link-geometry';
import type { WorkspaceStageSize } from '@/renderer/features/project-bootstrap/project-bootstrap-page/use-workspace-stage-size';

import type {
  WorkspaceBoardRenderedLink,
  WorkspaceBoardViewport,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/workspace-board-map/workspace-board-map.types';

export interface WorkspaceBoardNodeLike {
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
}

export interface WorkspaceBoardLinkLike<NodeId extends string = string> {
  from: NodeId;
  label: string;
  to: NodeId;
}

export function buildWorkspaceBoardLinkPaths<
  Node extends WorkspaceBoardNodeLike,
  Link extends WorkspaceBoardLinkLike<Node['id']>,
>(
  nodes: Node[],
  links: Link[],
  stageSize: WorkspaceStageSize,
  viewport: WorkspaceBoardViewport,
): WorkspaceBoardRenderedLink<Node['id']>[] {
  return links.flatMap((link) => {
    const from = nodes.find((node) => node.id === link.from);
    const to = nodes.find((node) => node.id === link.to);
    if (!from || !to || stageSize.width === 0 || stageSize.height === 0) {
      return [];
    }

    const geometry = buildWorkspaceMapCurvedLinkGeometry({
      fromRect: from,
      stageSize,
      toRect: to,
      viewport,
    });

    return [
      {
        from: link.from,
        key: `${link.from}-${link.to}`,
        label: link.label,
        midX: geometry.midX,
        midY: geometry.midY,
        path: geometry.path,
        to: link.to,
      },
    ];
  });
}

export function createViewportToFitBoardNodes<Node extends WorkspaceBoardNodeLike>(
  nodes: Node[],
  stageSize: WorkspaceStageSize,
): WorkspaceBoardViewport {
  const bounds = getWorkspaceBoardNodeBounds(nodes);
  const scale = getWorkspaceMapFitScale({
    boundsWidth: bounds.width,
    boundsHeight: bounds.height,
    stageWidth: stageSize.width,
    stageHeight: stageSize.height,
    viewportPreset: DOCUMENT_MAP_VIEWPORT_PRESET,
  });

  return {
    scale,
    offsetX: -(bounds.minX + bounds.width / 2) * scale,
    offsetY: -(bounds.minY + bounds.height / 2) * scale,
  };
}

export function createStageGridStyle(viewport: WorkspaceBoardViewport): Record<string, string> {
  const gridSize = WORKSPACE_MAP_GRID_SIZE * viewport.scale;

  return {
    backgroundPosition: `calc(50% + ${viewport.offsetX}px) calc(50% + ${viewport.offsetY}px)`,
    backgroundSize: `${gridSize}px ${gridSize}px`,
  };
}

export function toWorldPoint(input: {
  clientX: number;
  clientY: number;
  stageElement: HTMLDivElement;
  viewport: WorkspaceBoardViewport;
}): { x: number; y: number } | null {
  const stageRect = input.stageElement.getBoundingClientRect();
  if (stageRect.width === 0 || stageRect.height === 0) {
    return null;
  }

  const stageX = input.clientX - stageRect.left;
  const stageY = input.clientY - stageRect.top;

  return {
    x: (stageX - stageRect.width / 2 - input.viewport.offsetX) / input.viewport.scale,
    y: (stageY - stageRect.height / 2 - input.viewport.offsetY) / input.viewport.scale,
  };
}

export function getWorkspaceBoardNodeBounds<Node extends WorkspaceBoardNodeLike>(
  nodes: Node[],
): {
  height: number;
  minX: number;
  minY: number;
  width: number;
} {
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));

  return {
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
