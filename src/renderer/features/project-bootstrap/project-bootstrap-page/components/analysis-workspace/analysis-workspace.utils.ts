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
import { ANALYSIS_DOCUMENT_BOARD_LAYOUT_PRESET } from '@/renderer/features/project-bootstrap/project-bootstrap-page/workspace-map.shared';

import type {
  AnalysisDocumentBoardLink,
  AnalysisDocumentBoardNode,
  AnalysisFileReferenceCard,
  AnalysisRenderedLink,
  AnalysisStageSize,
  AnalysisViewport,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/analysis-workspace.types';
import {
  buildWorkspaceBoardLinkPaths,
  createViewportToFitBoardNodes,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/workspace-board-map/workspace-board-map.utils';

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
  boardNodes: AnalysisDocumentBoardNode[],
  documents: ProjectAnalysisDocument[],
): ProjectAnalysisDocumentLayoutMap {
  const next: ProjectAnalysisDocumentLayoutMap = {};
  const boardNodeById = new Map(boardNodes.map((node) => [node.id, node] as const));

  for (const document of documents) {
    const position = boardNodeById.get(document.id);
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
  return buildWorkspaceBoardLinkPaths(nodes, links, stageSize, viewport);
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
  return createViewportToFitBoardNodes(nodes, stageSize);
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
