import { useEffect, useMemo, useState } from 'react';

import type {
  ProjectAnalysisDocumentId,
  ProjectAnalysisDocumentLayoutMap,
} from '@/domain/project/project-analysis-model';
import type {
  SelectedProjectAnalysisDocumentId,
  StructuredProjectAnalysis,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';
import { DOCUMENT_MAP_VIEWPORT_PRESET } from '@/renderer/features/project-bootstrap/project-bootstrap-page/workspace-map.shared';
import { AnalysisWorkspaceDocumentView } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/AnalysisWorkspaceDocumentView';
import { AnalysisWorkspaceEmptyState } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/AnalysisWorkspaceEmptyState';
import type { AnalysisWorkspaceViewMode } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/analysis-workspace.types';
import {
  EMPTY_ANALYSIS_DOCUMENTS,
  EMPTY_DOCUMENT_LAYOUTS,
  EMPTY_DOCUMENT_LINKS,
  buildAnalysisDocumentBoardNodes,
  buildAnalysisLinkPaths,
  createResolvedDocumentLayoutMap,
  createViewportToFitNodes,
  resolveAnalysisDocumentBoardLinks,
  resolveSelectedDocument,
  toDocumentLayoutMap,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/analysis-workspace.utils';
import { WorkspaceBoardMapView } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/workspace-board-map/WorkspaceBoardMapView';
import { useWorkspaceBoardMap } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/workspace-board-map/use-workspace-board-map';

interface AnalysisWorkspaceProps {
  analysis: StructuredProjectAnalysis | null;
  analysisSessionKey: string;
  isActive: boolean;
  onSaveDocumentLayouts: (documentLayouts: ProjectAnalysisDocumentLayoutMap) => void;
  onSelectDocument: (documentId: ProjectAnalysisDocumentId) => void;
  onViewModeChange: (viewMode: AnalysisWorkspaceViewMode) => void;
  selectedDocumentId: SelectedProjectAnalysisDocumentId;
  viewMode: AnalysisWorkspaceViewMode;
}

export function AnalysisWorkspace(props: AnalysisWorkspaceProps) {
  const {
    analysis,
    analysisSessionKey,
    isActive,
    onSaveDocumentLayouts,
    onSelectDocument,
    onViewModeChange,
    selectedDocumentId,
    viewMode,
  } = props;
  const documents = analysis?.documents ?? EMPTY_ANALYSIS_DOCUMENTS;
  const documentsKey = useMemo(() => documents.map((document) => document.id).join('|'), [documents]);
  const selectedDocument = resolveSelectedDocument(documents, selectedDocumentId);
  const storedDocumentLayouts = analysis?.context.documentLayouts ?? EMPTY_DOCUMENT_LAYOUTS;
  const storedDocumentLayoutsKey = useMemo(
    () =>
      documents
        .map((document) => {
          const layout = storedDocumentLayouts[document.id];
          return `${document.id}:${layout?.x ?? 'default'}:${layout?.y ?? 'default'}`;
        })
        .join('|'),
    [documents, storedDocumentLayouts],
  );
  const storedDocumentLinks = analysis?.context.documentLinks ?? EMPTY_DOCUMENT_LINKS;
  const [documentLayoutsOverride, setDocumentLayoutsOverride] =
    useState<ProjectAnalysisDocumentLayoutMap | null>(null);
  const effectiveDocumentLayouts = documentLayoutsOverride ?? storedDocumentLayouts;
  const baseBoardPositions = useMemo(
    () => createResolvedDocumentLayoutMap(documents, effectiveDocumentLayouts),
    [documents, effectiveDocumentLayouts],
  );
  const boardLinks = useMemo(
    () => resolveAnalysisDocumentBoardLinks(storedDocumentLinks),
    [storedDocumentLinks],
  );
  const baseBoardNodes = useMemo(
    () => buildAnalysisDocumentBoardNodes(documents, baseBoardPositions),
    [baseBoardPositions, documents],
  );
  const boardMap = useWorkspaceBoardMap({
    baseBoardNodes,
    createViewportToFitNodes,
    isActive: isActive && Boolean(analysis),
    isMapVisible: viewMode === 'map',
    maxScale: DOCUMENT_MAP_VIEWPORT_PRESET.maxScale,
    minScale: DOCUMENT_MAP_VIEWPORT_PRESET.minScale,
    onNodeDragEnd: (nextBoardNodes) => {
      onSaveDocumentLayouts(toDocumentLayoutMap(nextBoardNodes, documents));
    },
    onNodeOpen: (nodeId) => {
      onSelectDocument(nodeId);
      onViewModeChange('document');
    },
    onReset: () => {
      onViewModeChange('map');
    },
    resetKey: `${analysisSessionKey}#${documentsKey}`,
  });

  useEffect(() => {
    setDocumentLayoutsOverride(null);
  }, [storedDocumentLayoutsKey]);

  useEffect(() => {
    if (viewMode !== 'document') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      onViewModeChange('map');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onViewModeChange, viewMode]);

  const linkPaths = useMemo(
    () => buildAnalysisLinkPaths(boardMap.boardNodes, boardLinks, boardMap.stageSize, boardMap.viewport),
    [boardLinks, boardMap.boardNodes, boardMap.stageSize, boardMap.viewport],
  );

  const handleResetPositions = () => {
    setDocumentLayoutsOverride(EMPTY_DOCUMENT_LAYOUTS);
    boardMap.resetBoardPositions();
    onSaveDocumentLayouts(EMPTY_DOCUMENT_LAYOUTS);
  };

  return (
    <section className="analysis-workspace analysis-workspace--board">
      {!analysis ? (
        <AnalysisWorkspaceEmptyState />
      ) : viewMode === 'document' && selectedDocument ? (
        <AnalysisWorkspaceDocumentView
          onReturnToMap={() => {
            onViewModeChange('map');
          }}
          selectedDocument={selectedDocument}
        />
      ) : (
        <WorkspaceBoardMapView
          boardNodes={boardMap.boardNodes}
          draggingNodeId={boardMap.draggingNodeId}
          isPanning={boardMap.isPanning}
          linkPaths={linkPaths}
          markerId="analysis-map-arrowhead"
          onFitBoardToStage={boardMap.fitBoardToStage}
          onNodeClick={boardMap.handleNodeClick}
          onNodePointerDown={boardMap.handleNodePointerDown}
          onResetPositions={handleResetPositions}
          onStagePointerDown={boardMap.handleStagePointerDown}
          onStageWheel={boardMap.handleStageWheel}
          onZoomIn={boardMap.zoomIn}
          onZoomOut={boardMap.zoomOut}
          renderNodeContent={(node) => (
            <>
              <span className="analysis-map__node-file">{node.fileName}</span>
              <strong className="analysis-map__node-title">{node.title}</strong>
              <span className="analysis-map__node-summary">{node.summary}</span>
            </>
          )}
          selectedNodeId={selectedDocument?.id ?? null}
          stageGridStyle={boardMap.stageGridStyle}
          stageRef={boardMap.stageRef}
          viewportScale={boardMap.viewport.scale}
          worldStyle={boardMap.worldStyle}
        />
      )}
    </section>
  );
}
