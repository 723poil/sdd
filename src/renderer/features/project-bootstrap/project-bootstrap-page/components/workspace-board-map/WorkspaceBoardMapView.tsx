import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
  WheelEvent as ReactWheelEvent,
} from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

import type { WorkspaceBoardRenderedLink } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/workspace-board-map/workspace-board-map.types';
import type { WorkspaceBoardNodeLike } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/workspace-board-map/workspace-board-map.utils';
import { buildWorkspaceMapCurvedLinkGeometry } from '@/renderer/features/project-bootstrap/project-bootstrap-page/workspace-map-link-geometry';

interface WorkspaceBoardMapViewProps<Node extends WorkspaceBoardNodeLike> {
  boardNodes: Node[];
  draggingNodeId: string | null;
  getNodeClassName?: (node: Node) => string | null;
  isPanning: boolean;
  linkClassName?: string;
  linkLabelClassName?: string;
  linkPaths: WorkspaceBoardRenderedLink[];
  markerId: string;
  onFitBoardToStage: () => void;
  onNodeClick: (nodeId: Node['id']) => void;
  onNodePointerDown: (event: ReactPointerEvent<HTMLButtonElement>, node: Node) => void;
  onResetPositions?: () => void;
  onStagePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onStageWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  renderNodeContent: (node: Node) => ReactNode;
  rootClassName?: string;
  selectedNodeId: string | null;
  shouldShowLinkLabels?: boolean;
  stageGridStyle: Record<string, string>;
  stageRef: RefObject<HTMLDivElement | null>;
  viewportScale: number;
  worldStyle: CSSProperties;
}

export function WorkspaceBoardMapView<Node extends WorkspaceBoardNodeLike>(
  props: WorkspaceBoardMapViewProps<Node>,
) {
  const {
    boardNodes,
    draggingNodeId,
    getNodeClassName,
    isPanning,
    linkClassName,
    linkLabelClassName,
    linkPaths,
    markerId,
    onFitBoardToStage,
    onNodeClick,
    onNodePointerDown,
    onResetPositions,
    onStagePointerDown,
    onStageWheel,
    onZoomIn,
    onZoomOut,
    renderNodeContent,
    rootClassName,
    selectedNodeId,
    shouldShowLinkLabels = true,
    stageGridStyle,
    stageRef,
    viewportScale,
    worldStyle,
  } = props;
  const nodeElementByIdRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const [measuredLinkPaths, setMeasuredLinkPaths] = useState(linkPaths);

  useLayoutEffect(() => {
    const stageElement = stageRef.current;
    if (!stageElement) {
      setMeasuredLinkPaths(linkPaths);
      return;
    }

    const stageRect = stageElement.getBoundingClientRect();
    const nextLinkPaths = linkPaths.map((linkPath) => {
      const fromElement = nodeElementByIdRef.current[linkPath.from];
      const toElement = nodeElementByIdRef.current[linkPath.to];
      if (!fromElement || !toElement) {
        return linkPath;
      }

      const fromRect = fromElement.getBoundingClientRect();
      const toRect = toElement.getBoundingClientRect();
      const geometry = buildWorkspaceMapCurvedLinkGeometry({
        fromRect: {
          x: fromRect.left - stageRect.left,
          y: fromRect.top - stageRect.top,
          width: fromRect.width,
          height: fromRect.height,
        },
        stageSize: {
          width: 0,
          height: 0,
        },
        toRect: {
          x: toRect.left - stageRect.left,
          y: toRect.top - stageRect.top,
          width: toRect.width,
          height: toRect.height,
        },
        viewport: {
          scale: 1,
          offsetX: 0,
          offsetY: 0,
        },
      });

      return {
        ...linkPath,
        midX: geometry.midX,
        midY: geometry.midY,
        path: geometry.path,
      };
    });

    setMeasuredLinkPaths(nextLinkPaths);
  }, [boardNodes, linkPaths, stageRef, worldStyle]);

  return (
    <section className={`analysis-map${rootClassName ? ` ${rootClassName}` : ''}`}>
      <div
        className={`analysis-map__stage ${isPanning ? 'analysis-map__stage--panning' : ''}`}
        onPointerDown={onStagePointerDown}
        onWheel={onStageWheel}
        ref={stageRef}
        style={stageGridStyle}
      >
        <div
          className="analysis-map__hud"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          <div className="analysis-map__zoom-badge">{Math.round(viewportScale * 100)}%</div>
          <div className="analysis-map__zoom-controls">
            <button
              aria-label="축소"
              className="analysis-map__control-button"
              onClick={onZoomOut}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20">
                <path
                  d="M5 10h10"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
            <button
              aria-label="확대"
              className="analysis-map__control-button"
              onClick={onZoomIn}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20">
                <path
                  d="M10 5v10M5 10h10"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
            <button
              aria-label="위치 초기화"
              className="analysis-map__control-button"
              onClick={onResetPositions}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20">
                <path
                  d="M5 6.5A5.5 5.5 0 1 1 4.8 13M5 3.8v3.8h3.8"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
            <button
              aria-label="화면에 맞추기"
              className="analysis-map__control-button"
              onClick={onFitBoardToStage}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20">
                <path
                  d="M7 4H4v3M13 4h3v3M4 13v3h3M16 13v3h-3"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="analysis-map__world-anchor">
          <div className="analysis-map__world" style={worldStyle}>
            {boardNodes.map((node) => (
              <button
                className={`analysis-map__node${
                  getNodeClassName?.(node) ? ` ${getNodeClassName(node)}` : ''
                }${selectedNodeId === node.id ? ' analysis-map__node--selected' : ''}${
                  draggingNodeId === node.id ? ' analysis-map__node--dragging' : ''
                }`}
                key={node.id}
                onClick={() => {
                  onNodeClick(node.id);
                }}
                onPointerDown={(event) => {
                  onNodePointerDown(event, node);
                }}
                ref={(element) => {
                  nodeElementByIdRef.current[node.id] = element;
                }}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${node.width}px`,
                  height: `${node.height}px`,
                }}
                type="button"
              >
                {renderNodeContent(node)}
              </button>
            ))}
          </div>
        </div>
        <svg aria-hidden="true" className="analysis-map__links" height="100%" width="100%">
          <defs>
            <marker
              id={markerId}
              markerHeight="8"
              markerUnits="strokeWidth"
              markerWidth="8"
              orient="auto"
              refX="6"
              refY="3"
            >
              <path className="analysis-map__arrowhead" d="M0,0 L0,6 L6,3 z" />
            </marker>
          </defs>
          {measuredLinkPaths.map((path) => (
            <path
              className={`analysis-map__link${linkClassName ? ` ${linkClassName}` : ''}`}
              d={path.path}
              key={path.key}
              markerEnd={`url(#${markerId})`}
            />
          ))}
        </svg>
        {shouldShowLinkLabels
          ? measuredLinkPaths.map((path) => (
              <div
                className={`analysis-map__link-label${
                  linkLabelClassName ? ` ${linkLabelClassName}` : ''
                }`}
                key={`${path.key}-label`}
                style={{
                  left: `${path.midX}px`,
                  top: `${path.midY}px`,
                }}
              >
                {path.label}
              </div>
            ))
          : null}
      </div>
    </section>
  );
}
