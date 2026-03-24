import type {
  ProjectAnalysisDocumentId,
  ProjectAnalysisDocumentLayoutMap,
  ProjectAnalysisDocumentLink,
} from '@/domain/project/project-analysis-model';
import type {
  ProjectAnalysisDocument,
  SelectedProjectAnalysisDocumentId,
  StructuredProjectAnalysis,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';
import {
  ANALYSIS_DOCUMENT_BOARD_LAYOUT_PRESET,
  DOCUMENT_MAP_VIEWPORT_PRESET,
  WORKSPACE_MAP_GRID_SIZE,
  getWorkspaceMapFitScale,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/workspace-map.shared';

import type {
  AnalysisDocumentBoardLink,
  AnalysisDocumentBoardNode,
  AnalysisFileReferenceCard,
  AnalysisRenderedLink,
  AnalysisStageSize,
  AnalysisViewport,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/analysis-workspace.types';

export const EMPTY_ANALYSIS_DOCUMENTS: ProjectAnalysisDocument[] = [];
export const EMPTY_DOCUMENT_LAYOUTS: ProjectAnalysisDocumentLayoutMap = {};
export const EMPTY_DOCUMENT_LINKS: ProjectAnalysisDocumentLink[] = [];
export const EMPTY_STAGE_SIZE: AnalysisStageSize = {
  width: 0,
  height: 0,
};
export const INITIAL_VIEWPORT: AnalysisViewport = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

const DEFAULT_ANALYSIS_BOARD_LINKS: AnalysisDocumentBoardLink[] = [
  { from: 'overview', label: '목적', to: 'purpose' },
  { from: 'overview', label: '구조', to: 'structure' },
  { from: 'purpose', label: '책임', to: 'layers' },
  { from: 'structure', label: '흐름', to: 'connectivity' },
  { from: 'purpose', label: '참조', to: 'connectivity' },
];

export function buildAnalysisDocumentBoardNodes(
  documents: ProjectAnalysisDocument[],
  boardPositions: ProjectAnalysisDocumentLayoutMap,
): AnalysisDocumentBoardNode[] {
  return documents.map((document) => {
    const layout = ANALYSIS_DOCUMENT_BOARD_LAYOUT_PRESET[document.id];
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

export function createResolvedDocumentLayoutMap(
  documents: ProjectAnalysisDocument[],
  storedLayouts: ProjectAnalysisDocumentLayoutMap,
): ProjectAnalysisDocumentLayoutMap {
  const next: ProjectAnalysisDocumentLayoutMap = {};

  for (const document of documents) {
    const layout = ANALYSIS_DOCUMENT_BOARD_LAYOUT_PRESET[document.id];
    next[document.id] = storedLayouts[document.id] ?? {
      x: layout.x,
      y: layout.y,
    };
  }

  return next;
}

export function mergeDocumentLayoutMaps(input: {
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

export function toDocumentLayoutMap(
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

export function buildAnalysisLinkPaths(
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

export function resolveAnalysisDocumentBoardLinks(
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

export function buildAnalysisFileReferenceCards(
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

export function createViewportToFitNodes(
  nodes: AnalysisDocumentBoardNode[],
  stageSize: AnalysisStageSize,
): AnalysisViewport {
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

export function createStageGridStyle(viewport: AnalysisViewport): Record<string, string> {
  const gridSize = WORKSPACE_MAP_GRID_SIZE * viewport.scale;

  return {
    backgroundPosition: `calc(50% + ${viewport.offsetX}px) calc(50% + ${viewport.offsetY}px)`,
    backgroundSize: `${gridSize}px ${gridSize}px`,
  };
}

export function getAnalysisDocumentFileName(documentId: ProjectAnalysisDocumentId): string {
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

export function resolveSelectedDocument(
  documents: ProjectAnalysisDocument[],
  selectedDocumentId: SelectedProjectAnalysisDocumentId,
): ProjectAnalysisDocument | null {
  if (documents.length === 0) {
    return null;
  }

  return documents.find((document) => document.id === selectedDocumentId) ?? documents[0] ?? null;
}

export function toWorldPoint(input: {
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
