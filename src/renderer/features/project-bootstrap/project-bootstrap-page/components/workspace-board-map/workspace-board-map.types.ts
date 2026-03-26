export interface WorkspaceBoardViewport {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export interface WorkspaceBoardRenderedLink<NodeId extends string = string> {
  from: NodeId;
  key: string;
  label: string;
  midX: number;
  midY: number;
  path: string;
  to: NodeId;
}

export type WorkspaceBoardInteractionState<NodeId extends string = string> =
  | {
      kind: 'pan';
      moved: boolean;
      startClientX: number;
      startClientY: number;
      startOffsetX: number;
      startOffsetY: number;
    }
  | {
      kind: 'node';
      moved: boolean;
      nodeId: NodeId;
      pointerOffsetX: number;
      pointerOffsetY: number;
      startClientX: number;
      startClientY: number;
    };

export const INITIAL_WORKSPACE_BOARD_VIEWPORT: WorkspaceBoardViewport = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};
