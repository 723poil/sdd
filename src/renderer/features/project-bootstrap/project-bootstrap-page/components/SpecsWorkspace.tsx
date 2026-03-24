import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';

import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
import {
  DOCUMENT_MAP_VIEWPORT_PRESET,
  SPECS_BOARD_LAYOUT_PRESET,
  WORKSPACE_MAP_GRID_SIZE,
  clamp,
  getWorkspaceMapFitScale,
  getWorkspaceMapNodeFontScale,
  getWorkspaceMapNodeSpacingScale,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/workspace-map.shared';

interface SpecsWorkspaceProps {
  isActive: boolean;
  selectedSpecId: string | null;
  specs: ProjectSpecDocument[];
  onSelectSpec: (specId: string) => void;
}

interface SpecBoardNode {
  height: number;
  id: string;
  slug: string;
  status: string;
  summary: string;
  title: string;
  updatedAtLabel: string;
  version: string;
  width: number;
  x: number;
  y: number;
}

interface SpecsViewport {
  offsetX: number;
  offsetY: number;
  scale: number;
}

interface SpecsStageSize {
  height: number;
  width: number;
}

interface SpecsPanState {
  moved: boolean;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
}

const EMPTY_STAGE_SIZE: SpecsStageSize = {
  width: 0,
  height: 0,
};

const INITIAL_VIEWPORT: SpecsViewport = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

export function SpecsWorkspace(props: SpecsWorkspaceProps) {
  const selectedSpec = resolveSelectedSpec(props.specs, props.selectedSpecId);
  const specsKey = useMemo(() => props.specs.map((spec) => spec.meta.id).join('|'), [props.specs]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hasAdjustedViewportRef = useRef(false);
  const interactionRef = useRef<SpecsPanState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [stageSize, setStageSize] = useState<SpecsStageSize>(EMPTY_STAGE_SIZE);
  const [viewport, setViewport] = useState<SpecsViewport>(INITIAL_VIEWPORT);
  const boardNodes = useMemo(() => buildSpecBoardNodes(props.specs), [props.specs]);
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
    hasAdjustedViewportRef.current = false;
    setViewport(INITIAL_VIEWPORT);
  }, [specsKey]);

  useEffect(() => {
    if (!props.isActive || props.specs.length === 0) {
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
  }, [props.isActive, props.specs.length]);

  useEffect(() => {
    if (!props.isActive || boardNodes.length === 0 || stageSize.width === 0 || stageSize.height === 0) {
      return;
    }

    if (hasAdjustedViewportRef.current) {
      return;
    }

    setViewport(createViewportToFitNodes(boardNodes, stageSize));
    hasAdjustedViewportRef.current = true;
  }, [boardNodes, props.isActive, stageSize]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction) {
        return;
      }

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
    };

    const handlePointerUp = () => {
      interactionRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

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

  if (props.specs.length === 0) {
    return (
      <section className="analysis-workspace analysis-workspace--board specs-workspace specs-workspace--board">
        <section className="analysis-empty-panel">
          <div className="analysis-empty-panel__card">
            <span className="analysis-empty-panel__eyebrow">명세</span>
            <h3 className="analysis-empty-panel__title">명세 카드가 아직 없습니다.</h3>
            <p className="analysis-empty-panel__description">
              오른쪽 채팅에서 새 명세를 시작하면 이 보드에 카드가 추가됩니다.
            </p>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="analysis-workspace analysis-workspace--board specs-workspace specs-workspace--board">
      <section className="analysis-map specs-map">
        <div
          className={`analysis-map__stage ${isPanning ? 'analysis-map__stage--panning' : ''}`}
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }

            interactionRef.current = {
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

          <div className="analysis-map__world-anchor">
            <div className="analysis-map__world" style={worldStyle}>
              {boardNodes.map((node) => (
                <button
                  className={`analysis-map__node specs-map__node ${
                    selectedSpec?.meta.id === node.id ? 'analysis-map__node--selected' : ''
                  }`}
                  key={node.id}
                  onClick={() => {
                    props.onSelectSpec(node.id);
                  }}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${node.width}px`,
                    height: `${node.height}px`,
                  }}
                  type="button"
                >
                  <span className="analysis-map__node-file">{node.slug}</span>
                  <strong className="analysis-map__node-title">{node.title}</strong>
                  <div className="specs-map__meta">
                    <span className="specs-map__meta-chip">{node.status}</span>
                    <span className="specs-map__meta-chip">{node.version}</span>
                    <span className="specs-map__meta-chip">{node.updatedAtLabel}</span>
                  </div>
                  <span className="analysis-map__node-summary">{node.summary}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}

function buildSpecBoardNodes(specs: ProjectSpecDocument[]): SpecBoardNode[] {
  const columnCount = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(specs.length))));
  const totalWidth =
    columnCount * SPECS_BOARD_LAYOUT_PRESET.cardWidth +
    Math.max(columnCount - 1, 0) * SPECS_BOARD_LAYOUT_PRESET.columnGap;
  const startX = -totalWidth / 2;
  const startY = -SPECS_BOARD_LAYOUT_PRESET.cardHeight / 2;

  return specs.map((spec, index) => {
    const columnIndex = index % columnCount;
    const rowIndex = Math.floor(index / columnCount);

    return {
      id: spec.meta.id,
      slug: spec.meta.slug,
      status: describeSpecStatus(spec.meta.status),
      summary:
        spec.meta.summary ??
        `${describeSpecStatus(spec.meta.status)} · ${spec.meta.latestVersion} · 선택해서 채팅 대상 변경`,
      title: spec.meta.title,
      updatedAtLabel: formatSpecTimestamp(spec.meta.updatedAt),
      version: spec.meta.latestVersion,
      width: SPECS_BOARD_LAYOUT_PRESET.cardWidth,
      height: SPECS_BOARD_LAYOUT_PRESET.cardHeight,
      x:
        startX +
        columnIndex *
          (SPECS_BOARD_LAYOUT_PRESET.cardWidth + SPECS_BOARD_LAYOUT_PRESET.columnGap) +
        (rowIndex % 2 === 0 ? 0 : SPECS_BOARD_LAYOUT_PRESET.rowOffset),
      y:
        startY +
        rowIndex * (SPECS_BOARD_LAYOUT_PRESET.cardHeight + SPECS_BOARD_LAYOUT_PRESET.rowGap),
    };
  });
}

function resolveSelectedSpec(
  specs: ProjectSpecDocument[],
  selectedSpecId: string | null,
): ProjectSpecDocument | null {
  if (specs.length === 0) {
    return null;
  }

  return specs.find((spec) => spec.meta.id === selectedSpecId) ?? specs[0] ?? null;
}

function createViewportToFitNodes(nodes: SpecBoardNode[], stageSize: SpecsStageSize): SpecsViewport {
  const bounds = getNodeBounds(nodes);
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

function getNodeBounds(nodes: SpecBoardNode[]): {
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

function createStageGridStyle(viewport: SpecsViewport): Record<string, string> {
  const gridSize = WORKSPACE_MAP_GRID_SIZE * viewport.scale;

  return {
    backgroundPosition: `calc(50% + ${viewport.offsetX}px) calc(50% + ${viewport.offsetY}px)`,
    backgroundSize: `${gridSize}px ${gridSize}px`,
  };
}

function describeSpecStatus(status: ProjectSpecDocument['meta']['status']): string {
  switch (status) {
    case 'draft':
      return '초안';
    case 'approved':
      return '확정';
    case 'archived':
      return '보관';
  }
}

function formatSpecTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}
