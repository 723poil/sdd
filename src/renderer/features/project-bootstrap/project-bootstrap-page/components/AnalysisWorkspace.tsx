import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ProjectAnalysisDocumentId,
  ProjectAnalysisDocumentLayoutMap,
} from '@/domain/project/project-analysis-model';
import type {
  SelectedProjectAnalysisDocumentId,
  StructuredProjectAnalysis,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';
import {
  DOCUMENT_MAP_VIEWPORT_PRESET,
  clamp,
  getWorkspaceMapNodeFontScale,
  getWorkspaceMapNodeSpacingScale,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/workspace-map.shared';
import { AnalysisWorkspaceDocumentView } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/AnalysisWorkspaceDocumentView';
import { AnalysisWorkspaceEmptyState } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/AnalysisWorkspaceEmptyState';
import { AnalysisWorkspaceMapView } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/AnalysisWorkspaceMapView';
import type {
  AnalysisInteractionState,
  AnalysisStageSize,
  AnalysisViewport,
  AnalysisWorkspaceViewMode,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/analysis-workspace.types';
import {
  EMPTY_ANALYSIS_DOCUMENTS,
  EMPTY_DOCUMENT_LAYOUTS,
  EMPTY_DOCUMENT_LINKS,
  EMPTY_STAGE_SIZE,
  INITIAL_VIEWPORT,
  buildAnalysisDocumentBoardNodes,
  buildAnalysisFileReferenceCards,
  buildAnalysisLinkPaths,
  createResolvedDocumentLayoutMap,
  createStageGridStyle,
  createViewportToFitNodes,
  mergeDocumentLayoutMaps,
  resolveAnalysisDocumentBoardLinks,
  resolveSelectedDocument,
  toDocumentLayoutMap,
  toWorldPoint,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/analysis-workspace.utils';

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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<AnalysisInteractionState | null>(null);
  const ignoreClickNodeIdRef = useRef<ProjectAnalysisDocumentId | null>(null);
  const boardPositionsRef = useRef<ProjectAnalysisDocumentLayoutMap>({});
  const hasAdjustedViewportRef = useRef(false);
  const [draggingNodeId, setDraggingNodeId] = useState<ProjectAnalysisDocumentId | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [stageSize, setStageSize] = useState<AnalysisStageSize>(EMPTY_STAGE_SIZE);
  const [viewport, setViewport] = useState<AnalysisViewport>(INITIAL_VIEWPORT);
  const [draftBoardPositions, setDraftBoardPositions] = useState<ProjectAnalysisDocumentLayoutMap>(
    {},
  );
  const storedDocumentLayouts = analysis?.context.documentLayouts ?? EMPTY_DOCUMENT_LAYOUTS;
  const storedDocumentLinks = analysis?.context.documentLinks ?? EMPTY_DOCUMENT_LINKS;
  const baseBoardPositions = useMemo(
    () => createResolvedDocumentLayoutMap(documents, storedDocumentLayouts),
    [documents, storedDocumentLayouts],
  );
  const boardLinks = useMemo(
    () => resolveAnalysisDocumentBoardLinks(storedDocumentLinks),
    [storedDocumentLinks],
  );
  const fileReferenceCards = useMemo(
    () => buildAnalysisFileReferenceCards(analysis),
    [analysis],
  );
  const totalFileReferenceCount = useMemo(
    () => fileReferenceCards.reduce((count, entry) => count + (entry.references?.length ?? 0), 0),
    [fileReferenceCards],
  );
  const boardPositions = useMemo(
    () =>
      mergeDocumentLayoutMaps({
        baseLayouts: baseBoardPositions,
        overrideLayouts: draftBoardPositions,
      }),
    [baseBoardPositions, draftBoardPositions],
  );

  const returnToMap = () => {
    onViewModeChange('map');
  };

  useEffect(() => {
    boardPositionsRef.current = boardPositions;
  }, [boardPositions]);

  useEffect(() => {
    hasAdjustedViewportRef.current = false;
    setViewport(INITIAL_VIEWPORT);
    setDraftBoardPositions({});
    if (viewMode !== 'map') {
      onViewModeChange('map');
    }
  }, [analysisSessionKey, documentsKey, onViewModeChange, viewMode]);

  useEffect(() => {
    if (!isActive || viewMode !== 'map' || !analysis) {
      return;
    }

    const stageElement = stageRef.current;
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
  }, [analysis, isActive, viewMode]);

  const boardNodes = useMemo(
    () => buildAnalysisDocumentBoardNodes(documents, boardPositions),
    [boardPositions, documents],
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

  useEffect(() => {
    if (
      !isActive ||
      viewMode !== 'map' ||
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
  }, [boardNodes, isActive, stageSize, viewMode]);

  useEffect(() => {
    if (viewMode !== 'map') {
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
        setViewport({
          ...viewport,
          offsetX: interaction.startOffsetX + deltaX,
          offsetY: interaction.startOffsetY + deltaY,
        });
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
      if (interaction?.kind === 'node' && interaction.moved) {
        ignoreClickNodeIdRef.current = interaction.nodeId;
        onSaveDocumentLayouts(toDocumentLayoutMap(boardPositionsRef.current, documents));
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
  }, [documents, onSaveDocumentLayouts, viewMode, viewport]);

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
    () => buildAnalysisLinkPaths(boardNodes, boardLinks, stageSize, viewport),
    [boardLinks, boardNodes, stageSize, viewport],
  );

  const fitBoardToStage = () => {
    if (boardNodes.length === 0 || stageSize.width === 0 || stageSize.height === 0) {
      return;
    }

    hasAdjustedViewportRef.current = true;
    setViewport(createViewportToFitNodes(boardNodes, stageSize));
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
      const nextScale = clamp(
        current.scale * scaleDelta,
        DOCUMENT_MAP_VIEWPORT_PRESET.minScale,
        DOCUMENT_MAP_VIEWPORT_PRESET.maxScale,
      );
      const worldX = (anchorX - stageRect.width / 2 - current.offsetX) / current.scale;
      const worldY = (anchorY - stageRect.height / 2 - current.offsetY) / current.scale;

      return {
        scale: nextScale,
        offsetX: anchorX - stageRect.width / 2 - worldX * nextScale,
        offsetY: anchorY - stageRect.height / 2 - worldY * nextScale,
      };
    });
  };

  const handleStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
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

  const handleStageWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const stageElement = stageRef.current;
    if (!stageElement) {
      return;
    }

    const stageRect = stageElement.getBoundingClientRect();
    const stageX = event.clientX - stageRect.left;
    const stageY = event.clientY - stageRect.top;
    const nextScale = clamp(
      viewport.scale * Math.exp(-event.deltaY * 0.0016),
      DOCUMENT_MAP_VIEWPORT_PRESET.minScale,
      DOCUMENT_MAP_VIEWPORT_PRESET.maxScale,
    );
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

  const handleNodeClick = (nodeId: ProjectAnalysisDocumentId) => {
    if (ignoreClickNodeIdRef.current === nodeId) {
      ignoreClickNodeIdRef.current = null;
      return;
    }

    onSelectDocument(nodeId);
    onViewModeChange('document');
  };

  const handleNodePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    node: {
      id: ProjectAnalysisDocumentId;
      x: number;
      y: number;
    },
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
    };
    setDraggingNodeId(node.id);
  };

  return (
    <section className="analysis-workspace analysis-workspace--board">
      {!analysis ? (
        <AnalysisWorkspaceEmptyState />
      ) : viewMode === 'document' && selectedDocument ? (
        <AnalysisWorkspaceDocumentView
          fileReferenceCards={fileReferenceCards}
          onReturnToMap={returnToMap}
          selectedDocument={selectedDocument}
          totalFileReferenceCount={totalFileReferenceCount}
        />
      ) : (
        <AnalysisWorkspaceMapView
          boardNodes={boardNodes}
          draggingNodeId={draggingNodeId}
          isPanning={isPanning}
          linkPaths={linkPaths}
          onFitBoardToStage={fitBoardToStage}
          onNodeClick={handleNodeClick}
          onNodePointerDown={handleNodePointerDown}
          onStagePointerDown={handleStagePointerDown}
          onStageWheel={handleStageWheel}
          onZoomIn={() => {
            applyScaleFromButton(1.16);
          }}
          onZoomOut={() => {
            applyScaleFromButton(1 / 1.16);
          }}
          selectedDocumentId={selectedDocument?.id ?? null}
          stageGridStyle={createStageGridStyle(viewport)}
          stageRef={stageRef}
          viewportScale={viewport.scale}
          worldStyle={worldStyle}
        />
      )}
    </section>
  );
}
