import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';

import {
  createEmptyProjectReferenceTagDocument,
  createProjectReferenceTag,
  type ProjectReferenceTagDocument,
} from '@/domain/project/project-reference-tag-model';
import {
  ReferenceTagManager,
  type ReferenceTagCreateResult,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/reference-tags/ReferenceTagManager';
import {
  buildReferenceTagSummaries,
  removeReferenceTagFromDocument,
  toggleReferenceTagAssignment,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/reference-tags/reference-tag-manager.utils';
import {
  EMPTY_STAGE_SIZE,
  INITIAL_VIEWPORT,
  createStageGridStyle,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/analysis-workspace.utils';
import {
  areViewportsClose,
  buildReferenceGraph,
  buildReferenceLinkPaths,
  createViewportToCenterRect,
  createViewportToFitGraph,
  filterReferenceGraphByAreas,
  getClusterDisplayText,
  getPathDisplayName,
  resolveAreaDisplayName,
  resolveClusterAreaName,
  resolveNodeClusterName,
  resolveReferenceMapViewportFrame,
  resolveRoleGroupDisplayName,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-reference-map.logic';
import { MIN_SELECTED_NODE_FOCUS_SCALE } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-reference-map.constants';
import type {
  AnalysisInteractionState,
  AnalysisReferenceMapProps,
  AnalysisStageSize,
  AnalysisViewport,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-reference-map.types';
import {
  REFERENCE_MAP_VIEWPORT_PRESET,
  clamp,
  getWorkspaceMapNodeFontScale,
  getWorkspaceMapNodeSpacingScale,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/workspace-map.shared';

export function AnalysisReferenceMap(props: AnalysisReferenceMapProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<AnalysisInteractionState | null>(null);
  const isFollowingHomeViewportRef = useRef(true);
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
  const fileIndexEntryByPath = useMemo(
    () => new Map(props.analysis.fileIndex.map((entry) => [entry.path, entry] as const)),
    [props.analysis.fileIndex],
  );
  const unresolvedReferenceCount =
    props.analysis.context.referenceAnalysis.unresolvedFileReferences.length;
  const scanLimitCount = props.analysis.context.referenceAnalysis.scanLimits.length;
  const inferredFileCount = useMemo(
    () =>
      props.analysis.fileIndex.filter((entry) => {
        const categoryStatus = entry.classification?.category.status;
        const layerStatus = entry.classification?.layer?.status ?? null;
        return categoryStatus === 'inferred' || layerStatus === 'inferred';
      }).length,
    [props.analysis.fileIndex],
  );
  const areaScopedPaths = useMemo(() => {
    if (activeAreaNames.length === 0) {
      return null;
    }

    return new Set(
      props.analysis.fileIndex
        .filter((entry) =>
          activeAreaNameSet.has(resolveClusterAreaName(resolveNodeClusterName(entry))),
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
  const filterViewportResetKey = useMemo(
    () => `${activeAreaNames.join('|')}#${activeTagIds.join('|')}`,
    [activeAreaNames, activeTagIds],
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
  const viewportFrame = useMemo(
    () =>
      resolveReferenceMapViewportFrame({
        isInspectorCollapsed,
        stageSize,
      }),
    [isInspectorCollapsed, stageSize],
  );
  const homeViewport = useMemo(() => {
    if (
      !props.isActive ||
      visibleGraph.nodes.length === 0 ||
      stageSize.width === 0 ||
      stageSize.height === 0
    ) {
      return null;
    }

    return createViewportToFitGraph({
      graph: visibleGraph,
      stageSize,
      viewportFrame,
    });
  }, [props.isActive, stageSize, viewportFrame, visibleGraph]);
  const areaSummaries = useMemo(
    () => graph.areas.map((area) => ({ count: area.count, label: area.label, name: area.name })),
    [graph.areas],
  );
  const selectedNode = useMemo(
    () => visibleGraph.nodes.find((node) => node.path === selectedPath) ?? null,
    [selectedPath, visibleGraph.nodes],
  );
  const selectedEntry = useMemo(
    () => (selectedNode ? (fileIndexEntryByPath.get(selectedNode.path) ?? null) : null),
    [fileIndexEntryByPath, selectedNode],
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
  const isAtHomeViewport = useMemo(
    () => (homeViewport ? areViewportsClose(viewport, homeViewport) : true),
    [homeViewport, viewport],
  );

  useEffect(() => {
    setActiveAreaNames([]);
    setSelectedPath(null);
    isFollowingHomeViewportRef.current = true;
    setViewport(INITIAL_VIEWPORT);
  }, [props.analysis.fileIndex, props.analysis.context.fileReferences]);

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
    isFollowingHomeViewportRef.current = true;
    setViewport(INITIAL_VIEWPORT);
  }, [filterViewportResetKey]);

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
    if (!props.isActive || !homeViewport) {
      return;
    }

    if (!isFollowingHomeViewportRef.current) {
      return;
    }

    setViewport((current) => (areViewportsClose(current, homeViewport) ? current : homeViewport));
  }, [homeViewport, props.isActive]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const stageElement = stageRef.current;
      const interaction = interactionRef.current;
      if (!stageElement || !interaction) {
        return;
      }

      const deltaX = event.clientX - interaction.startClientX;
      const deltaY = event.clientY - interaction.startClientY;
      const hasMoved = interaction.moved || Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2;

      interactionRef.current = {
        ...interaction,
        moved: hasMoved,
      };

      if (hasMoved) {
        isFollowingHomeViewportRef.current = false;
      }
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
        edges: visibleGraph.edges,
        nodes: visibleGraph.nodes,
        selectedPath,
        stageSize,
        viewport,
      }),
    [selectedPath, stageSize, viewport, visibleGraph.edges, visibleGraph.nodes],
  );

  const returnToHomeViewport = () => {
    if (!homeViewport) {
      return;
    }

    isFollowingHomeViewportRef.current = true;
    setViewport(homeViewport);
  };

  const focusSelectedNodeInViewport = () => {
    if (!selectedNode) {
      return;
    }

    isFollowingHomeViewportRef.current = false;
    setViewport((current) =>
      createViewportToCenterRect({
        rect: selectedNode,
        scale: Math.max(current.scale, MIN_SELECTED_NODE_FOCUS_SCALE),
        stageSize,
        viewportFrame,
      }),
    );
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

    isFollowingHomeViewportRef.current = false;
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

            isFollowingHomeViewportRef.current = false;
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
            <div className="analysis-map__zoom-badge">
              {Math.round(viewport.scale * 100)}% · {isAtHomeViewport ? '기준' : '이동 중'}
            </div>
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
                aria-label="원위치로 돌아가기"
                className="analysis-map__control-button"
                disabled={!homeViewport}
                onClick={returnToHomeViewport}
                title={isAtHomeViewport ? '기준 위치' : '원위치로 돌아가기'}
                type="button"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20">
                  <path
                    d="M4 9.5 10 4l6 5.5M6.5 8.8V16h7V8.8"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </button>
              {selectedNode ? (
                <button
                  aria-label="선택 카드 위치로 이동"
                  className="analysis-map__control-button"
                  onClick={focusSelectedNodeInViewport}
                  title="선택 카드 위치로 이동"
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 20 20">
                    <path
                      d="M10 4v12M4 10h12M10 7.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                </button>
              ) : null}
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
                    : unresolvedReferenceCount > 0
                      ? '해결된 참조선은 없지만 미해결 참조는 있습니다.'
                      : '파일 참조 맵이 아직 없습니다.'}
                </h3>
                <p className="analysis-empty-panel__description">
                  {hasActiveFilters
                    ? '영역 또는 태그 선택을 조정해 다른 파일 관계를 확인해 주세요.'
                    : unresolvedReferenceCount > 0
                      ? '오른쪽 요약에서 미해결 참조와 스캔 상태를 먼저 확인해 주세요.'
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
                        selectedNode?.area === area.name || activeAreaNameSet.has(area.name)
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
                  <span className="analysis-reference-map__stat">
                    <span className="analysis-reference-map__summary-label">미해결</span>
                    <strong className="analysis-reference-map__summary-value">
                      {unresolvedReferenceCount}건
                    </strong>
                  </span>
                </div>
              </div>

              {graph.isReduced ? (
                <p className="analysis-reference-map__empty-copy">
                  대규모 참조 맵이라 대표 파일 {graph.retainedNodeCount}/{graph.totalNodeCount}
                  개와 참조선 {graph.edges.length}/{graph.totalEdgeCount}건만 우선 표시합니다.
                  영역이나 태그로 좁히면 더 가볍게 확인할 수 있습니다.
                </p>
              ) : null}

              {unresolvedReferenceCount > 0 || scanLimitCount > 0 || inferredFileCount > 0 ? (
                <p className="analysis-reference-map__empty-copy">
                  {compactDiagnosticsText({
                    inferredFileCount,
                    scanLimitCount,
                    unresolvedReferenceCount,
                  })}
                </p>
              ) : null}

              <div className="analysis-reference-map__filter-panel">
                <div className="analysis-reference-map__filter-header">
                  <span className="analysis-reference-map__eyebrow">영역 선택</span>
                </div>
                <div className="analysis-reference-map__layers">
                  <button
                    aria-pressed={activeAreaNames.length === 0}
                    className={`analysis-reference-map__layer-chip ${
                      activeAreaNames.length === 0
                        ? 'analysis-reference-map__layer-chip--active'
                        : ''
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
                          onClick={focusSelectedNodeInViewport}
                          type="button"
                        >
                          카드 위치로 이동
                        </button>
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
                      {selectedEntry?.classification?.category.status &&
                      selectedEntry.classification.category.status !== 'confirmed' ? (
                        <span className="analysis-reference-map__meta-chip">
                          분류 {selectedEntry.classification.category.status}
                        </span>
                      ) : null}
                      {(selectedEntry?.unresolvedReferences?.length ?? 0) > 0 ? (
                        <span className="analysis-reference-map__meta-chip">
                          미해결 {selectedEntry?.unresolvedReferences?.length ?? 0}건
                        </span>
                      ) : null}
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

function compactDiagnosticsText(input: {
  inferredFileCount: number;
  scanLimitCount: number;
  unresolvedReferenceCount: number;
}): string {
  const parts: string[] = [];

  if (input.unresolvedReferenceCount > 0) {
    parts.push(`미해결 참조 ${input.unresolvedReferenceCount}건`);
  }

  if (input.scanLimitCount > 0) {
    parts.push(`스캔 한도 도달 ${input.scanLimitCount}건`);
  }

  if (input.inferredFileCount > 0) {
    parts.push(`추정 분류 파일 ${input.inferredFileCount}개`);
  }

  return parts.join(' · ');
}
