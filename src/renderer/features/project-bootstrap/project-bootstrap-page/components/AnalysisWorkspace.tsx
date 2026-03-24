import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ProjectAnalysisDocumentId,
  ProjectAnalysisDocumentLayoutMap,
  ProjectAnalysisFileIndexEntry,
  ProjectAnalysisDocumentLink,
} from '@/domain/project/project-analysis-model';
import { MarkdownDocument } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/MarkdownDocument';
import type {
  ProjectAnalysisDocument,
  SelectedProjectAnalysisDocumentId,
  StructuredProjectAnalysis,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

interface AnalysisWorkspaceProps {
  analysis: StructuredProjectAnalysis | null;
  analysisSessionKey: string;
  selectedDocumentId: SelectedProjectAnalysisDocumentId;
  onViewModeChange?: (viewMode: 'map' | 'document') => void;
  onSelectDocument: (documentId: ProjectAnalysisDocumentId) => void;
  onSaveDocumentLayouts: (documentLayouts: ProjectAnalysisDocumentLayoutMap) => void;
}

interface AnalysisDocumentBoardLayout {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface AnalysisDocumentBoardNode extends AnalysisDocumentBoardLayout {
  fileName: string;
  id: ProjectAnalysisDocumentId;
  summary: string;
  title: string;
}

interface AnalysisDocumentBoardLink {
  from: ProjectAnalysisDocumentId;
  label: string;
  to: ProjectAnalysisDocumentId;
}

interface AnalysisViewport {
  offsetX: number;
  offsetY: number;
  scale: number;
}

interface AnalysisStageSize {
  height: number;
  width: number;
}

interface AnalysisRenderedLink {
  key: string;
  label: string;
  midX: number;
  midY: number;
  path: string;
}

interface AnalysisFileReferenceCard {
  category: string;
  incomingCount: number;
  layer: string | null;
  path: string;
  references: ProjectAnalysisFileIndexEntry['references'];
  role: string;
  summary: string;
}

type AnalysisInteractionState =
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
      nodeId: ProjectAnalysisDocumentId;
      pointerOffsetX: number;
      pointerOffsetY: number;
    };

const EMPTY_ANALYSIS_DOCUMENTS: ProjectAnalysisDocument[] = [];
const EMPTY_DOCUMENT_LAYOUTS: ProjectAnalysisDocumentLayoutMap = {};
const EMPTY_DOCUMENT_LINKS: ProjectAnalysisDocumentLink[] = [];
const EMPTY_STAGE_SIZE: AnalysisStageSize = {
  width: 0,
  height: 0,
};
const INITIAL_VIEWPORT: AnalysisViewport = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

const GRID_SIZE = 40;
const MAX_SCALE = 2.8;
const MIN_SCALE = 0.35;
const FIT_MIN_SCALE = 0.68;

const ANALYSIS_BOARD_LAYOUT: Record<ProjectAnalysisDocumentId, AnalysisDocumentBoardLayout> = {
  overview: { x: -820, y: -60, width: 620, height: 340 },
  purpose: { x: -20, y: -460, width: 640, height: 360 },
  structure: { x: -20, y: 260, width: 640, height: 360 },
  layers: { x: 760, y: -460, width: 600, height: 360 },
  connectivity: { x: 760, y: 260, width: 600, height: 360 },
};

const DEFAULT_ANALYSIS_BOARD_LINKS: AnalysisDocumentBoardLink[] = [
  { from: 'overview', label: '목적', to: 'purpose' },
  { from: 'overview', label: '구조', to: 'structure' },
  { from: 'purpose', label: '책임', to: 'layers' },
  { from: 'structure', label: '흐름', to: 'connectivity' },
  { from: 'purpose', label: '참조', to: 'connectivity' },
];

export function AnalysisWorkspace(props: AnalysisWorkspaceProps) {
  const {
    analysis,
    analysisSessionKey,
    selectedDocumentId,
    onViewModeChange,
    onSelectDocument,
    onSaveDocumentLayouts,
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
  const [viewMode, setViewMode] = useState<'map' | 'document'>('map');
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
    setViewMode('map');
  };

  useEffect(() => {
    boardPositionsRef.current = boardPositions;
  }, [boardPositions]);

  useEffect(() => {
    hasAdjustedViewportRef.current = false;
    setViewport(INITIAL_VIEWPORT);
    setViewMode('map');
    setDraftBoardPositions({});
  }, [analysisSessionKey, documentsKey]);

  useEffect(() => {
    onViewModeChange?.(viewMode);
  }, [onViewModeChange, viewMode]);

  useEffect(() => {
    if (viewMode !== 'map') {
      return;
    }

    const stageElement = stageRef.current;
    if (!stageElement) {
      return;
    }

    const stageRect = stageElement.getBoundingClientRect();
    setStageSize({
      width: stageRect.width,
      height: stageRect.height,
    });

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setStageSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    resizeObserver.observe(stageElement);
    return () => {
      resizeObserver.disconnect();
    };
  }, [viewMode]);

  const boardNodes = useMemo(
    () => buildAnalysisDocumentBoardNodes(documents, boardPositions),
    [boardPositions, documents],
  );
  const worldStyle = useMemo<CSSProperties>(
    () => ({
      transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
      ['--analysis-map-node-font-scale' as string]: getAnalysisMapNodeFontScale(viewport.scale),
      ['--analysis-map-node-spacing-scale' as string]: getAnalysisMapNodeSpacingScale(viewport.scale),
    }),
    [viewport.offsetX, viewport.offsetY, viewport.scale],
  );

  useEffect(() => {
    if (viewMode !== 'map' || boardNodes.length === 0 || stageSize.width === 0 || stageSize.height === 0) {
      return;
    }

    if (hasAdjustedViewportRef.current) {
      return;
    }

    setViewport(createViewportToFitNodes(boardNodes, stageSize));
    hasAdjustedViewportRef.current = true;
  }, [boardNodes, stageSize, viewMode]);

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

      returnToMap();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewMode]);

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
      const nextScale = clamp(current.scale * scaleDelta, MIN_SCALE, MAX_SCALE);
      const worldX = (anchorX - stageRect.width / 2 - current.offsetX) / current.scale;
      const worldY = (anchorY - stageRect.height / 2 - current.offsetY) / current.scale;

      return {
        scale: nextScale,
        offsetX: anchorX - stageRect.width / 2 - worldX * nextScale,
        offsetY: anchorY - stageRect.height / 2 - worldY * nextScale,
      };
    });
  };

  return (
    <section className="analysis-workspace analysis-workspace--board">
      {!analysis ? (
        <section className="analysis-empty-panel">
          <div className="analysis-empty-panel__card">
            <span className="analysis-empty-panel__eyebrow">분석 준비</span>
            <h3 className="analysis-empty-panel__title">문서 맵이 아직 없습니다.</h3>
            <p className="analysis-empty-panel__description">
              에이전트 분석을 실행하면 문서 카드와 연결 관계를 이곳에서 바로 볼 수 있습니다.
            </p>
          </div>
        </section>
      ) : viewMode === 'document' && selectedDocument ? (
        <article className="analysis-document-page">
          <div className="analysis-document-page__toolbar">
            <button
              className="secondary-button analysis-document-page__return"
              onClick={returnToMap}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20">
                <path
                  d="M11.5 4.5 6 10l5.5 5.5M7 10h7"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
              <span>맵으로 돌아가기</span>
            </button>
            <div className="analysis-document-page__toolbar-meta">
              <span className="analysis-document-panel__id">
                {getAnalysisDocumentFileName(selectedDocument.id)}
              </span>
              <span className="analysis-document-page__toolbar-hint">Esc</span>
            </div>
          </div>
          <div className="analysis-document-page__header">
            <div>
              <h4>{selectedDocument.title}</h4>
            </div>
          </div>
          <div className="analysis-document-page__body">
            <div className="analysis-document-page__scroll">
              <p className="analysis-document-panel__summary">{selectedDocument.summary}</p>
              <div className="analysis-document-markdown">
                <MarkdownDocument markdown={selectedDocument.markdown} />
              </div>
              <section className="analysis-document-page__references">
                <div className="analysis-document-page__references-header">
                  <div>
                    <h5>핵심 파일 참조</h5>
                    <p>에이전트가 정리한 중요한 파일 간 참조 관계입니다.</p>
                  </div>
                  <div className="analysis-document-page__reference-stats">
                    <span className="analysis-document-page__reference-stat">
                      파일 {fileReferenceCards.length}개
                    </span>
                    <span className="analysis-document-page__reference-stat">
                      참조선 {totalFileReferenceCount}개
                    </span>
                  </div>
                </div>

                {fileReferenceCards.length > 0 ? (
                  <div className="analysis-document-page__references-grid">
                    {fileReferenceCards.map((entry) => (
                      <article
                        className="analysis-document-page__reference-card"
                        key={entry.path}
                      >
                        <div className="analysis-document-page__reference-card-header">
                          <div>
                            <strong className="analysis-document-page__reference-path">
                              {entry.path}
                            </strong>
                            <p className="analysis-document-page__reference-summary">{entry.summary}</p>
                          </div>
                          <div className="analysis-document-page__reference-metrics">
                            <span className="analysis-document-page__reference-metric">
                              {entry.role}
                            </span>
                            {entry.layer ? (
                              <span className="analysis-document-page__reference-metric">
                                {entry.layer}
                              </span>
                            ) : null}
                            <span className="analysis-document-page__reference-metric">
                              {entry.category}
                            </span>
                            <span className="analysis-document-page__reference-metric">
                              참조됨 {entry.incomingCount}회
                            </span>
                          </div>
                        </div>

                        {entry.references && entry.references.length > 0 ? (
                          <ul className="analysis-document-page__reference-list">
                            {entry.references.map((reference) => (
                              <li key={`${entry.path}-${reference.path}-${reference.relationship}`}>
                                <div className="analysis-document-page__reference-list-row">
                                  <span className="analysis-document-page__reference-target">
                                    {reference.path}
                                  </span>
                                  <span className="analysis-document-page__reference-meta">
                                    {reference.relationship}
                                  </span>
                                </div>
                                <p className="analysis-document-page__reference-reason">
                                  {reference.reason}
                                </p>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="analysis-document-page__reference-empty">
                            직접 연결된 핵심 파일 참조가 없습니다.
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="analysis-document-page__reference-empty">
                    에이전트가 아직 파일 참조 구조를 반환하지 않았습니다.
                  </p>
                )}
              </section>
            </div>
          </div>
        </article>
      ) : (
        <section className="analysis-map">
          <div
            className={`analysis-map__stage ${isPanning ? 'analysis-map__stage--panning' : ''}`}
            onPointerDown={(event) => {
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
            }}
            onWheel={(event) => {
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
                MIN_SCALE,
                MAX_SCALE,
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
            }}
            ref={stageRef}
            style={createStageGridStyle(viewport)}
          >
            <div
              className="analysis-map__hud"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
            >
              <div className="analysis-map__zoom-badge">{Math.round(viewport.scale * 100)}%</div>
              <div className="analysis-map__zoom-controls">
                <button
                  aria-label="축소"
                  className="analysis-map__control-button"
                  onClick={() => {
                    applyScaleFromButton(1 / 1.16);
                  }}
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
                  onClick={() => {
                    applyScaleFromButton(1.16);
                  }}
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
                  onClick={fitBoardToStage}
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

            <svg aria-hidden="true" className="analysis-map__links" viewBox={`0 0 ${stageSize.width} ${stageSize.height}`}>
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
                      selectedDocument?.id === node.id ? 'analysis-map__node--selected' : ''
                    } ${draggingNodeId === node.id ? 'analysis-map__node--dragging' : ''}`}
                    key={node.id}
                    onClick={() => {
                      if (ignoreClickNodeIdRef.current === node.id) {
                        ignoreClickNodeIdRef.current = null;
                        return;
                      }

                      onSelectDocument(node.id);
                      setViewMode('document');
                    }}
                    onPointerDown={(event) => {
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
      )}
    </section>
  );
}

function buildAnalysisDocumentBoardNodes(
  documents: ProjectAnalysisDocument[],
  boardPositions: ProjectAnalysisDocumentLayoutMap,
): AnalysisDocumentBoardNode[] {
  return documents.map((document) => {
    const layout = ANALYSIS_BOARD_LAYOUT[document.id];
    const position = boardPositions[document.id] ?? { x: layout.x, y: layout.y };

    return {
      ...layout,
      x: position.x,
      y: position.y,
      id: document.id,
      title: document.title,
      summary: document.summary,
      fileName: getAnalysisDocumentFileName(document.id),
    };
  });
}

function createResolvedDocumentLayoutMap(
  documents: ProjectAnalysisDocument[],
  storedLayouts: ProjectAnalysisDocumentLayoutMap,
): ProjectAnalysisDocumentLayoutMap {
  const next: ProjectAnalysisDocumentLayoutMap = {};

  for (const document of documents) {
    const layout = ANALYSIS_BOARD_LAYOUT[document.id];
    next[document.id] = storedLayouts[document.id] ?? {
      x: layout.x,
      y: layout.y,
    };
  }

  return next;
}

function mergeDocumentLayoutMaps(input: {
  baseLayouts: ProjectAnalysisDocumentLayoutMap;
  overrideLayouts: ProjectAnalysisDocumentLayoutMap;
}): ProjectAnalysisDocumentLayoutMap {
  const next: ProjectAnalysisDocumentLayoutMap = {
    ...input.baseLayouts,
  };

  for (const [documentId, layout] of Object.entries(input.overrideLayouts)) {
    if (!layout) {
      continue;
    }

    next[documentId as ProjectAnalysisDocumentId] = layout;
  }

  return next;
}

function toDocumentLayoutMap(
  boardPositions: ProjectAnalysisDocumentLayoutMap,
  documents: ProjectAnalysisDocument[],
): ProjectAnalysisDocumentLayoutMap {
  const next: ProjectAnalysisDocumentLayoutMap = {};

  for (const document of documents) {
    const position = boardPositions[document.id];
    if (!position) {
      continue;
    }

    next[document.id] = {
      x: position.x,
      y: position.y,
    };
  }

  return next;
}

function buildAnalysisLinkPaths(
  nodes: AnalysisDocumentBoardNode[],
  links: AnalysisDocumentBoardLink[],
  stageSize: AnalysisStageSize,
  viewport: AnalysisViewport,
): AnalysisRenderedLink[] {
  return links.flatMap((link) => {
    const from = nodes.find((node) => node.id === link.from);
    const to = nodes.find((node) => node.id === link.to);
    if (!from || !to || stageSize.width === 0 || stageSize.height === 0) {
      return [];
    }

    const start = toScreenPoint({
      stageSize,
      viewport,
      x: from.x + from.width,
      y: from.y + from.height / 2,
    });
    const end = toScreenPoint({
      stageSize,
      viewport,
      x: to.x,
      y: to.y + to.height / 2,
    });
    const controlOffset = Math.max((end.x - start.x) * 0.48, 90);
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    return [
      {
        key: `${link.from}-${link.to}`,
        label: link.label,
        midX,
        midY,
        path: `M ${start.x} ${start.y} C ${start.x + controlOffset} ${start.y}, ${end.x - controlOffset} ${end.y}, ${end.x} ${end.y}`,
      },
    ];
  });
}

function resolveAnalysisDocumentBoardLinks(
  storedDocumentLinks: ProjectAnalysisDocumentLink[],
): AnalysisDocumentBoardLink[] {
  if (storedDocumentLinks.length === 0) {
    return DEFAULT_ANALYSIS_BOARD_LINKS;
  }

  return storedDocumentLinks.map((documentLink) => ({
    from: documentLink.from,
    to: documentLink.to,
    label: documentLink.label,
  }));
}

function buildAnalysisFileReferenceCards(
  analysis: StructuredProjectAnalysis | null,
): AnalysisFileReferenceCard[] {
  if (!analysis) {
    return [];
  }

  const incomingCounts = new Map<string, number>();

  for (const fileReference of analysis.context.fileReferences) {
    incomingCounts.set(fileReference.to, (incomingCounts.get(fileReference.to) ?? 0) + 1);
  }

  return [...analysis.fileIndex]
    .map((entry) => ({
      category: entry.category,
      incomingCount: incomingCounts.get(entry.path) ?? 0,
      layer: entry.layer,
      path: entry.path,
      references: entry.references ?? [],
      role: entry.role,
      summary: entry.summary,
    }))
    .sort((left, right) => {
      const rightOutgoingCount = right.references?.length ?? 0;
      const leftOutgoingCount = left.references?.length ?? 0;

      if (rightOutgoingCount !== leftOutgoingCount) {
        return rightOutgoingCount - leftOutgoingCount;
      }

      if (right.incomingCount !== left.incomingCount) {
        return right.incomingCount - left.incomingCount;
      }

      return left.path.localeCompare(right.path);
    });
}

function createViewportToFitNodes(
  nodes: AnalysisDocumentBoardNode[],
  stageSize: AnalysisStageSize,
): AnalysisViewport {
  const bounds = getNodeBounds(nodes);
  const availableWidth = Math.max(stageSize.width - 48, 1);
  const availableHeight = Math.max(stageSize.height - 48, 1);
  const scale = clamp(
    Math.min(availableWidth / bounds.width, availableHeight / bounds.height),
    FIT_MIN_SCALE,
    1.12,
  );

  return {
    scale,
    offsetX: -(bounds.minX + bounds.width / 2) * scale,
    offsetY: -(bounds.minY + bounds.height / 2) * scale,
  };
}

function createStageGridStyle(viewport: AnalysisViewport): Record<string, string> {
  const gridSize = GRID_SIZE * viewport.scale;

  return {
    backgroundPosition: `calc(50% + ${viewport.offsetX}px) calc(50% + ${viewport.offsetY}px)`,
    backgroundSize: `${gridSize}px ${gridSize}px`,
  };
}

function getNodeBounds(nodes: AnalysisDocumentBoardNode[]): {
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

function getAnalysisDocumentFileName(documentId: ProjectAnalysisDocumentId): string {
  switch (documentId) {
    case 'overview':
      return 'summary.md';
    case 'purpose':
      return 'purpose.md';
    case 'structure':
      return 'structure.md';
    case 'layers':
      return 'layers.md';
    case 'connectivity':
      return 'connectivity.md';
  }
}

function resolveSelectedDocument(
  documents: ProjectAnalysisDocument[],
  selectedDocumentId: SelectedProjectAnalysisDocumentId,
): ProjectAnalysisDocument | null {
  if (documents.length === 0) {
    return null;
  }

  return documents.find((document) => document.id === selectedDocumentId) ?? documents[0] ?? null;
}

function toScreenPoint(input: {
  stageSize: AnalysisStageSize;
  viewport: AnalysisViewport;
  x: number;
  y: number;
}): { x: number; y: number } {
  return {
    x: input.stageSize.width / 2 + input.viewport.offsetX + input.x * input.viewport.scale,
    y: input.stageSize.height / 2 + input.viewport.offsetY + input.y * input.viewport.scale,
  };
}

function toWorldPoint(input: {
  clientX: number;
  clientY: number;
  stageElement: HTMLDivElement;
  viewport: AnalysisViewport;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getAnalysisMapNodeFontScale(viewportScale: number): number {
  return clamp(0.9 / viewportScale, 1, 1.42);
}

function getAnalysisMapNodeSpacingScale(viewportScale: number): number {
  return clamp(0.82 / viewportScale, 1, 1.22);
}
