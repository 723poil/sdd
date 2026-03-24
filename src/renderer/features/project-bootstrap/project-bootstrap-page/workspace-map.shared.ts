import type { ProjectAnalysisDocumentId } from '@/domain/project/project-analysis-model';

interface WorkspaceMapViewportPreset {
  fitMaxScale: number;
  fitMinScale: number;
  maxScale: number;
  minScale: number;
  viewportPadding: number;
}

interface WorkspaceMapNodeScalePreset {
  fontMaxScale: number;
  fontMinScale: number;
  fontRatio: number;
  spacingMaxScale: number;
  spacingMinScale: number;
  spacingRatio: number;
}

interface WorkspaceMapFitScaleInput {
  boundsHeight: number;
  boundsWidth: number;
  stageHeight: number;
  stageWidth: number;
  viewportPreset: WorkspaceMapViewportPreset;
}

interface WorkspaceMapRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface WorkspaceMapCardPreset {
  cardHeight: number;
  cardWidth: number;
}

export interface SpecsBoardLayoutPreset {
  cardHeight: number;
  cardWidth: number;
  columnGap: number;
  rowGap: number;
  rowOffset: number;
}

export const WORKSPACE_MAP_GRID_SIZE = 40;

export const WORKSPACE_MAP_NODE_SCALE_PRESET: WorkspaceMapNodeScalePreset = {
  fontRatio: 0.9,
  fontMinScale: 1,
  fontMaxScale: 1.42,
  spacingRatio: 0.82,
  spacingMinScale: 1,
  spacingMaxScale: 1.22,
};

export const DOCUMENT_MAP_VIEWPORT_PRESET: WorkspaceMapViewportPreset = {
  minScale: 0.42,
  maxScale: 2.4,
  fitMinScale: 0.5,
  fitMaxScale: 0.92,
  viewportPadding: 64,
};

export const DOCUMENT_MAP_CARD_PRESET: WorkspaceMapCardPreset = {
  cardWidth: 360,
  cardHeight: 220,
};

export const DOCUMENT_MAP_GRID_PRESET = {
  columnGap: 136,
  rowGap: 96,
  rowOffset: 36,
};

export const REFERENCE_MAP_VIEWPORT_PRESET: WorkspaceMapViewportPreset = {
  minScale: 0.28,
  maxScale: 2.6,
  fitMinScale: 0.52,
  fitMaxScale: 1,
  viewportPadding: 28,
};

export const REFERENCE_GRAPH_TOP_OVERFLOW = 56;

export const SPECS_BOARD_LAYOUT_PRESET: SpecsBoardLayoutPreset = {
  ...DOCUMENT_MAP_CARD_PRESET,
  ...DOCUMENT_MAP_GRID_PRESET,
};

export const ANALYSIS_DOCUMENT_BOARD_LAYOUT_PRESET =
  createAnalysisDocumentBoardLayoutPreset(DOCUMENT_MAP_CARD_PRESET);

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getWorkspaceMapFitScale(input: WorkspaceMapFitScaleInput): number {
  const boundsWidth = Math.max(input.boundsWidth, 1);
  const boundsHeight = Math.max(input.boundsHeight, 1);
  const availableWidth = Math.max(
    input.stageWidth - input.viewportPreset.viewportPadding * 2,
    1,
  );
  const availableHeight = Math.max(
    input.stageHeight - input.viewportPreset.viewportPadding * 2,
    1,
  );

  return clamp(
    Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight),
    input.viewportPreset.fitMinScale,
    input.viewportPreset.fitMaxScale,
  );
}

export function getWorkspaceMapNodeFontScale(
  viewportScale: number,
  preset: WorkspaceMapNodeScalePreset = WORKSPACE_MAP_NODE_SCALE_PRESET,
): number {
  return clamp(preset.fontRatio / viewportScale, preset.fontMinScale, preset.fontMaxScale);
}

export function getWorkspaceMapNodeSpacingScale(
  viewportScale: number,
  preset: WorkspaceMapNodeScalePreset = WORKSPACE_MAP_NODE_SCALE_PRESET,
): number {
  return clamp(
    preset.spacingRatio / viewportScale,
    preset.spacingMinScale,
    preset.spacingMaxScale,
  );
}

function createAnalysisDocumentBoardLayoutPreset(
  cardPreset: WorkspaceMapCardPreset,
): Record<ProjectAnalysisDocumentId, WorkspaceMapRect> {
  const leftColumnX = -(cardPreset.cardWidth + DOCUMENT_MAP_GRID_PRESET.columnGap);
  const centerColumnX = 0;
  const rightColumnX = cardPreset.cardWidth + DOCUMENT_MAP_GRID_PRESET.columnGap;
  const topRowY = -Math.round((cardPreset.cardHeight + DOCUMENT_MAP_GRID_PRESET.rowGap) / 2);
  const bottomRowY = Math.round((cardPreset.cardHeight + DOCUMENT_MAP_GRID_PRESET.rowGap) / 2);

  return {
    overview: {
      x: leftColumnX,
      y: 0,
      width: cardPreset.cardWidth,
      height: cardPreset.cardHeight,
    },
    purpose: {
      x: centerColumnX,
      y: topRowY,
      width: cardPreset.cardWidth,
      height: cardPreset.cardHeight,
    },
    structure: {
      x: centerColumnX,
      y: bottomRowY,
      width: cardPreset.cardWidth,
      height: cardPreset.cardHeight,
    },
    layers: {
      x: rightColumnX,
      y: topRowY,
      width: cardPreset.cardWidth,
      height: cardPreset.cardHeight,
    },
    connectivity: {
      x: rightColumnX,
      y: bottomRowY,
      width: cardPreset.cardWidth,
      height: cardPreset.cardHeight,
    },
  };
}
