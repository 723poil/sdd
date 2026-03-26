import type {
  ProjectAnalysisFileIndexEntry,
  ProjectAnalysisFileReference,
} from '@/domain/project/project-analysis-model';
import {
  AREA_GAP,
  AREA_HEADER_HEIGHT,
  AREA_PADDING_BOTTOM,
  AREA_PADDING_TOP,
  AREA_PADDING_X,
  CLUSTER_COLUMN_GAP,
  CLUSTER_HEADER_HEIGHT,
  CLUSTER_PADDING_BOTTOM,
  CLUSTER_PADDING_TOP,
  CLUSTER_PADDING_X,
  CLUSTER_STACK_GAP,
  DEFAULT_AREA_WIDTH,
  LARGE_REFERENCE_GRAPH_EDGE_THRESHOLD,
  LARGE_REFERENCE_GRAPH_FILE_THRESHOLD,
  MAX_CLUSTER_ORDERING_OPTIMIZATION_FILE_COUNT,
  MAX_REFERENCE_GRAPH_EDGE_COUNT,
  MAX_REFERENCE_GRAPH_FILE_COUNT,
  MAX_RETAINED_CLUSTER_FILE_COUNT,
  MIN_AREA_HEIGHT,
  MIN_RETAINED_CLUSTER_FILE_COUNT,
  NODE_CARD_CONTENT_GAP,
  NODE_CARD_VERTICAL_PADDING,
  NODE_FILE_LINE_HEIGHT,
  NODE_FILE_MAX_LINES,
  NODE_META_CHIP_GAP,
  NODE_META_CHIP_HEIGHT,
  NODE_META_HORIZONTAL_PADDING,
  NODE_META_MIN_WIDTH,
  NODE_META_PIXEL_WIDTH,
  NODE_MIN_HEIGHT,
  NODE_PATH_LINE_HEIGHT,
  NODE_PATH_MAX_LINES,
  NODE_SUMMARY_LINE_HEIGHT,
  NODE_SUMMARY_MAX_LINES,
  NODE_SUMMARY_PIXEL_WIDTH,
  NODE_TEXT_PIXEL_WIDTH,
  NODE_VERTICAL_GAP,
  OVERVIEW_PREVIEW_NODE_LIMIT,
  REFERENCE_MAP_MOBILE_BREAKPOINT,
  REFERENCE_MAP_OVERLAY_INSET_DESKTOP,
  REFERENCE_MAP_OVERLAY_INSET_MOBILE,
  REFERENCE_MAP_OVERLAY_MAX_WIDTH_DESKTOP,
  REFERENCE_MAP_OVERLAY_MAX_WIDTH_MOBILE,
  REFERENCE_MAP_VIEWPORT_FRAME_GAP,
  ROLE_GROUP_COLUMNS,
  ROLE_GROUP_GAP,
  ROLE_GROUP_HEADER_HEIGHT,
  ROLE_GROUP_MIN_TWO_COLUMN_WIDTH,
  ROLE_GROUP_PADDING_BOTTOM,
  ROLE_GROUP_PADDING_TOP,
  ROLE_GROUP_PADDING_X,
  ROLE_GROUP_PREVIEW_FOOTER_GAP,
  ROLE_GROUP_PREVIEW_FOOTER_HEIGHT,
  SINGLE_AREA_WIDTH,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-reference-map.constants';
import type {
  AnalysisRect,
  AnalysisReferenceArea,
  AnalysisReferenceBuildOptions,
  AnalysisReferenceCluster,
  AnalysisReferenceGraph,
  AnalysisReferenceLink,
  AnalysisReferenceNode,
  AnalysisReferenceRoleGroup,
  AnalysisRoleGroupEntry,
  AnalysisRoleGroupLayout,
  AnalysisStageSize,
  AnalysisViewport,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-reference-map.types';
import type { StructuredProjectAnalysis } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';
import {
  REFERENCE_GRAPH_TOP_OVERFLOW,
  REFERENCE_MAP_VIEWPORT_PRESET,
  clamp,
  getWorkspaceMapFitScale,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/workspace-map.shared';
import { buildReferenceTagIdsByPath } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/reference-tags/reference-tag-manager.utils';

export function buildReferenceGraph(
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
  const referencedPaths = new Set<string>();

  for (const entry of analysis.fileIndex) {
    const path = entry.path;
    if (
      options.activeTagIds.size > 0 &&
      !(tagIdsByPath.get(path)?.some((tagId) => options.activeTagIds.has(tagId)) ?? false)
    ) {
      continue;
    }

    referencedPaths.add(path);
  }

  const allEdges = deduplicateFileReferences(analysis.context.fileReferences).filter(
    (edge) =>
      indexedPaths.has(edge.from) &&
      indexedPaths.has(edge.to) &&
      referencedPaths.has(edge.from) &&
      referencedPaths.has(edge.to),
  );

  for (const edge of allEdges) {
    outgoingCounts.set(edge.from, (outgoingCounts.get(edge.from) ?? 0) + 1);
    incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1);
  }

  const clusterNames = resolveOrderedClusterNames(analysis, entryByPath, referencedPaths);
  const groupedPaths = new Map<string, string[]>();

  for (const clusterName of clusterNames) {
    groupedPaths.set(clusterName, []);
  }

  for (const path of referencedPaths) {
    const clusterName = resolveNodeClusterName(entryByPath.get(path));
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

  const graphSelection = selectReferenceGraphSelection({
    clusterNames,
    edges: allEdges,
    entryByPath,
    groupedPaths,
    incomingCounts,
    outgoingCounts,
  });
  const orderedPathsByCluster =
    graphSelection.selectedPathCount <= MAX_CLUSTER_ORDERING_OPTIMIZATION_FILE_COUNT
      ? optimizeClusterNodeOrdering({
          clusterNames: graphSelection.clusterNames,
          edges: graphSelection.edges,
          entryByPath,
          groupedPaths: graphSelection.groupedPaths,
          incomingCounts,
          outgoingCounts,
        })
      : graphSelection.groupedPaths;
  const areaNames = resolveOrderedAreaNames(graphSelection.clusterNames);
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

    const areaClusters = graphSelection.clusterNames.filter(
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
      const nodeWidth = groupWidth - ROLE_GROUP_PADDING_X * 2;
      const groupLayouts: AnalysisRoleGroupLayout[] = groupEntries.map((groupEntry) => {
        const nodeHeights = groupEntry.visiblePaths.map((path) => {
          const entry = entryByPath.get(path);
          const summary = getReferenceSummary(entry);
          const role = entry?.role ?? '참조 파일';
          const incomingCount = incomingCounts.get(path) ?? 0;
          const outgoingCount = outgoingCounts.get(path) ?? 0;
          const tagLabels = resolveReferenceNodeTagLabels({
            path,
            tagIdsByPath,
            tagLabelById,
          });
          const metaLabels = buildReferenceNodeMetaLabels({
            groupCategory: groupEntry.category,
            incomingCount,
            outgoingCount,
            role,
            tagCount: tagLabels.length,
          });

          return estimateReferenceNodeHeight({
            availableWidth: nodeWidth,
            fileName: getPathDisplayName(path),
            metaLabels,
            path,
            summary,
          });
        });
        const nodeOffsets = buildRowOffsets(nodeHeights, NODE_VERTICAL_GAP);
        const footerHeight =
          groupEntry.hiddenCount > 0
            ? ROLE_GROUP_PREVIEW_FOOTER_GAP + ROLE_GROUP_PREVIEW_FOOTER_HEIGHT
            : 0;
        const nodesHeight =
          nodeHeights.reduce((sum, height) => sum + height, 0) +
          Math.max(0, nodeHeights.length - 1) * NODE_VERTICAL_GAP;

        return {
          ...groupEntry,
          height:
            ROLE_GROUP_HEADER_HEIGHT +
            ROLE_GROUP_PADDING_TOP +
            ROLE_GROUP_PADDING_BOTTOM +
            nodesHeight +
            footerHeight,
          nodeHeights,
          nodeOffsets,
        };
      });
      const groupRowHeights: number[] = [];

      groupLayouts.forEach((groupLayout, groupIndex) => {
        const rowIndex = Math.floor(groupIndex / groupColumnCount);
        groupRowHeights[rowIndex] = Math.max(groupRowHeights[rowIndex] ?? 0, groupLayout.height);
      });

      const clusterBodyHeight =
        groupRowHeights.reduce((sum, height) => sum + height, 0) +
        ROLE_GROUP_GAP * Math.max(0, groupRowHeights.length - 1);

      return {
        clusterHeight:
          CLUSTER_HEADER_HEIGHT + CLUSTER_PADDING_TOP + clusterBodyHeight + CLUSTER_PADDING_BOTTOM,
        clusterName,
        groupColumnCount,
        groupLayouts,
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
        groupCount: clusterLayout.groupLayouts.length,
        height: clusterLayout.clusterHeight,
        key: clusterName,
        label: resolveClusterDisplayName(clusterName),
        name: clusterName,
        width: clusterWidth,
        x: clusterX,
        y: clusterY,
      });

      clusterLayout.groupLayouts.forEach((groupLayout, groupIndex) => {
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
          category: groupLayout.category,
          clusterKey: clusterName,
          count: groupLayout.allPaths.length,
          height: groupLayout.height,
          hiddenCount: groupLayout.hiddenCount,
          isExpanded: groupLayout.isExpanded,
          key: `${clusterName}|${groupLayout.category}`,
          label: resolveRoleGroupDisplayName(groupLayout.category),
          width: clusterLayout.groupWidth,
          x: groupX,
          y: groupY,
        });

        groupLayout.visiblePaths.forEach((path, nodeIndex) => {
          const entry = entryByPath.get(path);
          const tagLabels = resolveReferenceNodeTagLabels({
            path,
            tagIdsByPath,
            tagLabelById,
          });

          nodes.push({
            area: areaName,
            category: entry?.category ?? groupLayout.category,
            cluster: clusterName,
            fileName: getPathDisplayName(path),
            groupCategory: groupLayout.category,
            height: groupLayout.nodeHeights[nodeIndex] ?? NODE_MIN_HEIGHT,
            incomingCount: incomingCounts.get(path) ?? 0,
            layer: entry?.layer ?? null,
            outgoingCount: outgoingCounts.get(path) ?? 0,
            path,
            role: entry?.role ?? '참조 파일',
            summary: getReferenceSummary(entry),
            tagLabels,
            width: nodeWidth,
            x: groupX + ROLE_GROUP_PADDING_X,
            y:
              groupY +
              ROLE_GROUP_HEADER_HEIGHT +
              ROLE_GROUP_PADDING_TOP +
              (groupLayout.nodeOffsets[nodeIndex] ?? 0),
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
    clusters,
    edges: graphSelection.edges,
    isReduced: graphSelection.isReduced,
    nodes,
    retainedNodeCount: graphSelection.selectedPathCount,
    roleGroups,
    totalEdgeCount: allEdges.length,
    totalNodeCount: referencedPaths.size,
  };
}

export function filterReferenceGraphByAreas(
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

  return compactReferenceGraphLayout({
    areas,
    clusters,
    edges,
    isReduced: graph.isReduced,
    nodes,
    retainedNodeCount: graph.retainedNodeCount,
    roleGroups,
    totalEdgeCount: graph.totalEdgeCount,
    totalNodeCount: graph.totalNodeCount,
  });
}

export function buildReferenceLinkPaths(input: {
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

export function createViewportToFitGraph(input: {
  graph: AnalysisReferenceGraph;
  stageSize: AnalysisStageSize;
  viewportFrame: AnalysisRect;
}): AnalysisViewport {
  const bounds = getGraphBounds(input.graph);
  const scale = getWorkspaceMapFitScale({
    boundsWidth: bounds.width,
    boundsHeight: bounds.height,
    stageWidth: input.viewportFrame.width,
    stageHeight: input.viewportFrame.height,
    viewportPreset: REFERENCE_MAP_VIEWPORT_PRESET,
  });
  const frameCenterX = input.viewportFrame.x + input.viewportFrame.width / 2;
  const frameCenterY = input.viewportFrame.y + input.viewportFrame.height / 2;

  return {
    scale,
    offsetX: frameCenterX - input.stageSize.width / 2 - (bounds.minX + bounds.width / 2) * scale,
    offsetY: frameCenterY - input.stageSize.height / 2 - (bounds.minY + bounds.height / 2) * scale,
  };
}

export function createViewportToCenterRect(input: {
  rect: AnalysisRect;
  scale: number;
  stageSize: AnalysisStageSize;
  viewportFrame: AnalysisRect;
}): AnalysisViewport {
  const scale = clamp(
    input.scale,
    REFERENCE_MAP_VIEWPORT_PRESET.minScale,
    REFERENCE_MAP_VIEWPORT_PRESET.maxScale,
  );
  const centerX = input.rect.x + input.rect.width / 2;
  const centerY = input.rect.y + input.rect.height / 2;
  const frameCenterX = input.viewportFrame.x + input.viewportFrame.width / 2;
  const frameCenterY = input.viewportFrame.y + input.viewportFrame.height / 2;

  return {
    scale,
    offsetX: frameCenterX - input.stageSize.width / 2 - centerX * scale,
    offsetY: frameCenterY - input.stageSize.height / 2 - centerY * scale,
  };
}

export function areViewportsClose(left: AnalysisViewport, right: AnalysisViewport): boolean {
  return (
    Math.abs(left.scale - right.scale) < 0.001 &&
    Math.abs(left.offsetX - right.offsetX) < 4 &&
    Math.abs(left.offsetY - right.offsetY) < 4
  );
}

export function resolveReferenceMapViewportFrame(input: {
  isInspectorCollapsed: boolean;
  stageSize: AnalysisStageSize;
}): AnalysisRect {
  const stageWidth = Math.max(input.stageSize.width, 1);
  const stageHeight = Math.max(input.stageSize.height, 1);

  if (input.isInspectorCollapsed) {
    return {
      x: 0,
      y: 0,
      width: stageWidth,
      height: stageHeight,
    };
  }

  const isMobileStage = stageWidth <= REFERENCE_MAP_MOBILE_BREAKPOINT;
  const overlayInset = isMobileStage
    ? REFERENCE_MAP_OVERLAY_INSET_MOBILE
    : REFERENCE_MAP_OVERLAY_INSET_DESKTOP;
  const overlayMaxWidth = isMobileStage
    ? REFERENCE_MAP_OVERLAY_MAX_WIDTH_MOBILE
    : REFERENCE_MAP_OVERLAY_MAX_WIDTH_DESKTOP;
  const overlayWidth = Math.min(overlayMaxWidth, Math.max(stageWidth - overlayInset * 2, 0));
  const occupiedLeftWidth = Math.min(
    stageWidth,
    overlayInset + overlayWidth + REFERENCE_MAP_VIEWPORT_FRAME_GAP,
  );
  const frameX = Math.min(occupiedLeftWidth, stageWidth / 2);
  const frameWidth = Math.max(stageWidth - frameX, stageWidth / 2);

  return {
    x: frameX,
    y: 0,
    width: frameWidth,
    height: stageHeight,
  };
}

export function resolveNodeClusterName(
  entryOrLayer: ProjectAnalysisFileIndexEntry | string | null | undefined,
): string {
  if (entryOrLayer && typeof entryOrLayer === 'object') {
    if (entryOrLayer.grouping?.cluster?.trim()) {
      return entryOrLayer.grouping.cluster.trim();
    }

    if (entryOrLayer.grouping?.area?.trim()) {
      return entryOrLayer.grouping.area.trim();
    }
  }

  const normalizedLayerName =
    typeof entryOrLayer === 'string' ? entryOrLayer.trim() : entryOrLayer?.layer?.trim();
  if (!normalizedLayerName) {
    return '미분류';
  }

  const segments = normalizedLayerName.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return normalizedLayerName;
  }

  return segments.slice(0, -1).join('/') || normalizedLayerName;
}

export function resolveClusterAreaName(clusterName: string): string {
  const segments = clusterName.split('/').filter(Boolean);
  const areaSegmentLength = resolveClusterAreaSegmentLength(segments);
  return segments.slice(0, areaSegmentLength).join('/') || clusterName;
}

export function resolveAreaDisplayName(areaName: string): string {
  const segments = areaName.split('/').filter(Boolean);
  if (segments.length > 1) {
    const [rootAreaName = areaName, ...restSegments] = segments;
    const rootAreaLabel = resolveAreaDisplayName(rootAreaName);
    return `${rootAreaLabel} ${restSegments.join('/')}`.trim();
  }

  switch (areaName) {
    case 'api':
      return 'API';
    case 'apps':
      return '앱';
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
    case 'libs':
      return '라이브러리';
    case 'main':
      return '메인';
    case 'modules':
      return '모듈';
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

export function getClusterDisplayText(clusterName: string): string {
  const areaName = resolveClusterAreaName(clusterName);
  const areaLabel = resolveAreaDisplayName(areaName);
  const clusterLabel = resolveClusterDisplayName(clusterName);

  return clusterLabel === areaLabel ? areaLabel : `${areaLabel} / ${clusterLabel}`;
}

export function resolveRoleGroupDisplayName(category: string): string {
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

export function getPathDisplayName(path: string): string {
  const pathSegments = path.split('/');
  return pathSegments[pathSegments.length - 1] ?? path;
}

function selectReferenceGraphSelection(input: {
  clusterNames: string[];
  edges: ProjectAnalysisFileReference[];
  entryByPath: Map<string, ProjectAnalysisFileIndexEntry>;
  groupedPaths: Map<string, string[]>;
  incomingCounts: Map<string, number>;
  outgoingCounts: Map<string, number>;
}): {
  clusterNames: string[];
  edges: ProjectAnalysisFileReference[];
  groupedPaths: Map<string, string[]>;
  isReduced: boolean;
  selectedPathCount: number;
} {
  const totalPathCount = [...input.groupedPaths.values()].reduce(
    (sum, paths) => sum + paths.length,
    0,
  );
  const shouldReduce =
    totalPathCount > LARGE_REFERENCE_GRAPH_FILE_THRESHOLD ||
    input.edges.length > LARGE_REFERENCE_GRAPH_EDGE_THRESHOLD;
  if (!shouldReduce) {
    return {
      clusterNames: input.clusterNames,
      edges: input.edges,
      groupedPaths: input.groupedPaths,
      isReduced: false,
      selectedPathCount: totalPathCount,
    };
  }

  const reducedGroupedPaths = selectRepresentativeClusterPaths({
    clusterNames: input.clusterNames,
    groupedPaths: input.groupedPaths,
  });
  const selectedPathSet = new Set<string>();
  const reducedClusterNames = input.clusterNames.filter((clusterName) => {
    const paths = reducedGroupedPaths.get(clusterName) ?? [];
    for (const path of paths) {
      selectedPathSet.add(path);
    }

    return paths.length > 0;
  });
  const reducedEdges = selectRepresentativeReferenceEdges({
    edges: input.edges,
    entryByPath: input.entryByPath,
    incomingCounts: input.incomingCounts,
    outgoingCounts: input.outgoingCounts,
    selectedPathSet,
  });

  return {
    clusterNames: reducedClusterNames,
    edges: reducedEdges,
    groupedPaths: reducedGroupedPaths,
    isReduced: true,
    selectedPathCount: selectedPathSet.size,
  };
}

function selectRepresentativeClusterPaths(input: {
  clusterNames: string[];
  groupedPaths: Map<string, string[]>;
}): Map<string, string[]> {
  const selectedPathsByCluster = new Map<string, string[]>();
  const reservedPathCountByCluster = new Map<string, number>();
  const minPerCluster =
    input.clusterNames.length * MIN_RETAINED_CLUSTER_FILE_COUNT <= MAX_REFERENCE_GRAPH_FILE_COUNT
      ? MIN_RETAINED_CLUSTER_FILE_COUNT
      : 1;
  let remainingSlots = MAX_REFERENCE_GRAPH_FILE_COUNT;

  for (const clusterName of input.clusterNames) {
    const sourcePaths = input.groupedPaths.get(clusterName) ?? [];
    const retainedCount = Math.min(
      sourcePaths.length,
      minPerCluster,
      MAX_RETAINED_CLUSTER_FILE_COUNT,
    );
    selectedPathsByCluster.set(clusterName, sourcePaths.slice(0, retainedCount));
    reservedPathCountByCluster.set(clusterName, retainedCount);
    remainingSlots -= retainedCount;
  }

  while (remainingSlots > 0) {
    let didAppend = false;

    for (const clusterName of input.clusterNames) {
      const sourcePaths = input.groupedPaths.get(clusterName) ?? [];
      const selectedPaths = selectedPathsByCluster.get(clusterName) ?? [];
      const nextIndex = reservedPathCountByCluster.get(clusterName) ?? selectedPaths.length;
      if (
        nextIndex >= sourcePaths.length ||
        selectedPaths.length >= MAX_RETAINED_CLUSTER_FILE_COUNT ||
        remainingSlots <= 0
      ) {
        continue;
      }

      selectedPaths.push(sourcePaths[nextIndex] as string);
      selectedPathsByCluster.set(clusterName, selectedPaths);
      reservedPathCountByCluster.set(clusterName, nextIndex + 1);
      remainingSlots -= 1;
      didAppend = true;

      if (remainingSlots <= 0) {
        break;
      }
    }

    if (!didAppend) {
      break;
    }
  }

  return selectedPathsByCluster;
}

function selectRepresentativeReferenceEdges(input: {
  edges: ProjectAnalysisFileReference[];
  entryByPath: Map<string, ProjectAnalysisFileIndexEntry>;
  incomingCounts: Map<string, number>;
  outgoingCounts: Map<string, number>;
  selectedPathSet: Set<string>;
}): ProjectAnalysisFileReference[] {
  const selectedEdges = input.edges.filter(
    (edge) => input.selectedPathSet.has(edge.from) && input.selectedPathSet.has(edge.to),
  );
  if (selectedEdges.length <= MAX_REFERENCE_GRAPH_EDGE_COUNT) {
    return selectedEdges;
  }

  return [...selectedEdges]
    .sort((left, right) =>
      compareEdgesByImportance({
        entryByPath: input.entryByPath,
        incomingCounts: input.incomingCounts,
        left,
        outgoingCounts: input.outgoingCounts,
        right,
      }),
    )
    .slice(0, MAX_REFERENCE_GRAPH_EDGE_COUNT);
}

function compareEdgesByImportance(input: {
  entryByPath: Map<string, ProjectAnalysisFileIndexEntry>;
  incomingCounts: Map<string, number>;
  left: ProjectAnalysisFileReference;
  outgoingCounts: Map<string, number>;
  right: ProjectAnalysisFileReference;
}): number {
  const leftPriority = getEdgeImportanceScore({
    edge: input.left,
    entryByPath: input.entryByPath,
    incomingCounts: input.incomingCounts,
    outgoingCounts: input.outgoingCounts,
  });
  const rightPriority = getEdgeImportanceScore({
    edge: input.right,
    entryByPath: input.entryByPath,
    incomingCounts: input.incomingCounts,
    outgoingCounts: input.outgoingCounts,
  });
  if (leftPriority !== rightPriority) {
    return rightPriority - leftPriority;
  }

  return (
    input.left.from.localeCompare(input.right.from) ||
    input.left.to.localeCompare(input.right.to) ||
    input.left.relationship.localeCompare(input.right.relationship)
  );
}

function getEdgeImportanceScore(input: {
  edge: ProjectAnalysisFileReference;
  entryByPath: Map<string, ProjectAnalysisFileIndexEntry>;
  incomingCounts: Map<string, number>;
  outgoingCounts: Map<string, number>;
}): number {
  const fromCluster = resolveNodeClusterName(input.entryByPath.get(input.edge.from));
  const toCluster = resolveNodeClusterName(input.entryByPath.get(input.edge.to));
  const crossClusterBonus = fromCluster === toCluster ? 0 : 20;
  const fromScore =
    (input.incomingCounts.get(input.edge.from) ?? 0) +
    (input.outgoingCounts.get(input.edge.from) ?? 0);
  const toScore =
    (input.incomingCounts.get(input.edge.to) ?? 0) + (input.outgoingCounts.get(input.edge.to) ?? 0);

  return crossClusterBonus + fromScore + toScore;
}

function compactReferenceGraphLayout(graph: AnalysisReferenceGraph): AnalysisReferenceGraph {
  if (graph.areas.length === 0) {
    return graph;
  }

  const areaOffsets = new Map<string, { x: number; y: number }>();
  const areaColumnCount = resolveAreaColumnCount({
    areaCount: graph.areas.length,
    stageWidth: 0,
  });
  let areaX = 0;
  let areaY = 0;
  let currentAreaRowHeight = 0;

  graph.areas.forEach((area, index) => {
    if (index > 0 && index % areaColumnCount === 0) {
      areaX = 0;
      areaY += currentAreaRowHeight + AREA_GAP;
      currentAreaRowHeight = 0;
    }

    areaOffsets.set(area.name, {
      x: areaX - area.x,
      y: areaY - area.y,
    });
    currentAreaRowHeight = Math.max(currentAreaRowHeight, area.height);
    areaX += area.width + AREA_GAP;
  });

  const areas = graph.areas.map((area) => {
    const offset = areaOffsets.get(area.name);
    if (!offset) {
      return area;
    }

    return {
      ...area,
      x: area.x + offset.x,
      y: area.y + offset.y,
    };
  });
  const clusterAreaByKey = new Map(
    graph.clusters.map((cluster) => [cluster.key, cluster.areaName] as const),
  );
  const clusters = graph.clusters.map((cluster) => {
    const offset = areaOffsets.get(cluster.areaName);
    if (!offset) {
      return cluster;
    }

    return {
      ...cluster,
      x: cluster.x + offset.x,
      y: cluster.y + offset.y,
    };
  });
  const roleGroups = graph.roleGroups.map((group) => {
    const areaName = clusterAreaByKey.get(group.clusterKey);
    const offset = areaName ? areaOffsets.get(areaName) : undefined;
    if (!offset) {
      return group;
    }

    return {
      ...group,
      x: group.x + offset.x,
      y: group.y + offset.y,
    };
  });
  const nodes = graph.nodes.map((node) => {
    const offset = areaOffsets.get(node.area);
    if (!offset) {
      return node;
    }

    return {
      ...node,
      x: node.x + offset.x,
      y: node.y + offset.y,
    };
  });

  return {
    ...graph,
    areas,
    clusters,
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

      return {
        allPaths,
        category,
        hiddenCount,
        isExpanded,
        visiblePaths,
      };
    });
}

function resolveReferenceNodeTagLabels(input: {
  path: string;
  tagIdsByPath: Map<string, string[]>;
  tagLabelById: Map<string, string>;
}): string[] {
  return (input.tagIdsByPath.get(input.path) ?? [])
    .map((tagId) => input.tagLabelById.get(tagId))
    .filter((tagLabel): tagLabel is string => Boolean(tagLabel));
}

function buildReferenceNodeMetaLabels(input: {
  groupCategory: string;
  incomingCount: number;
  outgoingCount: number;
  role: string;
  tagCount: number;
}): string[] {
  const labels = [input.role, resolveRoleGroupDisplayName(input.groupCategory)];

  if (input.tagCount > 0) {
    labels.push(`태그 ${input.tagCount}`);
  }

  labels.push(`나감 ${input.outgoingCount}`);
  labels.push(`들어옴 ${input.incomingCount}`);

  return labels;
}

function estimateReferenceNodeHeight(input: {
  availableWidth: number;
  fileName: string;
  metaLabels: string[];
  path: string;
  summary: string;
}): number {
  const contentWidth = Math.max(120, input.availableWidth);
  const fileLineCount = estimateTextLineCount({
    availableWidth: contentWidth,
    maxLines: NODE_FILE_MAX_LINES,
    pixelWidthPerUnit: NODE_TEXT_PIXEL_WIDTH,
    text: input.fileName,
  });
  const pathLineCount = estimateTextLineCount({
    availableWidth: contentWidth,
    maxLines: NODE_PATH_MAX_LINES,
    pixelWidthPerUnit: NODE_TEXT_PIXEL_WIDTH,
    text: input.path,
  });
  const summaryLineCount = estimateTextLineCount({
    availableWidth: contentWidth,
    maxLines: NODE_SUMMARY_MAX_LINES,
    pixelWidthPerUnit: NODE_SUMMARY_PIXEL_WIDTH,
    text: input.summary,
  });
  const metaRowCount = estimateChipRowCount({
    availableWidth: contentWidth,
    labels: input.metaLabels,
  });
  const height =
    NODE_CARD_VERTICAL_PADDING * 2 +
    fileLineCount * NODE_FILE_LINE_HEIGHT +
    NODE_CARD_CONTENT_GAP +
    pathLineCount * NODE_PATH_LINE_HEIGHT +
    NODE_CARD_CONTENT_GAP +
    summaryLineCount * NODE_SUMMARY_LINE_HEIGHT +
    NODE_CARD_CONTENT_GAP +
    metaRowCount * NODE_META_CHIP_HEIGHT +
    Math.max(0, metaRowCount - 1) * NODE_META_CHIP_GAP;

  return Math.max(NODE_MIN_HEIGHT, Math.ceil(height));
}

function estimateTextLineCount(input: {
  availableWidth: number;
  maxLines: number;
  pixelWidthPerUnit: number;
  text: string;
}): number {
  const safeWidth = Math.max(input.availableWidth, 1);
  const estimatedWidth = estimateTextVisualUnits(input.text) * input.pixelWidthPerUnit;
  return clamp(Math.ceil(estimatedWidth / safeWidth), 1, input.maxLines);
}

function estimateChipRowCount(input: { availableWidth: number; labels: string[] }): number {
  if (input.labels.length === 0) {
    return 1;
  }

  const safeWidth = Math.max(input.availableWidth, 1);
  let currentRowWidth = 0;
  let rowCount = 1;

  for (const label of input.labels) {
    const chipWidth = Math.min(
      safeWidth,
      Math.max(
        NODE_META_MIN_WIDTH,
        Math.ceil(
          estimateTextVisualUnits(label) * NODE_META_PIXEL_WIDTH + NODE_META_HORIZONTAL_PADDING,
        ),
      ),
    );

    if (currentRowWidth > 0 && currentRowWidth + NODE_META_CHIP_GAP + chipWidth > safeWidth) {
      rowCount += 1;
      currentRowWidth = chipWidth;
      continue;
    }

    currentRowWidth += currentRowWidth > 0 ? NODE_META_CHIP_GAP + chipWidth : chipWidth;
  }

  return rowCount;
}

function estimateTextVisualUnits(text: string): number {
  let total = 0;

  for (const character of text) {
    if (character === ' ') {
      total += 0.45;
      continue;
    }

    if (character <= '\u007f') {
      if (character === '/' || character === '.' || character === '_' || character === '-') {
        total += 0.72;
        continue;
      }

      total += 0.96;
      continue;
    }

    total += 1.68;
  }

  return total;
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
  if (input.areaCount <= 2) {
    return Math.max(1, input.areaCount);
  }

  const balancedColumnCount = Math.ceil(Math.sqrt(input.areaCount));
  if (input.stageWidth <= 0) {
    return balancedColumnCount;
  }

  const stageColumnHint = Math.max(
    1,
    Math.round(input.stageWidth / (DEFAULT_AREA_WIDTH + AREA_GAP)),
  );

  return clamp(Math.max(balancedColumnCount, stageColumnHint), 1, input.areaCount);
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

function resolveOrderedClusterNames(
  analysis: StructuredProjectAnalysis,
  entryByPath: Map<string, ProjectAnalysisFileIndexEntry>,
  referencedPaths: Set<string>,
): string[] {
  const preferredOrder = analysis.context.layers
    .map((layer) => resolveNodeClusterName(layer.name))
    .filter((name, index, names) => names.indexOf(name) === index);
  const discoveredNames = [...referencedPaths].map((path) =>
    resolveNodeClusterName(entryByPath.get(path)),
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

function resolveClusterDisplayName(clusterName: string): string {
  const segments = clusterName.split('/').filter(Boolean);
  const areaSegmentLength = resolveClusterAreaSegmentLength(segments);
  if (segments.length <= areaSegmentLength) {
    return resolveAreaDisplayName(clusterName);
  }

  return segments.slice(areaSegmentLength).join('/');
}

function resolveClusterAreaSegmentLength(segments: string[]): number {
  const [rootSegment, packageName] = segments;
  if (
    rootSegment &&
    packageName &&
    (rootSegment === 'apps' ||
      rootSegment === 'libs' ||
      rootSegment === 'modules' ||
      rootSegment === 'packages')
  ) {
    return 2;
  }

  return 1;
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

function getReferenceSummary(entry: ProjectAnalysisFileIndexEntry | undefined): string {
  if (!entry?.summary) {
    return '에이전트가 이 파일에 대한 요약을 아직 남기지 않았습니다.';
  }

  return entry.summary;
}
