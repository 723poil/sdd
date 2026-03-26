import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';
import { SPECS_BOARD_LAYOUT_PRESET } from '@/renderer/features/project-bootstrap/project-bootstrap-page/workspace-map.shared';
import {
  buildWorkspaceBoardLinkPaths,
  createStageGridStyle as createSharedStageGridStyle,
  createViewportToFitBoardNodes,
  type WorkspaceBoardLinkLike,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/workspace-board-map/workspace-board-map.utils';
import {
  describeSpecRelationType,
  describeSpecStatus,
  describeSpecVersionBadge,
  formatSpecDayLabel,
  getSpecSummary,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/specs-workspace/specs-workspace.utils';

export interface SpecBoardNode {
  hasConflict: boolean;
  height: number;
  id: string;
  isArchived: boolean;
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

export interface SpecsStageSize {
  height: number;
  width: number;
}

export interface SpecsViewport {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export interface SpecRenderedLink {
  from: string;
  key: string;
  label: string;
  midX: number;
  midY: number;
  path: string;
  to: string;
}

interface SpecBoardLink extends WorkspaceBoardLinkLike {}

export function buildSpecBoardNodes(
  specs: ProjectSpecDocument[],
  specConflictBySpecId: Record<string, boolean>,
): SpecBoardNode[] {
  const orderedSpecs = [...specs].sort(compareSpecsForBoardLayout);
  const relationFocusedPositions = createRelationFocusedSpecBoardPositions(orderedSpecs);
  const columnCount = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(specs.length))));
  const totalWidth =
    columnCount * SPECS_BOARD_LAYOUT_PRESET.cardWidth +
    Math.max(columnCount - 1, 0) * SPECS_BOARD_LAYOUT_PRESET.columnGap;
  const startX = -totalWidth / 2;
  const startY = -SPECS_BOARD_LAYOUT_PRESET.cardHeight / 2;

  return orderedSpecs.map((spec, index) => {
    const columnIndex = index % columnCount;
    const rowIndex = Math.floor(index / columnCount);

    return {
      hasConflict: Boolean(specConflictBySpecId[spec.meta.id]),
      height: SPECS_BOARD_LAYOUT_PRESET.cardHeight,
      id: spec.meta.id,
      isArchived: spec.meta.status === 'archived',
      slug: spec.meta.slug,
      status: describeSpecStatus(spec.meta.status),
      summary: getSpecSummary(spec),
      title: spec.meta.title,
      updatedAtLabel: formatSpecDayLabel(spec.meta.updatedAt),
      version: describeSpecVersionBadge(spec),
      width: SPECS_BOARD_LAYOUT_PRESET.cardWidth,
      x:
        relationFocusedPositions?.[spec.meta.id]?.x ??
        (startX +
          columnIndex * (SPECS_BOARD_LAYOUT_PRESET.cardWidth + SPECS_BOARD_LAYOUT_PRESET.columnGap) +
          (rowIndex % 2 === 0 ? 0 : SPECS_BOARD_LAYOUT_PRESET.rowOffset)),
      y:
        relationFocusedPositions?.[spec.meta.id]?.y ??
        (startY +
          rowIndex * (SPECS_BOARD_LAYOUT_PRESET.cardHeight + SPECS_BOARD_LAYOUT_PRESET.rowGap)),
    };
  });
}

export function buildSpecLinkPaths(
  nodes: SpecBoardNode[],
  specs: ProjectSpecDocument[],
  stageSize: SpecsStageSize,
  viewport: SpecsViewport,
): SpecRenderedLink[] {
  return buildWorkspaceBoardLinkPaths(nodes, buildSpecBoardLinks(specs), stageSize, viewport);
}

export function createViewportToFitNodes(
  nodes: SpecBoardNode[],
  stageSize: SpecsStageSize,
): SpecsViewport {
  return createViewportToFitBoardNodes(nodes, stageSize);
}

export function createStageGridStyle(viewport: SpecsViewport): Record<string, string> {
  return createSharedStageGridStyle(viewport);
}

function buildSpecBoardLinks(specs: ProjectSpecDocument[]): SpecBoardLink[] {
  const nodeBySpecId = new Map(specs.map((spec) => [spec.meta.id, spec] as const));
  const groupedLabels = new Map<string, string[]>();

  for (const spec of specs) {
    for (const relation of spec.meta.relations) {
      if (!nodeBySpecId.has(relation.targetSpecId)) {
        continue;
      }

      const key = `${relation.targetSpecId}::${spec.meta.id}`;
      const currentLabels = groupedLabels.get(key) ?? [];
      const nextLabel = describeSpecRelationType(relation.type);
      if (!currentLabels.includes(nextLabel)) {
        currentLabels.push(nextLabel);
      }
      groupedLabels.set(key, currentLabels);
    }
  }

  return [...groupedLabels.entries()].map(([key, labels]) => {
    const [from, to] = key.split('::');

    return {
      from: from ?? '',
      to: to ?? '',
      label: labels.join(' · '),
    };
  });
}

function compareSpecsForBoardLayout(left: ProjectSpecDocument, right: ProjectSpecDocument): number {
  const createdAtOrder = left.meta.createdAt.localeCompare(right.meta.createdAt);
  if (createdAtOrder !== 0) {
    return createdAtOrder;
  }

  const slugOrder = left.meta.slug.localeCompare(right.meta.slug, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  if (slugOrder !== 0) {
    return slugOrder;
  }

  return left.meta.id.localeCompare(right.meta.id, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function createRelationFocusedSpecBoardPositions(
  specs: ProjectSpecDocument[],
): Record<string, { x: number; y: number }> | null {
  if (specs.length !== 3) {
    return null;
  }

  const boardLinks = buildSpecBoardLinks(specs);
  if (boardLinks.length !== 2) {
    return null;
  }

  const outgoingLinksBySpecId = new Map<string, string[]>();
  for (const link of boardLinks) {
    const links = outgoingLinksBySpecId.get(link.from) ?? [];
    links.push(link.to);
    outgoingLinksBySpecId.set(link.from, links);
  }

  const pivotEntry = [...outgoingLinksBySpecId.entries()].find(([, targets]) => targets.length === 2);
  if (!pivotEntry) {
    return null;
  }

  const [pivotSpecId, targetSpecIds] = pivotEntry;
  const uniqueTargetSpecIds = [...new Set(targetSpecIds)];
  if (uniqueTargetSpecIds.length !== 2) {
    return null;
  }

  const pivotSpec = specs.find((spec) => spec.meta.id === pivotSpecId);
  const targetSpecs = uniqueTargetSpecIds
    .map((targetSpecId) => specs.find((spec) => spec.meta.id === targetSpecId) ?? null)
    .filter((spec): spec is ProjectSpecDocument => spec !== null)
    .sort(compareSpecsForBoardLayout);

  if (!pivotSpec || targetSpecs.length !== 2) {
    return null;
  }
  const [topTargetSpec, bottomTargetSpec] = targetSpecs;
  if (!topTargetSpec || !bottomTargetSpec) {
    return null;
  }

  const leftColumnX = -(
    SPECS_BOARD_LAYOUT_PRESET.cardWidth + SPECS_BOARD_LAYOUT_PRESET.columnGap / 2
  );
  const rightColumnX = SPECS_BOARD_LAYOUT_PRESET.columnGap / 2;
  const topRowY = -SPECS_BOARD_LAYOUT_PRESET.cardHeight / 2;
  const bottomRowY = topRowY + SPECS_BOARD_LAYOUT_PRESET.cardHeight + SPECS_BOARD_LAYOUT_PRESET.rowGap;
  const middleRowY = Math.round((topRowY + bottomRowY) / 2);
  const positions: Record<string, { x: number; y: number }> = {
    [pivotSpec.meta.id]: {
      x: rightColumnX,
      y: middleRowY,
    },
    [topTargetSpec.meta.id]: {
      x: leftColumnX,
      y: topRowY,
    },
    [bottomTargetSpec.meta.id]: {
      x: leftColumnX,
      y: bottomRowY,
    },
  };

  if (Object.keys(positions).length !== specs.length) {
    return null;
  }

  return positions;
}
