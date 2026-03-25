import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ProjectAnalysisFileIndexEntry,
  ProjectAnalysisFileReference,
} from '@/domain/project/project-analysis-model';
import {
  createEmptyProjectReferenceTagDocument,
  createProjectReferenceTag,
  type ProjectReferenceTagDocument,
} from '@/domain/project/project-reference-tag-model';
import {
  ReferenceTagManager,
  type ReferenceTagCreateResult,
  type ReferenceTagGenerationResult,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/reference-tags/ReferenceTagManager';
import {
  buildReferenceTagIdsByPath,
  buildReferenceTagSummaries,
  removeReferenceTagFromDocument,
  toggleReferenceTagAssignment,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/reference-tags/reference-tag-manager.utils';
import type { StructuredProjectAnalysis } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';
import {
  REFERENCE_GRAPH_TOP_OVERFLOW,
  REFERENCE_MAP_VIEWPORT_PRESET,
  WORKSPACE_MAP_GRID_SIZE,
  clamp,
  getWorkspaceMapFitScale,
  getWorkspaceMapNodeFontScale,
  getWorkspaceMapNodeSpacingScale,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/workspace-map.shared';

interface AnalysisReferenceMapProps {
  analysis: StructuredProjectAnalysis;
  canManageTags: boolean;
  isActive: boolean;
  isCancellingTags: boolean;
  isGeneratingTags: boolean;
  isSavingTags: boolean;
  onCancelReferenceTagGeneration: () => void;
  onGenerateReferenceTags: () => Promise<ReferenceTagGenerationResult>;
  onSaveReferenceTags: (referenceTags: ProjectReferenceTagDocument) => Promise<boolean>;
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

interface AnalysisReferenceNode {
  area: string;
  category: string;
  cluster: string;
  fileName: string;
  groupCategory: string;
  height: number;
  incomingCount: number;
  layer: string | null;
  outgoingCount: number;
  path: string;
  role: string;
  summary: string;
  tagLabels: string[];
  width: number;
  x: number;
  y: number;
}

interface AnalysisReferenceArea {
  clusterCount: number;
  count: number;
  height: number;
  key: string;
  label: string;
  name: string;
  width: number;
  x: number;
  y: number;
}

interface AnalysisReferenceCluster {
  areaName: string;
  count: number;
  groupCount: number;
  height: number;
  key: string;
  label: string;
  name: string;
  width: number;
  x: number;
  y: number;
}

interface AnalysisReferenceRoleGroup {
  category: string;
  clusterKey: string;
  count: number;
  height: number;
  hiddenCount: number;
  isExpanded: boolean;
  key: string;
  label: string;
  width: number;
  x: number;
  y: number;
}

interface AnalysisReferenceClusterSummary {
  count: number;
  fromCategory: string | null;
  fromCluster: string;
  isInternal: boolean;
  key: string;
  toCategory: string | null;
  toCluster: string;
}

interface AnalysisReferenceLink {
  from: string;
  isActive: boolean;
  key: string;
  label: string;
  midX: number;
  midY: number;
  path: string;
  reason: string;
  to: string;
  variant: 'detail' | 'summary';
}

interface AnalysisReferenceGraph {
  areas: AnalysisReferenceArea[];
  clusterSummaries: AnalysisReferenceClusterSummary[];
  clusters: AnalysisReferenceCluster[];
  edges: ProjectAnalysisFileReference[];
  nodes: AnalysisReferenceNode[];
  roleGroups: AnalysisReferenceRoleGroup[];
}

type AnalysisInteractionState = {
  kind: 'pan';
  moved: boolean;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
};

type AnalysisRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

interface AnalysisReferenceBuildOptions {
  activeTagIds: Set<string>;
  expandedGroupKeys: Set<string>;
  stageWidth: number;
}

interface AnalysisRoleGroupEntry {
  allPaths: string[];
  category: string;
  height: number;
  hiddenCount: number;
  isExpanded: boolean;
  visiblePaths: string[];
}

const EMPTY_STAGE_SIZE: AnalysisStageSize = {
  width: 0,
  height: 0,
};

const INITIAL_VIEWPORT: AnalysisViewport = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

const DEFAULT_AREA_WIDTH = 760;
const SINGLE_AREA_WIDTH = 1100;
const AREA_GAP = 40;
const AREA_HEADER_HEIGHT = 60;
const AREA_PADDING_X = 18;
const AREA_PADDING_TOP = 18;
const AREA_PADDING_BOTTOM = 22;
const CLUSTER_STACK_GAP = 16;
const CLUSTER_COLUMN_GAP = 16;
const CLUSTER_HEADER_HEIGHT = 42;
const CLUSTER_PADDING_X = 14;
const CLUSTER_PADDING_TOP = 14;
const CLUSTER_PADDING_BOTTOM = 16;
const ROLE_GROUP_COLUMNS = 2;
const ROLE_GROUP_MIN_TWO_COLUMN_WIDTH = 460;
const ROLE_GROUP_GAP = 12;
const ROLE_GROUP_HEADER_HEIGHT = 30;
const ROLE_GROUP_PADDING_X = 10;
const ROLE_GROUP_PADDING_TOP = 10;
const ROLE_GROUP_PADDING_BOTTOM = 12;
const ROLE_GROUP_PREVIEW_FOOTER_HEIGHT = 28;
const ROLE_GROUP_PREVIEW_FOOTER_GAP = 8;
const NODE_HEIGHT = 172;
const NODE_VERTICAL_GAP = 10;
const MIN_AREA_HEIGHT = 260;
const OVERVIEW_PREVIEW_NODE_LIMIT = 2;

export function AnalysisReferenceMap(props: AnalysisReferenceMapProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<AnalysisInteractionState | null>(null);
  const hasAdjustedViewportRef = useRef(false);
  const [activeAreaNames, setActiveAreaNames] = useState<string[]>([]);
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);
  const [isPanning, setIsPanning] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState<AnalysisStageSize>(EMPTY_STAGE_SIZE);
  const [viewport, setViewport] = useState<AnalysisViewport>(INITIAL_VIEWPORT);
  const activeAreaNameSet = useMemo(() => new Set(activeAreaNames), [activeAreaNames]);
  const activeTagIdSet = useMemo(() => new Set(activeTagIds), [activeTagIds]);
  const referenceTags = useMemo(
    () => props.analysis.referenceTags ?? createEmptyProjectReferenceTagDocument(),
    [props.analysis.referenceTags],
  );
  const areaScopedPaths = useMemo(() => {
    if (activeAreaNames.length === 0) {
      return null;
    }

    return new Set(
      props.analysis.fileIndex
        .filter((entry) =>
          activeAreaNameSet.has(resolveClusterAreaName(resolveNodeClusterName(entry.layer))),
        )
        .map((entry) => entry.path),
    );
  }, [activeAreaNameSet, activeAreaNames.length, props.analysis.fileIndex]);
  const tagSummaries = useMemo(
    () =>
      buildReferenceTagSummaries({
        allowedPaths: areaScopedPaths,
        referenceTags,
        selectedPath,
      }),
    [areaScopedPaths, referenceTags, selectedPath],
  );
  const taggedFileCount = useMemo(
    () => new Set(referenceTags.assignments.map((assignment) => assignment.path)).size,
    [referenceTags.assignments],
  );
  const graphResetKey = useMemo(
    () => createReferenceGraphResetKey(props.analysis),
    [props.analysis],
  );
  const expandedGroupKeySet = useMemo(() => new Set(expandedGroupKeys), [expandedGroupKeys]);

  const graph = useMemo(
    () =>
      buildReferenceGraph(props.analysis, {
        activeTagIds: activeTagIdSet,
        expandedGroupKeys: expandedGroupKeySet,
        stageWidth: stageSize.width,
      }),
    [activeTagIdSet, expandedGroupKeySet, props.analysis, stageSize.width],
  );
  const visibleGraph = useMemo(
    () => filterReferenceGraphByAreas(graph, activeAreaNameSet),
    [activeAreaNameSet, graph],
  );
  const areaSummaries = useMemo(
    () => graph.areas.map((area) => ({ count: area.count, label: area.label, name: area.name })),
    [graph.areas],
  );
  const selectedNode = useMemo(
    () => visibleGraph.nodes.find((node) => node.path === selectedPath) ?? null,
    [selectedPath, visibleGraph.nodes],
  );
  const outgoingEdges = useMemo(
    () => (selectedPath ? visibleGraph.edges.filter((edge) => edge.from === selectedPath) : []),
    [selectedPath, visibleGraph.edges],
  );
  const incomingEdges = useMemo(
    () => (selectedPath ? visibleGraph.edges.filter((edge) => edge.to === selectedPath) : []),
    [selectedPath, visibleGraph.edges],
  );
  const relatedPaths = useMemo(() => {
    const nextRelatedPaths = new Set<string>();

    for (const edge of outgoingEdges) {
      nextRelatedPaths.add(edge.to);
    }

    for (const edge of incomingEdges) {
      nextRelatedPaths.add(edge.from);
    }

    return nextRelatedPaths;
  }, [incomingEdges, outgoingEdges]);
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
  const nodeTitleMap = useMemo(
    () => new Map(visibleGraph.nodes.map((node) => [node.path, node.fileName])),
    [visibleGraph.nodes],
  );

  useEffect(() => {
    setActiveAreaNames([]);
    setSelectedPath(null);
    hasAdjustedViewportRef.current = false;
    setViewport(INITIAL_VIEWPORT);
  }, [graphResetKey]);

  useEffect(() => {
    const availableTagIds = new Set(tagSummaries.map((summary) => summary.tag.id));

    setActiveTagIds((current) => {
      const next = current.filter((tagId) => availableTagIds.has(tagId));
      return next.length === current.length ? current : next;
    });
  }, [tagSummaries]);

  useEffect(() => {
    const availableAreaNames = new Set(graph.areas.map((area) => area.name));

    setActiveAreaNames((current) => {
      const next = current.filter((areaName) => availableAreaNames.has(areaName));
      return next.length === current.length ? current : next;
    });
  }, [graph.areas]);

  useEffect(() => {
    hasAdjustedViewportRef.current = false;
    setViewport(INITIAL_VIEWPORT);
  }, [activeAreaNames]);

  useEffect(() => {
    if (selectedPath && !visibleGraph.nodes.some((node) => node.path === selectedPath)) {
      setSelectedPath(null);
    }
  }, [selectedPath, visibleGraph.nodes]);

  useEffect(() => {
    if (!props.isActive) {
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
  }, [props.isActive]);

  useEffect(() => {
    if (
      !props.isActive ||
      visibleGraph.nodes.length === 0 ||
      stageSize.width === 0 ||
      stageSize.height === 0
    ) {
      return;
    }

    if (hasAdjustedViewportRef.current) {
      return;
    }

    setViewport(createViewportToFitGraph(visibleGraph, stageSize));
    hasAdjustedViewportRef.current = true;
  }, [props.isActive, stageSize, visibleGraph]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const stageElement = stageRef.current;
      const interaction = interactionRef.current;
      if (!stageElement || !interaction) {
        return;
      }

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
  }, [viewport]);

  const linkPaths = useMemo(
    () =>
      buildReferenceLinkPaths({
        clusters: visibleGraph.clusters,
        clusterSummaries: visibleGraph.clusterSummaries,
        edges: visibleGraph.edges,
        nodes: visibleGraph.nodes,
        selectedPath,
        stageSize,
        viewport,
      }),
    [
      selectedPath,
      stageSize,
      viewport,
      visibleGraph.clusterSummaries,
      visibleGraph.clusters,
      visibleGraph.edges,
      visibleGraph.nodes,
    ],
  );

  const fitBoardToStage = () => {
    if (visibleGraph.nodes.length === 0 || stageSize.width === 0 || stageSize.height === 0) {
      return;
    }

    hasAdjustedViewportRef.current = true;
    setViewport(createViewportToFitGraph(visibleGraph, stageSize));
  };

  const saveReferenceTags = async (nextReferenceTags: ProjectReferenceTagDocument) => {
    const didSave = await props.onSaveReferenceTags(nextReferenceTags);
    return didSave;
  };
  const handleCreateTag = async (input: {
    description: string;
    label: string;
  }): Promise<ReferenceTagCreateResult> => {

    const normalizedLabel = input.label.trim();
    const existingLabels = new Set(
      tagSummaries.map((summary) => summary.tag.label.trim().toLowerCase()),
    );
    if (existingLabels.has(normalizedLabel.toLowerCase())) {
      return 'duplicate';
    }

    const nextReferenceTags: ProjectReferenceTagDocument = {
      ...referenceTags,
      tags: [
        ...referenceTags.tags,
        createProjectReferenceTag({
          description: input.description,
          existingIds: referenceTags.tags.map((tag) => tag.id),
          label: normalizedLabel,
          now: new Date().toISOString(),
        }),
      ],
    };

    const didSave = await saveReferenceTags(nextReferenceTags);
    return didSave ? 'created' : 'failed';
  };

  const handleDeleteTag = async (tagId: string): Promise<void> => {

    const didSave = await saveReferenceTags(removeReferenceTagFromDocument(referenceTags, tagId));
    if (didSave) {
      setActiveTagIds((current) => current.filter((currentTagId) => currentTagId !== tagId));
    }
  };

  const handleToggleTagAssignment = async (tagId: string): Promise<void> => {
    if (!selectedPath) {
      return;
    }

    await saveReferenceTags(
      toggleReferenceTagAssignment({
        document: referenceTags,
        path: selectedPath,
        tagId,
      }),
    );
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
        REFERENCE_MAP_VIEWPORT_PRESET.minScale,
        REFERENCE_MAP_VIEWPORT_PRESET.maxScale,
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

  const hasActiveFilters = activeAreaNames.length > 0 || activeTagIds.length > 0;

  return (
    <section className="analysis-map analysis-reference-map">
      <div className="analysis-reference-map__board">
        <div
          className={`analysis-map__stage analysis-reference-map__stage ${
            isPanning ? 'analysis-map__stage--panning' : ''
          }`}
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }

            if (event.target === event.currentTarget) {
              setSelectedPath(null);
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
              REFERENCE_MAP_VIEWPORT_PRESET.minScale,
              REFERENCE_MAP_VIEWPORT_PRESET.maxScale,
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

          {visibleGraph.nodes.length === 0 ? (
            <div className="analysis-map__empty">
              <div className="analysis-empty-panel__card">
                <span className="analysis-empty-panel__eyebrow">
                  {hasActiveFilters ? '필터 결과' : '참조 준비'}
                </span>
                <h3 className="analysis-empty-panel__title">
                  {hasActiveFilters
                    ? '선택한 영역과 태그에 맞는 파일이 없습니다.'
                    : '파일 참조 맵이 아직 없습니다.'}
                </h3>
                <p className="analysis-empty-panel__description">
                  {hasActiveFilters
                    ? '영역 또는 태그 선택을 조정해 다른 파일 관계를 확인해 주세요.'
                    : '현재 분석 결과에는 별도로 시각화할 파일 참조선이 없습니다.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <svg
                aria-hidden="true"
                className="analysis-map__links"
                viewBox={`0 0 ${stageSize.width} ${stageSize.height}`}
              >
                <defs>
                  <marker
                    id="analysis-reference-map-arrowhead"
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
                {linkPaths.map((link) => (
                  <path
                    className={`analysis-map__link ${
                      link.variant === 'summary'
                        ? 'analysis-reference-map__link--summary'
                        : link.isActive
                          ? 'analysis-reference-map__link--active'
                          : 'analysis-reference-map__link--muted'
                    }`}
                    d={link.path}
                    key={link.key}
                    markerEnd="url(#analysis-reference-map-arrowhead)"
                  />
                ))}
              </svg>

              {linkPaths.map((link) => (
                <div
                  className={`analysis-map__link-label analysis-reference-map__link-label ${
                    link.variant === 'summary' ? 'analysis-reference-map__link-label--summary' : ''
                  }`}
                  key={`${link.key}-label`}
                  style={{
                    left: `${link.midX}px`,
                    top: `${link.midY}px`,
                  }}
                  title={link.reason}
                >
                  {link.label}
                </div>
              ))}

              <div className="analysis-map__world-anchor">
                <div className="analysis-map__world" style={worldStyle}>
                  {visibleGraph.areas.map((area) => (
                    <div
                      className={`analysis-reference-map__area ${
                        selectedNode?.area === area.name ||
                        activeAreaNameSet.has(area.name)
                          ? 'analysis-reference-map__area--active'
                          : ''
                      }`}
                      key={area.key}
                      style={{
                        left: `${area.x}px`,
                        top: `${area.y}px`,
                        width: `${area.width}px`,
                        height: `${area.height}px`,
                      }}
                    >
                      <div className="analysis-reference-map__area-header">
                        <strong>{area.label}</strong>
                        <span>
                          클러스터 {area.clusterCount}개 · 파일 {area.count}개
                        </span>
                      </div>
                    </div>
                  ))}

                  {visibleGraph.clusters.map((cluster) => (
                    <div
                      className={`analysis-reference-map__cluster ${
                        selectedNode?.cluster === cluster.name
                          ? 'analysis-reference-map__cluster--active'
                          : ''
                      }`}
                      key={cluster.key}
                      style={{
                        left: `${cluster.x}px`,
                        top: `${cluster.y}px`,
                        width: `${cluster.width}px`,
                        height: `${cluster.height}px`,
                      }}
                    >
                      <div className="analysis-reference-map__cluster-header">
                        <strong>{cluster.label}</strong>
                        <span>
                          역할 {cluster.groupCount}개 · 파일 {cluster.count}개
                        </span>
                      </div>
                    </div>
                  ))}

                  {visibleGraph.roleGroups.map((group) => (
                    <div
                      className={`analysis-reference-map__role-group ${
                        selectedNode &&
                        selectedNode.cluster === group.clusterKey &&
                        selectedNode.groupCategory === group.category
                          ? 'analysis-reference-map__role-group--active'
                          : ''
                      } ${
                        !selectedPath && group.hiddenCount > 0
                          ? 'analysis-reference-map__role-group--expandable'
                          : ''
                      }`}
                      key={group.key}
                      onClick={() => {
                        if (selectedPath || group.hiddenCount === 0) {
                          return;
                        }

                        setExpandedGroupKeys((current) => {
                          if (current.includes(group.key)) {
                            return current.filter((key) => key !== group.key);
                          }

                          return [...current, group.key];
                        });
                      }}
                      onPointerDown={(event) => {
                        if (selectedPath || group.hiddenCount === 0) {
                          return;
                        }

                        event.stopPropagation();
                      }}
                      style={{
                        left: `${group.x}px`,
                        top: `${group.y}px`,
                        width: `${group.width}px`,
                        height: `${group.height}px`,
                      }}
                    >
                      <div className="analysis-reference-map__role-group-header">
                        <strong>{group.label}</strong>
                        <span>{group.count}개</span>
                      </div>
                      {!selectedPath && group.hiddenCount > 0 ? (
                        <div className="analysis-reference-map__role-group-footer">
                          <span className="analysis-reference-map__role-group-more">
                            {group.isExpanded ? '접기' : `+${group.hiddenCount}개 더 보기`}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {visibleGraph.nodes.map((node) => (
                    <button
                      className={`analysis-reference-map__node ${
                        selectedPath === node.path ? 'analysis-reference-map__node--selected' : ''
                      } ${
                        selectedPath && node.path !== selectedPath && relatedPaths.has(node.path)
                          ? 'analysis-reference-map__node--related'
                          : ''
                      } ${
                        selectedPath && node.path !== selectedPath && !relatedPaths.has(node.path)
                          ? 'analysis-reference-map__node--muted'
                          : ''
                      }`}
                      key={node.path}
                      onClick={() => {
                        setSelectedPath(node.path);
                      }}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      style={{
                        left: `${node.x}px`,
                        top: `${node.y}px`,
                        width: `${node.width}px`,
                        height: `${node.height}px`,
                      }}
                      type="button"
                    >
                      <span className="analysis-reference-map__node-file">{node.fileName}</span>
                      <strong className="analysis-reference-map__node-path">{node.path}</strong>
                      <span className="analysis-reference-map__node-summary">{node.summary}</span>
                      <span className="analysis-reference-map__node-meta">
                        <span className="analysis-reference-map__node-chip">{node.role}</span>
                        <span className="analysis-reference-map__node-chip">
                          {resolveRoleGroupDisplayName(node.groupCategory)}
                        </span>
                        {node.tagLabels.length > 0 ? (
                          <span className="analysis-reference-map__node-chip">
                            태그 {node.tagLabels.length}
                          </span>
                        ) : null}
                        <span className="analysis-reference-map__node-chip">
                          나감 {node.outgoingCount}
                        </span>
                        <span className="analysis-reference-map__node-chip">
                          들어옴 {node.incomingCount}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div
          className={`analysis-reference-map__overlay ${
            isInspectorCollapsed ? 'analysis-reference-map__overlay--collapsed' : ''
          }`}
        >
          <button
            aria-label={isInspectorCollapsed ? '참조 정보 열기' : '참조 정보 접기'}
            className="analysis-reference-map__floating-toggle"
            onClick={() => {
              setIsInspectorCollapsed((current) => !current);
            }}
            type="button"
          >
            <span>{isInspectorCollapsed ? '참조 정보' : '접기'}</span>
            <span aria-hidden="true">{isInspectorCollapsed ? '→' : '←'}</span>
          </button>

          {!isInspectorCollapsed ? (
            <div
              className="analysis-reference-map__inspector"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onWheelCapture={(event) => {
                event.stopPropagation();
              }}
            >
              <div className="analysis-reference-map__header">
                <div className="analysis-reference-map__copy">
                  <span className="analysis-reference-map__eyebrow">파일 참조</span>
                  <h4>참조 맵</h4>
                </div>
                <div className="analysis-reference-map__stats">
                  <span className="analysis-reference-map__stat">
                    <span className="analysis-reference-map__summary-label">파일</span>
                    <strong className="analysis-reference-map__summary-value">
                      {visibleGraph.nodes.length}개
                    </strong>
                  </span>
                  <span className="analysis-reference-map__stat">
                    <span className="analysis-reference-map__summary-label">참조선</span>
                    <strong className="analysis-reference-map__summary-value">
                      {visibleGraph.edges.length}개
                    </strong>
                  </span>
                </div>
              </div>

              <div className="analysis-reference-map__filter-panel">
                <div className="analysis-reference-map__filter-header">
                  <span className="analysis-reference-map__eyebrow">영역 선택</span>
                </div>
                <div className="analysis-reference-map__layers">
                  <button
                    aria-pressed={activeAreaNames.length === 0}
                    className={`analysis-reference-map__layer-chip ${
                      activeAreaNames.length === 0 ? 'analysis-reference-map__layer-chip--active' : ''
                    }`}
                    onClick={() => {
                      setActiveAreaNames([]);
                    }}
                    type="button"
                  >
                    <span className="analysis-reference-map__summary-label">전체</span>
                    <strong className="analysis-reference-map__summary-value">
                      {graph.nodes.length}개
                    </strong>
                  </button>
                  {areaSummaries.map((area) => {
                    const isActive =
                      activeAreaNameSet.has(area.name) ||
                      (activeAreaNames.length === 0 && selectedNode?.area === area.name);

                    return (
                      <button
                        aria-pressed={isActive}
                        className={`analysis-reference-map__layer-chip ${
                          isActive ? 'analysis-reference-map__layer-chip--active' : ''
                        }`}
                        key={area.name}
                        onClick={() => {
                          setActiveAreaNames((current) =>
                            current.includes(area.name)
                              ? current.filter((currentAreaName) => currentAreaName !== area.name)
                              : [...current, area.name],
                          );
                        }}
                        type="button"
                      >
                        <span className="analysis-reference-map__summary-label">{area.label}</span>
                        <strong className="analysis-reference-map__summary-value">
                          {area.count}개
                        </strong>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedNode ? (
                <div className="analysis-reference-map__selected">
                  <section className="analysis-reference-map__selection-card">
                    <div className="analysis-reference-map__selection-header">
                      <div className="analysis-reference-map__selection-copy">
                        <span className="analysis-reference-map__selected-file">
                          {selectedNode.fileName}
                        </span>
                        <strong className="analysis-reference-map__selected-path">
                          {selectedNode.path}
                        </strong>
                      </div>
                      <div className="analysis-reference-map__meta">
                        <span className="analysis-reference-map__meta-chip">
                          {selectedNode.role}
                        </span>
                        <span className="analysis-reference-map__meta-chip">
                          {resolveAreaDisplayName(selectedNode.area)}
                        </span>
                        <span className="analysis-reference-map__meta-chip">
                          {getClusterDisplayText(selectedNode.cluster)}
                        </span>
                        <span className="analysis-reference-map__meta-chip">
                          {resolveRoleGroupDisplayName(selectedNode.groupCategory)}
                        </span>
                        <button
                          className="analysis-reference-map__action-button"
                          onClick={() => {
                            setSelectedPath(null);
                          }}
                          type="button"
                        >
                          개요 보기
                        </button>
                      </div>
                    </div>

                    <p className="analysis-reference-map__selected-summary">
                      {selectedNode.summary}
                    </p>

                    <div className="analysis-reference-map__meta">
                      <span className="analysis-reference-map__meta-chip">
                        나감 {selectedNode.outgoingCount}개
                      </span>
                      <span className="analysis-reference-map__meta-chip">
                        들어옴 {selectedNode.incomingCount}개
                      </span>
                      {selectedNode.tagLabels.map((tagLabel) => (
                        <span className="analysis-reference-map__meta-chip" key={tagLabel}>
                          태그 {tagLabel}
                        </span>
                      ))}
                    </div>
                  </section>

                  <div className="analysis-reference-map__lists">
                    <section className="analysis-reference-map__list-card">
                      <div className="analysis-reference-map__list-card-header">
                        <h5>이 파일이 참조하는 대상</h5>
                        <span className="analysis-reference-map__list-count">
                          {outgoingEdges.length}개
                        </span>
                      </div>
                      {outgoingEdges.length > 0 ? (
                        <ul className="analysis-reference-map__list">
                          {outgoingEdges.slice(0, 8).map((edge) => (
                            <li key={edge.from + edge.to + edge.relationship}>
                              <div className="analysis-reference-map__list-row">
                                <div className="analysis-reference-map__list-copy">
                                  <span className="analysis-reference-map__list-title">
                                    {nodeTitleMap.get(edge.to) ?? getPathDisplayName(edge.to)}
                                  </span>
                                  <span className="analysis-reference-map__list-path">
                                    {edge.to}
                                  </span>
                                </div>
                                <span className="analysis-reference-map__list-chip">
                                  {edge.relationship}
                                </span>
                              </div>
                              <p className="analysis-reference-map__list-reason">{edge.reason}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="analysis-reference-map__empty-copy">
                          직접 나가는 핵심 참조가 없습니다.
                        </p>
                      )}
                    </section>

                    <section className="analysis-reference-map__list-card">
                      <div className="analysis-reference-map__list-card-header">
                        <h5>이 파일을 참조하는 대상</h5>
                        <span className="analysis-reference-map__list-count">
                          {incomingEdges.length}개
                        </span>
                      </div>
                      {incomingEdges.length > 0 ? (
                        <ul className="analysis-reference-map__list">
                          {incomingEdges.slice(0, 8).map((edge) => (
                            <li key={edge.from + edge.to + edge.relationship}>
                              <div className="analysis-reference-map__list-row">
                                <div className="analysis-reference-map__list-copy">
                                  <span className="analysis-reference-map__list-title">
                                    {nodeTitleMap.get(edge.from) ?? getPathDisplayName(edge.from)}
                                  </span>
                                  <span className="analysis-reference-map__list-path">
                                    {edge.from}
                                  </span>
                                </div>
                                <span className="analysis-reference-map__list-chip">
                                  {edge.relationship}
                                </span>
                              </div>
                              <p className="analysis-reference-map__list-reason">{edge.reason}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="analysis-reference-map__empty-copy">
                          이 파일로 들어오는 핵심 참조가 없습니다.
                        </p>
                      )}
                    </section>
                  </div>
                </div>
              ) : null}

              <ReferenceTagManager
                activeTagIds={activeTagIds}
                canManageTags={props.canManageTags}
                isCancellingReferenceTags={props.isCancellingTags}
                isGeneratingReferenceTags={props.isGeneratingTags}
                isSaving={props.isSavingTags}
                onCancelReferenceTagGeneration={props.onCancelReferenceTagGeneration}
                onGenerateReferenceTags={props.onGenerateReferenceTags}
                onCreateTag={handleCreateTag}
                onDeleteTag={handleDeleteTag}
                onClearTags={() => {
                  setActiveTagIds([]);
                }}
                onToggleTagFilter={(tagId) => {
                  setActiveTagIds((current) =>
                    current.includes(tagId)
                      ? current.filter((currentTagId) => currentTagId !== tagId)
                      : [...current, tagId],
                  );
                }}
                onToggleTagAssignment={handleToggleTagAssignment}
                selectedPath={selectedPath}
                selectedPathLabel={selectedNode?.path ?? null}
                taggedFileCount={taggedFileCount}
                tagSummaries={tagSummaries}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function buildReferenceGraph(
  analysis: StructuredProjectAnalysis,
  options: AnalysisReferenceBuildOptions,
): AnalysisReferenceGraph {
  const entryByPath = new Map(analysis.fileIndex.map((entry) => [entry.path, entry] as const));
  const indexedPaths = new Set(entryByPath.keys());
  const tagIdsByPath = buildReferenceTagIdsByPath(analysis.referenceTags);
  const tagLabelById = new Map(
    (analysis.referenceTags?.tags ?? []).map((tag) => [tag.id, tag.label] as const),
  );
  const incomingCounts = new Map<string, number>();
  const outgoingCounts = new Map<string, number>();
  const groupCategoryByPath = new Map<string, string>();
  const referencedPaths = new Set(
    analysis.fileIndex
      .map((entry) => entry.path)
      .filter(
        (path) =>
          options.activeTagIds.size === 0 ||
          (tagIdsByPath
            .get(path)
            ?.some((tagId) => options.activeTagIds.has(tagId)) ??
            false),
      ),
  );
  const edges = deduplicateFileReferences(analysis.context.fileReferences).filter(
    (edge) =>
      indexedPaths.has(edge.from) &&
      indexedPaths.has(edge.to) &&
      referencedPaths.has(edge.from) &&
      referencedPaths.has(edge.to),
  );

  for (const edge of edges) {
    outgoingCounts.set(edge.from, (outgoingCounts.get(edge.from) ?? 0) + 1);
    incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1);
  }

  const clusterNames = resolveOrderedClusterNames(analysis, entryByPath, referencedPaths);
  const groupedPaths = new Map<string, string[]>();

  for (const clusterName of clusterNames) {
    groupedPaths.set(clusterName, []);
  }

  for (const path of referencedPaths) {
    const clusterName = resolveNodeClusterName(entryByPath.get(path)?.layer);
    const paths = groupedPaths.get(clusterName);
    if (!paths) {
      groupedPaths.set(clusterName, [path]);
      continue;
    }

    paths.push(path);
  }

  for (const paths of groupedPaths.values()) {
    paths.sort((left, right) =>
      comparePathsByReferenceScore({
        entryByPath,
        incomingCounts,
        left,
        outgoingCounts,
        right,
      }),
    );
  }

  const orderedPathsByCluster = optimizeClusterNodeOrdering({
    clusterNames,
    edges,
    entryByPath,
    groupedPaths,
    incomingCounts,
    outgoingCounts,
  });
  const areaNames = resolveOrderedAreaNames(clusterNames);
  const areas: AnalysisReferenceArea[] = [];
  const clusters: AnalysisReferenceCluster[] = [];
  const roleGroups: AnalysisReferenceRoleGroup[] = [];
  const nodes: AnalysisReferenceNode[] = [];
  const areaColumnCount = resolveAreaColumnCount({
    areaCount: areaNames.length,
    stageWidth: options.stageWidth,
  });
  const areaWidth = resolveAreaWidth({
    areaColumnCount,
    stageWidth: options.stageWidth,
  });
  let areaX = 0;
  let areaY = 0;
  let currentAreaRowHeight = 0;

  areaNames.forEach((areaName, areaIndex) => {
    if (areaIndex > 0 && areaIndex % areaColumnCount === 0) {
      areaX = 0;
      areaY += currentAreaRowHeight + AREA_GAP;
      currentAreaRowHeight = 0;
    }

    const areaClusters = clusterNames.filter(
      (clusterName) => resolveClusterAreaName(clusterName) === areaName,
    );
    const clusterColumnCount = resolveClusterColumnCount({
      areaWidth,
      clusterCount: areaClusters.length,
    });
    const clusterWidth = Math.floor(
      (areaWidth - AREA_PADDING_X * 2 - CLUSTER_COLUMN_GAP * Math.max(0, clusterColumnCount - 1)) /
        clusterColumnCount,
    );
    let areaFileCount = 0;
    const clusterLayouts = areaClusters.map((clusterName) => {
      const orderedPaths = orderedPathsByCluster.get(clusterName) ?? [];
      const groupEntries = buildRoleGroupEntries({
        clusterName,
        expandedGroupKeys: options.expandedGroupKeys,
        entryByPath,
        incomingCounts,
        orderedPaths,
        outgoingCounts,
      });
      const groupColumnCount =
        groupEntries.length > 1 && clusterWidth >= ROLE_GROUP_MIN_TWO_COLUMN_WIDTH
          ? ROLE_GROUP_COLUMNS
          : 1;
      const groupWidth = Math.floor(
        (clusterWidth -
          CLUSTER_PADDING_X * 2 -
          ROLE_GROUP_GAP * Math.max(0, groupColumnCount - 1)) /
          groupColumnCount,
      );
      const groupRowHeights: number[] = [];

      groupEntries.forEach((groupEntry, groupIndex) => {
        const rowIndex = Math.floor(groupIndex / groupColumnCount);
        groupRowHeights[rowIndex] = Math.max(groupRowHeights[rowIndex] ?? 0, groupEntry.height);
      });

      const clusterBodyHeight =
        groupRowHeights.reduce((sum, height) => sum + height, 0) +
        ROLE_GROUP_GAP * Math.max(0, groupRowHeights.length - 1);

      return {
        clusterHeight:
          CLUSTER_HEADER_HEIGHT + CLUSTER_PADDING_TOP + clusterBodyHeight + CLUSTER_PADDING_BOTTOM,
        clusterName,
        groupColumnCount,
        groupEntries,
        groupRowOffsets: buildRowOffsets(groupRowHeights, ROLE_GROUP_GAP),
        groupWidth,
        orderedPaths,
      };
    });
    const clusterColumnHeights = Array.from({ length: clusterColumnCount }, () => 0);

    clusterLayouts.forEach((clusterLayout) => {
      const columnIndex = getIndexOfShortestColumn(clusterColumnHeights);
      const columnOffset = clusterColumnHeights[columnIndex] ?? 0;
      const clusterName = clusterLayout.clusterName;
      const clusterX = areaX + AREA_PADDING_X + columnIndex * (clusterWidth + CLUSTER_COLUMN_GAP);
      const clusterY = areaY + AREA_HEADER_HEIGHT + AREA_PADDING_TOP + columnOffset;

      clusters.push({
        areaName,
        count: clusterLayout.orderedPaths.length,
        groupCount: clusterLayout.groupEntries.length,
        height: clusterLayout.clusterHeight,
        key: clusterName,
        label: resolveClusterDisplayName(clusterName),
        name: clusterName,
        width: clusterWidth,
        x: clusterX,
        y: clusterY,
      });

      clusterLayout.groupEntries.forEach((groupEntry, groupIndex) => {
        const groupColumnIndex = groupIndex % clusterLayout.groupColumnCount;
        const groupRowIndex = Math.floor(groupIndex / clusterLayout.groupColumnCount);
        const groupX =
          clusterX +
          CLUSTER_PADDING_X +
          groupColumnIndex * (clusterLayout.groupWidth + ROLE_GROUP_GAP);
        const groupY =
          clusterY +
          CLUSTER_HEADER_HEIGHT +
          CLUSTER_PADDING_TOP +
          (clusterLayout.groupRowOffsets[groupRowIndex] ?? 0);
        const nodeWidth = clusterLayout.groupWidth - ROLE_GROUP_PADDING_X * 2;

        roleGroups.push({
          category: groupEntry.category,
          clusterKey: clusterName,
          count: groupEntry.allPaths.length,
          height: groupEntry.height,
          hiddenCount: groupEntry.hiddenCount,
          isExpanded: groupEntry.isExpanded,
          key: `${clusterName}|${groupEntry.category}`,
          label: resolveRoleGroupDisplayName(groupEntry.category),
          width: clusterLayout.groupWidth,
          x: groupX,
          y: groupY,
        });

        groupEntry.allPaths.forEach((path) => {
          groupCategoryByPath.set(path, groupEntry.category);
        });

        groupEntry.visiblePaths.forEach((path, nodeIndex) => {
          const entry = entryByPath.get(path);

          nodes.push({
            area: areaName,
            category: entry?.category ?? groupEntry.category,
            cluster: clusterName,
            fileName: getPathDisplayName(path),
            groupCategory: groupEntry.category,
            height: NODE_HEIGHT,
            incomingCount: incomingCounts.get(path) ?? 0,
            layer: entry?.layer ?? null,
            outgoingCount: outgoingCounts.get(path) ?? 0,
            path,
            role: entry?.role ?? '참조 파일',
            summary: getReferenceSummary(entry),
            tagLabels: (tagIdsByPath.get(path) ?? [])
              .map((tagId) => tagLabelById.get(tagId))
              .filter((tagLabel): tagLabel is string => Boolean(tagLabel)),
            width: nodeWidth,
            x: groupX + ROLE_GROUP_PADDING_X,
            y:
              groupY +
              ROLE_GROUP_HEADER_HEIGHT +
              ROLE_GROUP_PADDING_TOP +
              nodeIndex * (NODE_HEIGHT + NODE_VERTICAL_GAP),
          });
        });
      });

      areaFileCount += clusterLayout.orderedPaths.length;
      clusterColumnHeights[columnIndex] =
        columnOffset + clusterLayout.clusterHeight + CLUSTER_STACK_GAP;
    });

    const contentHeight = Math.max(0, Math.max(...clusterColumnHeights, 0) - CLUSTER_STACK_GAP);
    const areaHeight = Math.max(
      MIN_AREA_HEIGHT,
      AREA_HEADER_HEIGHT + AREA_PADDING_TOP + contentHeight + AREA_PADDING_BOTTOM,
    );

    areas.push({
      clusterCount: areaClusters.length,
      count: areaFileCount,
      height: areaHeight,
      key: areaName,
      label: resolveAreaDisplayName(areaName),
      name: areaName,
      width: areaWidth,
      x: areaX,
      y: areaY,
    });

    currentAreaRowHeight = Math.max(currentAreaRowHeight, areaHeight);
    areaX += areaWidth + AREA_GAP;
  });

  return {
    areas,
    clusterSummaries: buildClusterSummaries({
      clusterNames,
      edges,
      entryByPath,
      groupCategoryByPath,
    }),
    clusters,
    edges,
    nodes,
    roleGroups,
  };
}

function filterReferenceGraphByAreas(
  graph: AnalysisReferenceGraph,
  areaNames: Set<string>,
): AnalysisReferenceGraph {
  if (areaNames.size === 0) {
    return graph;
  }

  const areas = graph.areas.filter((area) => areaNames.has(area.name));
  const clusters = graph.clusters.filter((cluster) => areaNames.has(cluster.areaName));
  const clusterKeys = new Set(clusters.map((cluster) => cluster.key));
  const roleGroups = graph.roleGroups.filter((group) => clusterKeys.has(group.clusterKey));
  const nodes = graph.nodes.filter((node) => areaNames.has(node.area));
  const nodePaths = new Set(nodes.map((node) => node.path));
  const edges = graph.edges.filter((edge) => nodePaths.has(edge.from) && nodePaths.has(edge.to));
  const clusterSummaries = graph.clusterSummaries.filter(
    (summary) => clusterKeys.has(summary.fromCluster) && clusterKeys.has(summary.toCluster),
  );

  return {
    areas,
    clusterSummaries,
    clusters,
    edges,
    nodes,
    roleGroups,
  };
}

function buildRoleGroupEntries(input: {
  clusterName: string;
  expandedGroupKeys: Set<string>;
  entryByPath: Map<string, ProjectAnalysisFileIndexEntry>;
  incomingCounts: Map<string, number>;
  orderedPaths: string[];
  outgoingCounts: Map<string, number>;
}): AnalysisRoleGroupEntry[] {
  const pathsByCategory = new Map<string, string[]>();

  for (const path of input.orderedPaths) {
    const category = resolveRoleGroupCategory({
      category: input.entryByPath.get(path)?.category ?? 'source',
      clusterName: input.clusterName,
    });
    const bucket = pathsByCategory.get(category);
    if (bucket) {
      bucket.push(path);
      continue;
    }

    pathsByCategory.set(category, [path]);
  }

  return [...pathsByCategory.entries()]
    .sort((left, right) => {
      const categoryPriorityDifference =
        getRoleGroupPriority(right[0]) - getRoleGroupPriority(left[0]);
      if (categoryPriorityDifference !== 0) {
        return categoryPriorityDifference;
      }

      return left[0].localeCompare(right[0]);
    })
    .map(([category, paths]) => {
      const allPaths = [...paths].sort((left, right) =>
        comparePathsByReferenceScore({
          entryByPath: input.entryByPath,
          incomingCounts: input.incomingCounts,
          left,
          outgoingCounts: input.outgoingCounts,
          right,
        }),
      );
      const groupKey = `${input.clusterName}|${category}`;
      const isExpanded =
        input.expandedGroupKeys.has(groupKey) || allPaths.length <= OVERVIEW_PREVIEW_NODE_LIMIT;
      const visiblePaths = isExpanded ? allPaths : allPaths.slice(0, OVERVIEW_PREVIEW_NODE_LIMIT);
      const hiddenCount = Math.max(0, allPaths.length - visiblePaths.length);
      const footerHeight =
        hiddenCount > 0 ? ROLE_GROUP_PREVIEW_FOOTER_GAP + ROLE_GROUP_PREVIEW_FOOTER_HEIGHT : 0;

      return {
        allPaths,
        category,
        height:
          ROLE_GROUP_HEADER_HEIGHT +
          ROLE_GROUP_PADDING_TOP +
          ROLE_GROUP_PADDING_BOTTOM +
          visiblePaths.length * NODE_HEIGHT +
          Math.max(0, visiblePaths.length - 1) * NODE_VERTICAL_GAP +
          footerHeight,
        hiddenCount,
        isExpanded,
        visiblePaths,
      };
    });
}

function buildRowOffsets(rowHeights: number[], gap: number): number[] {
  const offsets: number[] = [];
  let offset = 0;

  for (const rowHeight of rowHeights) {
    offsets.push(offset);
    offset += rowHeight + gap;
  }

  return offsets;
}

function getIndexOfShortestColumn(columnHeights: number[]): number {
  let shortestIndex = 0;
  let shortestHeight = columnHeights[0] ?? 0;

  for (let index = 1; index < columnHeights.length; index += 1) {
    const columnHeight = columnHeights[index] ?? 0;
    if (columnHeight < shortestHeight) {
      shortestHeight = columnHeight;
      shortestIndex = index;
    }
  }

  return shortestIndex;
}

function getAreaPriority(areaName: string): number {
  switch (areaName) {
    case 'api':
      return 220;
    case 'core':
      return 210;
    case 'domain':
      return 205;
    case 'shared':
      return 200;
    case 'application':
      return 195;
    case 'infrastructure':
      return 190;
    case 'renderer':
      return 185;
    case 'client':
      return 184;
    case 'main':
      return 182;
    case 'preload':
      return 181;
    case 'server':
      return 180;
    case 'entrypoint':
      return 160;
    case 'config':
      return 150;
    case 'util':
    case 'utils':
      return 145;
    case 'test':
      return 80;
    case '미분류':
      return 20;
    default:
      return 120;
  }
}

function resolveAreaColumnCount(input: { areaCount: number; stageWidth: number }): number {
  void input.stageWidth;
  return Math.max(1, input.areaCount);
}

function resolveAreaWidth(input: { areaColumnCount: number; stageWidth: number }): number {
  void input.stageWidth;
  return input.areaColumnCount <= 1 ? SINGLE_AREA_WIDTH : DEFAULT_AREA_WIDTH;
}

function resolveClusterColumnCount(input: { areaWidth: number; clusterCount: number }): number {
  if (input.clusterCount <= 1) {
    return 1;
  }

  if (input.clusterCount >= 5 && input.areaWidth >= 940) {
    return 3;
  }

  return input.areaWidth >= 620 ? 2 : 1;
}

function deduplicateFileReferences(
  fileReferences: ProjectAnalysisFileReference[],
): ProjectAnalysisFileReference[] {
  const uniqueFileReferences = new Map<string, ProjectAnalysisFileReference>();

  for (const fileReference of fileReferences) {
    uniqueFileReferences.set(
      `${fileReference.from}|${fileReference.to}|${fileReference.relationship}|${fileReference.reason}`,
      fileReference,
    );
  }

  return [...uniqueFileReferences.values()];
}

function buildReferenceLinkPaths(input: {
  clusters: AnalysisReferenceCluster[];
  clusterSummaries: AnalysisReferenceClusterSummary[];
  edges: ProjectAnalysisFileReference[];
  nodes: AnalysisReferenceNode[];
  selectedPath: string | null;
  stageSize: AnalysisStageSize;
  viewport: AnalysisViewport;
}): AnalysisReferenceLink[] {
  if (!input.selectedPath) {
    return [];
  }

  const nodeByPath = new Map(input.nodes.map((node) => [node.path, node]));

  return input.edges.flatMap((edge) => {
    if (edge.from !== input.selectedPath && edge.to !== input.selectedPath) {
      return [];
    }

    const fromNode = nodeByPath.get(edge.from);
    const toNode = nodeByPath.get(edge.to);
    if (!fromNode || !toNode || input.stageSize.width === 0 || input.stageSize.height === 0) {
      return [];
    }

    const geometry = buildCurvedLinkGeometry({
      fromRect: fromNode,
      stageSize: input.stageSize,
      toRect: toNode,
      viewport: input.viewport,
    });

    return [
      {
        from: edge.from,
        isActive: true,
        key: `${edge.from}-${edge.to}-${edge.relationship}`,
        label: edge.relationship,
        midX: geometry.midX,
        midY: geometry.midY,
        path: geometry.path,
        reason: edge.reason,
        to: edge.to,
        variant: 'detail',
      },
    ];
  });
}

function buildCurvedLinkGeometry(input: {
  fromRect: AnalysisRect;
  stageSize: AnalysisStageSize;
  summary?: boolean;
  toRect: AnalysisRect;
  viewport: AnalysisViewport;
}): { midX: number; midY: number; path: string } {
  const fromCenterX = input.fromRect.x + input.fromRect.width / 2;
  const fromCenterY = input.fromRect.y + input.fromRect.height / 2;
  const toCenterX = input.toRect.x + input.toRect.width / 2;
  const toCenterY = input.toRect.y + input.toRect.height / 2;
  const horizontalDistance = Math.abs(toCenterX - fromCenterX);
  const verticalDistance = Math.abs(toCenterY - fromCenterY);
  const useHorizontal = horizontalDistance >= verticalDistance * 1.1;

  if (useHorizontal) {
    const drawFromRight = fromCenterX <= toCenterX;
    const start = toScreenPoint({
      stageSize: input.stageSize,
      viewport: input.viewport,
      x: drawFromRight ? input.fromRect.x + input.fromRect.width : input.fromRect.x,
      y: fromCenterY,
    });
    const end = toScreenPoint({
      stageSize: input.stageSize,
      viewport: input.viewport,
      x: drawFromRight ? input.toRect.x : input.toRect.x + input.toRect.width,
      y: toCenterY,
    });
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

  const drawFromBottom = fromCenterY <= toCenterY;
  const start = toScreenPoint({
    stageSize: input.stageSize,
    viewport: input.viewport,
    x: fromCenterX,
    y: drawFromBottom ? input.fromRect.y + input.fromRect.height : input.fromRect.y,
  });
  const end = toScreenPoint({
    stageSize: input.stageSize,
    viewport: input.viewport,
    x: toCenterX,
    y: drawFromBottom ? input.toRect.y : input.toRect.y + input.toRect.height,
  });
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

function createViewportToFitGraph(
  graph: AnalysisReferenceGraph,
  stageSize: AnalysisStageSize,
): AnalysisViewport {
  const bounds = getGraphBounds(graph);
  const scale = getWorkspaceMapFitScale({
    boundsWidth: bounds.width,
    boundsHeight: bounds.height,
    stageWidth: stageSize.width,
    stageHeight: stageSize.height,
    viewportPreset: REFERENCE_MAP_VIEWPORT_PRESET,
  });

  return {
    scale,
    offsetX: -(bounds.minX + bounds.width / 2) * scale,
    offsetY: -(bounds.minY + bounds.height / 2) * scale,
  };
}

function getGraphBounds(graph: AnalysisReferenceGraph): {
  height: number;
  minX: number;
  minY: number;
  width: number;
} {
  const rects: AnalysisRect[] = [
    ...graph.areas,
    ...graph.clusters,
    ...graph.roleGroups,
    ...graph.nodes,
  ];

  const xValues = rects.map((rect) => rect.x);
  const yValues = rects.map((rect) => rect.y);
  const maxXValues = rects.map((rect) => rect.x + rect.width);
  const maxYValues = rects.map((rect) => rect.y + rect.height);
  const minX = Math.min(...xValues);
  const minY = Math.min(...yValues);
  const maxX = Math.max(...maxXValues);
  const maxY = Math.max(...maxYValues);

  return {
    minX: minX - REFERENCE_MAP_VIEWPORT_PRESET.viewportPadding,
    minY: minY - REFERENCE_GRAPH_TOP_OVERFLOW,
    width: maxX - minX + REFERENCE_MAP_VIEWPORT_PRESET.viewportPadding * 2,
    height:
      maxY - minY + REFERENCE_GRAPH_TOP_OVERFLOW + REFERENCE_MAP_VIEWPORT_PRESET.viewportPadding,
  };
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

function createStageGridStyle(viewport: AnalysisViewport): Record<string, string> {
  const gridSize = WORKSPACE_MAP_GRID_SIZE * viewport.scale;

  return {
    backgroundPosition: `calc(50% + ${viewport.offsetX}px) calc(50% + ${viewport.offsetY}px)`,
    backgroundSize: `${gridSize}px ${gridSize}px`,
  };
}

function createReferenceGraphResetKey(analysis: StructuredProjectAnalysis): string {
  const fileKey = analysis.fileIndex
    .map((entry) => `${entry.path}:${entry.layer ?? ''}:${entry.category}`)
    .join('|');
  const edgeKey = analysis.context.fileReferences
    .map((edge) => `${edge.from}:${edge.to}:${edge.relationship}`)
    .join('|');

  return `${fileKey}#${edgeKey}`;
}

function resolveOrderedClusterNames(
  analysis: StructuredProjectAnalysis,
  entryByPath: Map<string, ProjectAnalysisFileIndexEntry>,
  referencedPaths: Set<string>,
): string[] {
  const preferredOrder = analysis.context.layers
    .map((layer) => resolveNodeClusterName(layer.name))
    .filter((name, index, names) => names.indexOf(name) === index);
  const discoveredNames = [...referencedPaths].map((path) =>
    resolveNodeClusterName(entryByPath.get(path)?.layer),
  );
  const discoveredNameSet = new Set(discoveredNames);
  const orderedNames = preferredOrder.filter((name) => discoveredNameSet.has(name));
  const unknownNames = [...discoveredNameSet]
    .filter((name) => !orderedNames.includes(name))
    .sort((left, right) => left.localeCompare(right));

  return [...orderedNames, ...unknownNames];
}

function resolveOrderedAreaNames(clusterNames: string[]): string[] {
  const areaNames: string[] = [];

  for (const clusterName of clusterNames) {
    const areaName = resolveClusterAreaName(clusterName);
    if (!areaNames.includes(areaName)) {
      areaNames.push(areaName);
    }
  }

  return [...areaNames].sort((left, right) => {
    const priorityDifference = getAreaPriority(right) - getAreaPriority(left);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return areaNames.indexOf(left) - areaNames.indexOf(right);
  });
}

function optimizeClusterNodeOrdering(input: {
  clusterNames: string[];
  edges: ProjectAnalysisFileReference[];
  entryByPath: Map<string, ProjectAnalysisFileIndexEntry>;
  groupedPaths: Map<string, string[]>;
  incomingCounts: Map<string, number>;
  outgoingCounts: Map<string, number>;
}): Map<string, string[]> {
  const neighborPaths = buildNeighborPathMap(input.edges);
  const pathClusterIndex = new Map<string, number>();
  let clusterPaths = input.clusterNames.map((clusterName, clusterIndex) => {
    const paths = [...(input.groupedPaths.get(clusterName) ?? [])];

    for (const path of paths) {
      pathClusterIndex.set(path, clusterIndex);
    }

    return paths;
  });

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const orderIndexByPath = new Map<string, number>();

    clusterPaths.forEach((paths) => {
      paths.forEach((path, index) => {
        orderIndexByPath.set(path, index);
      });
    });

    clusterPaths = clusterPaths.map((paths, clusterIndex) =>
      [...paths].sort((left, right) => {
        const leftBarycenter = getPathBarycenter({
          clusterIndex,
          neighborPaths,
          orderIndexByPath,
          path: left,
          pathClusterIndex,
        });
        const rightBarycenter = getPathBarycenter({
          clusterIndex,
          neighborPaths,
          orderIndexByPath,
          path: right,
          pathClusterIndex,
        });

        if (
          leftBarycenter !== null &&
          rightBarycenter !== null &&
          leftBarycenter !== rightBarycenter
        ) {
          return leftBarycenter - rightBarycenter;
        }

        if (leftBarycenter !== null && rightBarycenter === null) {
          return -1;
        }

        if (leftBarycenter === null && rightBarycenter !== null) {
          return 1;
        }

        return comparePathsByReferenceScore({
          entryByPath: input.entryByPath,
          incomingCounts: input.incomingCounts,
          left,
          outgoingCounts: input.outgoingCounts,
          right,
        });
      }),
    );
  }

  const optimizedPaths = new Map<string, string[]>();

  input.clusterNames.forEach((clusterName, index) => {
    optimizedPaths.set(clusterName, clusterPaths[index] ?? []);
  });

  return optimizedPaths;
}

function buildClusterSummaries(input: {
  clusterNames: string[];
  edges: ProjectAnalysisFileReference[];
  entryByPath: Map<string, ProjectAnalysisFileIndexEntry>;
  groupCategoryByPath: Map<string, string>;
}): AnalysisReferenceClusterSummary[] {
  const clusterIndexByName = new Map(input.clusterNames.map((name, index) => [name, index]));
  const summaries = new Map<string, AnalysisReferenceClusterSummary>();

  for (const edge of input.edges) {
    const fromCluster = resolveNodeClusterName(input.entryByPath.get(edge.from)?.layer);
    const toCluster = resolveNodeClusterName(input.entryByPath.get(edge.to)?.layer);
    const fromCategory = input.groupCategoryByPath.get(edge.from) ?? null;
    const toCategory = input.groupCategoryByPath.get(edge.to) ?? null;

    if (fromCluster === toCluster && fromCategory === toCategory) {
      continue;
    }

    const isInternal = fromCluster === toCluster;
    const key = isInternal
      ? `${fromCluster}|${fromCategory ?? 'support'}|${toCategory ?? 'support'}`
      : `${fromCluster}|${toCluster}`;
    const currentSummary = summaries.get(key);
    if (currentSummary) {
      currentSummary.count += 1;
      continue;
    }

    summaries.set(key, {
      count: 1,
      fromCategory: isInternal ? fromCategory : null,
      fromCluster,
      isInternal,
      key,
      toCategory: isInternal ? toCategory : null,
      toCluster,
    });
  }

  return [...summaries.values()].sort((left, right) => {
    const leftFromIndex = clusterIndexByName.get(left.fromCluster) ?? Number.MAX_SAFE_INTEGER;
    const rightFromIndex = clusterIndexByName.get(right.fromCluster) ?? Number.MAX_SAFE_INTEGER;
    if (leftFromIndex !== rightFromIndex) {
      return leftFromIndex - rightFromIndex;
    }

    const leftToIndex = clusterIndexByName.get(left.toCluster) ?? Number.MAX_SAFE_INTEGER;
    const rightToIndex = clusterIndexByName.get(right.toCluster) ?? Number.MAX_SAFE_INTEGER;
    if (leftToIndex !== rightToIndex) {
      return leftToIndex - rightToIndex;
    }

    if (left.isInternal !== right.isInternal) {
      return left.isInternal ? 1 : -1;
    }

    return right.count - left.count;
  });
}

function buildNeighborPathMap(edges: ProjectAnalysisFileReference[]): Map<string, Set<string>> {
  const neighborPaths = new Map<string, Set<string>>();

  for (const edge of edges) {
    const fromNeighbors = neighborPaths.get(edge.from) ?? new Set<string>();
    fromNeighbors.add(edge.to);
    neighborPaths.set(edge.from, fromNeighbors);

    const toNeighbors = neighborPaths.get(edge.to) ?? new Set<string>();
    toNeighbors.add(edge.from);
    neighborPaths.set(edge.to, toNeighbors);
  }

  return neighborPaths;
}

function getPathBarycenter(input: {
  clusterIndex: number;
  neighborPaths: Map<string, Set<string>>;
  orderIndexByPath: Map<string, number>;
  path: string;
  pathClusterIndex: Map<string, number>;
}): number | null {
  const neighbors = input.neighborPaths.get(input.path);
  if (!neighbors || neighbors.size === 0) {
    return null;
  }

  let weightedIndexSum = 0;
  let totalWeight = 0;

  for (const neighborPath of neighbors) {
    const neighborIndex = input.orderIndexByPath.get(neighborPath);
    const neighborClusterIndex = input.pathClusterIndex.get(neighborPath);
    if (neighborIndex === undefined || neighborClusterIndex === undefined) {
      continue;
    }

    const clusterDistance = Math.abs(neighborClusterIndex - input.clusterIndex);
    if (clusterDistance === 0) {
      continue;
    }

    const weight = 1 / clusterDistance;
    weightedIndexSum += neighborIndex * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return null;
  }

  return weightedIndexSum / totalWeight;
}

function resolveNodeClusterName(layerName: string | null | undefined): string {
  const normalizedLayerName = layerName?.trim();
  if (!normalizedLayerName) {
    return '미분류';
  }

  const segments = normalizedLayerName.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return normalizedLayerName;
  }

  return segments.slice(0, -1).join('/') || normalizedLayerName;
}

function resolveClusterAreaName(clusterName: string): string {
  const [areaName = clusterName] = clusterName.split('/').filter(Boolean);
  return areaName;
}

function resolveAreaDisplayName(areaName: string): string {
  switch (areaName) {
    case 'api':
      return 'API';
    case 'application':
      return '애플리케이션';
    case 'client':
      return '클라이언트';
    case 'config':
      return '설정';
    case 'core':
      return '코어';
    case 'domain':
      return '도메인';
    case 'entrypoint':
      return '진입점';
    case 'infrastructure':
      return '인프라';
    case 'main':
      return '메인';
    case 'packages':
      return '패키지';
    case 'preload':
      return 'preload';
    case 'renderer':
      return '렌더러';
    case 'server':
      return '서버';
    case 'shared':
      return '공용';
    case 'src':
      return '소스';
    case 'test':
      return '테스트';
    case 'types':
      return '타입';
    case 'util':
    case 'utils':
      return '유틸리티';
    case '미분류':
      return '미분류';
    default:
      return areaName;
  }
}

function resolveClusterDisplayName(clusterName: string): string {
  const segments = clusterName.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return resolveAreaDisplayName(clusterName);
  }

  return segments.slice(1).join('/');
}

function getClusterDisplayText(clusterName: string): string {
  const areaName = resolveClusterAreaName(clusterName);
  const areaLabel = resolveAreaDisplayName(areaName);
  const clusterLabel = resolveClusterDisplayName(clusterName);

  return clusterLabel === areaLabel ? areaLabel : `${areaLabel} / ${clusterLabel}`;
}

function comparePathsByReferenceScore(input: {
  entryByPath: Map<string, ProjectAnalysisFileIndexEntry>;
  incomingCounts: Map<string, number>;
  left: string;
  outgoingCounts: Map<string, number>;
  right: string;
}): number {
  const leftCategory = input.entryByPath.get(input.left)?.category ?? 'source';
  const rightCategory = input.entryByPath.get(input.right)?.category ?? 'source';
  const categoryPriorityDifference =
    getNodeCategoryPriority(rightCategory) - getNodeCategoryPriority(leftCategory);
  if (categoryPriorityDifference !== 0) {
    return categoryPriorityDifference;
  }

  const rightOutgoingCount = input.outgoingCounts.get(input.right) ?? 0;
  const leftOutgoingCount = input.outgoingCounts.get(input.left) ?? 0;
  if (rightOutgoingCount !== leftOutgoingCount) {
    return rightOutgoingCount - leftOutgoingCount;
  }

  const rightIncomingCount = input.incomingCounts.get(input.right) ?? 0;
  const leftIncomingCount = input.incomingCounts.get(input.left) ?? 0;
  if (rightIncomingCount !== leftIncomingCount) {
    return rightIncomingCount - leftIncomingCount;
  }

  return input.left.localeCompare(input.right);
}

function getNodeCategoryPriority(category: string): number {
  switch (category) {
    case 'module':
      return 180;
    case 'controller':
      return 170;
    case 'entrypoint':
      return 165;
    case 'command-service':
      return 160;
    case 'query-service':
      return 159;
    case 'service':
      return 155;
    case 'command-handler':
      return 150;
    case 'query-handler':
      return 149;
    case 'handler':
      return 148;
    case 'repository':
      return 145;
    case 'command':
      return 138;
    case 'query':
      return 137;
    case 'dto':
      return 132;
    case 'mapper':
      return 131;
    case 'entity':
      return 130;
    case 'model':
      return 129;
    case 'validator':
      return 128;
    case 'strategy':
    case 'policy':
    case 'guard':
    case 'interceptor':
    case 'filter':
    case 'middleware':
    case 'pipe':
    case 'decorator':
    case 'factory':
    case 'exception':
      return 122;
    case 'type':
      return 110;
    case 'utility':
      return 108;
    case 'source':
    case 'feature':
      return 105;
    case 'config':
      return 102;
    case 'test':
      return 80;
    default:
      return 100;
  }
}

function getRoleGroupPriority(category: string): number {
  switch (category) {
    case 'module':
      return 180;
    case 'controller':
      return 170;
    case 'entrypoint':
      return 165;
    case 'command-service':
      return 160;
    case 'query-service':
      return 159;
    case 'service':
      return 155;
    case 'command-handler':
      return 150;
    case 'query-handler':
      return 149;
    case 'handler':
      return 148;
    case 'repository':
      return 145;
    case 'command':
      return 138;
    case 'query':
      return 137;
    case 'contract':
      return 132;
    case 'data-model':
      return 130;
    case 'validator':
      return 128;
    case 'policy':
      return 124;
    case 'runtime':
      return 122;
    case 'support':
      return 100;
    case 'test':
      return 80;
    default:
      return getNodeCategoryPriority(category);
  }
}

function resolveRoleGroupCategory(input: { category: string; clusterName: string }): string {
  const areaName = resolveClusterAreaName(input.clusterName);

  switch (input.category) {
    case 'module':
    case 'controller':
    case 'command-service':
    case 'query-service':
    case 'service':
    case 'command-handler':
    case 'query-handler':
    case 'handler':
    case 'repository':
    case 'command':
    case 'query':
    case 'entrypoint':
    case 'config':
    case 'dto':
    case 'type':
    case 'test':
      return input.category;
    case 'entity':
    case 'model':
    case 'mapper':
      return 'data-model';
    case 'validator':
      return areaName === 'api' ? 'validator' : 'policy';
    case 'strategy':
    case 'policy':
    case 'factory':
      return 'policy';
    case 'guard':
    case 'interceptor':
    case 'filter':
    case 'middleware':
    case 'pipe':
    case 'decorator':
    case 'exception':
      return 'runtime';
    case 'utility':
    case 'feature':
    case 'source':
    case '미분류':
      return 'support';
    default:
      return input.category;
  }
}

function resolveRoleGroupDisplayName(category: string): string {
  switch (category) {
    case 'command':
      return '커맨드';
    case 'command-service':
      return '커맨드 서비스';
    case 'command-handler':
      return '커맨드 핸들러';
    case 'contract':
      return '계약';
    case 'config':
      return '설정 파일';
    case 'controller':
      return '컨트롤러';
    case 'data-model':
      return '데이터 모델';
    case 'decorator':
      return '데코레이터';
    case 'dto':
      return 'DTO';
    case 'entity':
      return '엔티티';
    case 'entrypoint':
      return '진입점';
    case 'exception':
      return '예외';
    case 'factory':
      return '팩토리';
    case 'feature':
      return '기능';
    case 'filter':
      return '필터';
    case 'guard':
      return '가드';
    case 'handler':
      return '핸들러';
    case 'interceptor':
      return '인터셉터';
    case 'mapper':
      return '매퍼';
    case 'middleware':
      return '미들웨어';
    case 'model':
      return '모델';
    case 'module':
      return '모듈';
    case 'pipe':
      return '파이프';
    case 'policy':
      return '정책';
    case 'query':
      return '쿼리';
    case 'query-service':
      return '쿼리 서비스';
    case 'query-handler':
      return '쿼리 핸들러';
    case 'repository':
      return '레포지토리';
    case 'runtime':
      return '런타임 훅';
    case 'service':
      return '서비스';
    case 'source':
      return '소스';
    case 'strategy':
      return '전략';
    case 'support':
      return '지원 코드';
    case 'test':
      return '테스트';
    case 'type':
      return '타입';
    case 'utility':
      return '유틸리티';
    case 'validator':
      return '검증';
    case '미분류':
      return '미분류';
    default:
      return category.replace(/-/gu, ' ');
  }
}

function getReferenceSummary(entry: ProjectAnalysisFileIndexEntry | undefined): string {
  if (!entry?.summary) {
    return '에이전트가 이 파일에 대한 요약을 아직 남기지 않았습니다.';
  }

  return entry.summary;
}

function getPathDisplayName(path: string): string {
  const pathSegments = path.split('/');
  return pathSegments[pathSegments.length - 1] ?? path;
}
