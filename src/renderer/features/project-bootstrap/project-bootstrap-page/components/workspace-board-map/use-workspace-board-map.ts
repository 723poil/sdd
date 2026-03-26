import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  clamp,
  getWorkspaceMapNodeFontScale,
  getWorkspaceMapNodeSpacingScale,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/workspace-map.shared';
import type { WorkspaceStageSize } from '@/renderer/features/project-bootstrap/project-bootstrap-page/use-workspace-stage-size';
import { useWorkspaceStageSize } from '@/renderer/features/project-bootstrap/project-bootstrap-page/use-workspace-stage-size';

import {
  INITIAL_WORKSPACE_BOARD_VIEWPORT,
  type WorkspaceBoardInteractionState,
  type WorkspaceBoardViewport,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/workspace-board-map/workspace-board-map.types';
import {
  createStageGridStyle,
  toWorldPoint,
  type WorkspaceBoardNodeLike,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/workspace-board-map/workspace-board-map.utils';

const NODE_DRAG_THRESHOLD_PX = 3;
const ZOOM_BUTTON_SCALE_STEP = 1.16;

interface UseWorkspaceBoardMapOptions<Node extends WorkspaceBoardNodeLike> {
  baseBoardNodes: Node[];
  createViewportToFitNodes: (nodes: Node[], stageSize: WorkspaceStageSize) => WorkspaceBoardViewport;
  isActive: boolean;
  isMapVisible: boolean;
  maxScale: number;
  minScale: number;
  onNodeDragEnd?: (nodes: Node[]) => void;
  onNodeOpen: (nodeId: Node['id']) => void;
  onReset?: () => void;
  resetKey: string;
}

interface UseWorkspaceBoardMapResult<Node extends WorkspaceBoardNodeLike> {
  boardNodes: Node[];
  draggingNodeId: Node['id'] | null;
  fitBoardToStage: () => void;
  handleNodeClick: (nodeId: Node['id']) => void;
  handleNodePointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    node: Pick<Node, 'id' | 'x' | 'y'>,
  ) => void;
  handleStagePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleStageWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  isPanning: boolean;
  stageGridStyle: Record<string, string>;
  stageRef: RefObject<HTMLDivElement | null>;
  stageSize: WorkspaceStageSize;
  viewport: WorkspaceBoardViewport;
  worldStyle: CSSProperties;
  resetBoardPositions: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

export function useWorkspaceBoardMap<Node extends WorkspaceBoardNodeLike>(
  options: UseWorkspaceBoardMapOptions<Node>,
): UseWorkspaceBoardMapResult<Node> {
  const {
    baseBoardNodes,
    createViewportToFitNodes,
    isActive,
    isMapVisible,
    maxScale,
    minScale,
    onNodeDragEnd,
    onNodeOpen,
    onReset,
    resetKey,
  } = options;
  const stageRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<WorkspaceBoardInteractionState<Node['id']> | null>(null);
  const ignoreClickNodeIdRef = useRef<Node['id'] | null>(null);
  const boardNodesRef = useRef<Node[]>(baseBoardNodes);
  const onResetRef = useRef(onReset);
  const hasAdjustedViewportRef = useRef(false);
  const [draggingNodeId, setDraggingNodeId] = useState<Node['id'] | null>(null);
  const [draftBoardPositions, setDraftBoardPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [isPanning, setIsPanning] = useState(false);
  const [viewport, setViewport] = useState<WorkspaceBoardViewport>(INITIAL_WORKSPACE_BOARD_VIEWPORT);
  const stageSize = useWorkspaceStageSize({
    isEnabled: isActive && isMapVisible && baseBoardNodes.length > 0,
    stageRef,
  });
  const boardNodes = useMemo(
    () =>
      baseBoardNodes.map((node) => {
        const draftPosition = draftBoardPositions[node.id];
        if (!draftPosition) {
          return node;
        }

        return {
          ...node,
          x: draftPosition.x,
          y: draftPosition.y,
        };
      }),
    [baseBoardNodes, draftBoardPositions],
  );
  const worldStyle = useMemo<CSSProperties>(
    () => ({
      transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
      ['--analysis-map-node-font-scale' as string]: getWorkspaceMapNodeFontScale(viewport.scale),
      ['--analysis-map-node-spacing-scale' as string]: getWorkspaceMapNodeSpacingScale(
        viewport.scale,
      ),
    }),
    [viewport.offsetX, viewport.offsetY, viewport.scale],
  );
  const stageGridStyle = useMemo(() => createStageGridStyle(viewport), [viewport]);

  useEffect(() => {
    boardNodesRef.current = boardNodes;
  }, [boardNodes]);

  useEffect(() => {
    onResetRef.current = onReset;
  }, [onReset]);

  useEffect(() => {
    hasAdjustedViewportRef.current = false;
    setViewport(INITIAL_WORKSPACE_BOARD_VIEWPORT);
    setDraftBoardPositions({});
    onResetRef.current?.();
  }, [resetKey]);

  useEffect(() => {
    if (
      !isActive ||
      !isMapVisible ||
      boardNodes.length === 0 ||
      stageSize.width === 0 ||
      stageSize.height === 0
    ) {
      return;
    }

    if (hasAdjustedViewportRef.current) {
      return;
    }

    setViewport(createViewportToFitNodes(boardNodes, stageSize));
    hasAdjustedViewportRef.current = true;
  }, [boardNodes, createViewportToFitNodes, isActive, isMapVisible, stageSize]);

  useEffect(() => {
    if (!isMapVisible) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const stageElement = stageRef.current;
      const interaction = interactionRef.current;
      if (!stageElement || !interaction) {
        return;
      }

      if (interaction.kind === 'pan') {
        const deltaX = event.clientX - interaction.startClientX;
        const deltaY = event.clientY - interaction.startClientY;

        interactionRef.current = {
          ...interaction,
          moved: interaction.moved || Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2,
        };
        hasAdjustedViewportRef.current = true;
        setViewport((current) => ({
          ...current,
          offsetX: interaction.startOffsetX + deltaX,
          offsetY: interaction.startOffsetY + deltaY,
        }));
        return;
      }

      const deltaX = event.clientX - interaction.startClientX;
      const deltaY = event.clientY - interaction.startClientY;
      const hasMovedEnough =
        Math.abs(deltaX) > NODE_DRAG_THRESHOLD_PX || Math.abs(deltaY) > NODE_DRAG_THRESHOLD_PX;
      if (!interaction.moved && !hasMovedEnough) {
        return;
      }

      const worldPoint = toWorldPoint({
        clientX: event.clientX,
        clientY: event.clientY,
        stageElement,
        viewport,
      });
      if (!worldPoint) {
        return;
      }

      interactionRef.current = {
        ...interaction,
        moved: true,
      };
      hasAdjustedViewportRef.current = true;
      setDraftBoardPositions((current) => ({
        ...current,
        [interaction.nodeId]: {
          x: worldPoint.x - interaction.pointerOffsetX,
          y: worldPoint.y - interaction.pointerOffsetY,
        },
      }));
    };

    const handlePointerUp = () => {
      const interaction = interactionRef.current;
      if (interaction?.kind === 'node') {
        ignoreClickNodeIdRef.current = interaction.nodeId;
        if (interaction.moved) {
          onNodeDragEnd?.(boardNodesRef.current);
        } else {
          onNodeOpen(interaction.nodeId);
        }
      }

      interactionRef.current = null;
      setDraggingNodeId(null);
      setIsPanning(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isMapVisible, onNodeDragEnd, onNodeOpen, viewport]);

  const fitBoardToStage = () => {
    if (boardNodes.length === 0 || stageSize.width === 0 || stageSize.height === 0) {
      return;
    }

    hasAdjustedViewportRef.current = true;
    setViewport(createViewportToFitNodes(boardNodes, stageSize));
  };

  const resetBoardPositions = () => {
    interactionRef.current = null;
    ignoreClickNodeIdRef.current = null;
    hasAdjustedViewportRef.current = false;
    setDraggingNodeId(null);
    setIsPanning(false);
    setDraftBoardPositions({});
    setViewport(INITIAL_WORKSPACE_BOARD_VIEWPORT);
  };

  const handleStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    interactionRef.current = {
      kind: 'pan',
      moved: false,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: viewport.offsetX,
      startOffsetY: viewport.offsetY,
    };
    setIsPanning(true);
  };

  const handleNodeClick = (nodeId: Node['id']) => {
    if (ignoreClickNodeIdRef.current === nodeId) {
      ignoreClickNodeIdRef.current = null;
      return;
    }

    onNodeOpen(nodeId);
  };

  const handleNodePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    node: Pick<Node, 'id' | 'x' | 'y'>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const stageElement = stageRef.current;
    if (!stageElement) {
      return;
    }

    const worldPoint = toWorldPoint({
      clientX: event.clientX,
      clientY: event.clientY,
      stageElement,
      viewport,
    });
    if (!worldPoint) {
      return;
    }

    interactionRef.current = {
      kind: 'node',
      moved: false,
      nodeId: node.id,
      pointerOffsetX: worldPoint.x - node.x,
      pointerOffsetY: worldPoint.y - node.y,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
    setDraggingNodeId(node.id);
  };

  const handleStageWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const stageElement = stageRef.current;
    if (!stageElement) {
      return;
    }

    const stageRect = stageElement.getBoundingClientRect();
    const stageX = event.clientX - stageRect.left;
    const stageY = event.clientY - stageRect.top;
    const nextScale = clamp(viewport.scale * Math.exp(-event.deltaY * 0.0016), minScale, maxScale);
    const centerX = stageRect.width / 2;
    const centerY = stageRect.height / 2;
    const worldX = (stageX - centerX - viewport.offsetX) / viewport.scale;
    const worldY = (stageY - centerY - viewport.offsetY) / viewport.scale;

    hasAdjustedViewportRef.current = true;
    setViewport({
      scale: nextScale,
      offsetX: stageX - centerX - worldX * nextScale,
      offsetY: stageY - centerY - worldY * nextScale,
    });
  };

  const applyScaleFromButton = (scaleDelta: number) => {
    const stageElement = stageRef.current;
    if (!stageElement) {
      return;
    }

    const stageRect = stageElement.getBoundingClientRect();
    const anchorX = stageRect.width / 2;
    const anchorY = stageRect.height / 2;

    hasAdjustedViewportRef.current = true;
    setViewport((current) => {
      const nextScale = clamp(current.scale * scaleDelta, minScale, maxScale);
      const worldX = (anchorX - stageRect.width / 2 - current.offsetX) / current.scale;
      const worldY = (anchorY - stageRect.height / 2 - current.offsetY) / current.scale;

      return {
        scale: nextScale,
        offsetX: anchorX - stageRect.width / 2 - worldX * nextScale,
        offsetY: anchorY - stageRect.height / 2 - worldY * nextScale,
      };
    });
  };

  return {
    boardNodes,
    draggingNodeId,
    fitBoardToStage,
    handleNodeClick,
    handleNodePointerDown,
    handleStagePointerDown,
    handleStageWheel,
    isPanning,
    stageGridStyle,
    stageRef,
    stageSize,
    viewport,
    worldStyle,
    resetBoardPositions,
    zoomIn: () => {
      applyScaleFromButton(ZOOM_BUTTON_SCALE_STEP);
    },
    zoomOut: () => {
      applyScaleFromButton(1 / ZOOM_BUTTON_SCALE_STEP);
    },
  };
}
