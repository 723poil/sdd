import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject, WheelEvent } from 'react';

import type { ProjectAnalysisDocumentId } from '@/domain/project/project-analysis-model';
import type {
  AnalysisDocumentBoardNode,
  AnalysisRenderedLink,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/analysis-workspace.types';

interface AnalysisWorkspaceMapViewProps {
  boardNodes: AnalysisDocumentBoardNode[];
  draggingNodeId: ProjectAnalysisDocumentId | null;
  isPanning: boolean;
  linkPaths: AnalysisRenderedLink[];
  onFitBoardToStage: () => void;
  onNodeClick: (nodeId: ProjectAnalysisDocumentId) => void;
  onNodePointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    node: AnalysisDocumentBoardNode,
  ) => void;
  onStagePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onStageWheel: (event: WheelEvent<HTMLDivElement>) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  selectedDocumentId: ProjectAnalysisDocumentId | null;
  stageGridStyle: Record<string, string>;
  stageRef: RefObject<HTMLDivElement | null>;
  viewportScale: number;
  worldStyle: CSSProperties;
}

export function AnalysisWorkspaceMapView(props: AnalysisWorkspaceMapViewProps) {
  const {
    boardNodes,
    draggingNodeId,
    isPanning,
    linkPaths,
    onFitBoardToStage,
    onNodeClick,
    onNodePointerDown,
    onStagePointerDown,
    onStageWheel,
    onZoomIn,
    onZoomOut,
    selectedDocumentId,
    stageGridStyle,
    stageRef,
    viewportScale,
    worldStyle,
  } = props;

  return (
    <section className="analysis-map">
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

        <svg
          aria-hidden="true"
          className="analysis-map__links"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <marker
              id="analysis-map-arrowhead"
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
          {linkPaths.map((path) => (
            <path
              className="analysis-map__link"
              d={path.path}
              key={path.key}
              markerEnd="url(#analysis-map-arrowhead)"
            />
          ))}
        </svg>

        {linkPaths.map((path) => (
          <div
            className="analysis-map__link-label"
            key={`${path.key}-label`}
            style={{
              left: `${path.midX}px`,
              top: `${path.midY}px`,
            }}
          >
            {path.label}
          </div>
        ))}

        <div className="analysis-map__world-anchor">
          <div className="analysis-map__world" style={worldStyle}>
            {boardNodes.map((node) => (
              <button
                className={`analysis-map__node ${
                  selectedDocumentId === node.id ? 'analysis-map__node--selected' : ''
                } ${draggingNodeId === node.id ? 'analysis-map__node--dragging' : ''}`}
                key={node.id}
                onClick={() => {
                  onNodeClick(node.id);
                }}
                onPointerDown={(event) => {
                  onNodePointerDown(event, node);
                }}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${node.width}px`,
                  height: `${node.height}px`,
                }}
                type="button"
              >
                <span className="analysis-map__node-file">{node.fileName}</span>
                <strong className="analysis-map__node-title">{node.title}</strong>
                <span className="analysis-map__node-summary">{node.summary}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
