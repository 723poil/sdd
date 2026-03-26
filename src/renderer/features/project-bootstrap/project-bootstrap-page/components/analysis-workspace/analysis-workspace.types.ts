import type {
  ProjectAnalysisDocumentId,
  ProjectAnalysisFileIndexEntry,
} from '@/domain/project/project-analysis-model';

export interface AnalysisDocumentBoardLayout {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface AnalysisDocumentBoardNode extends AnalysisDocumentBoardLayout {
  fileName: string;
  id: ProjectAnalysisDocumentId;
  summary: string;
  title: string;
}

export interface AnalysisDocumentBoardLink {
  from: ProjectAnalysisDocumentId;
  label: string;
  to: ProjectAnalysisDocumentId;
}

export interface AnalysisViewport {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export interface AnalysisStageSize {
  height: number;
  width: number;
}

export interface AnalysisRenderedLink {
  from: ProjectAnalysisDocumentId;
  key: string;
  label: string;
  midX: number;
  midY: number;
  path: string;
  to: ProjectAnalysisDocumentId;
}

export interface AnalysisFileReferenceCard {
  category: string;
  incomingCount: number;
  layer: string | null;
  path: string;
  references: ProjectAnalysisFileIndexEntry['references'];
  role: string;
  summary: string;
}

export type AnalysisInteractionState =
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
      startClientX: number;
      startClientY: number;
    };

export type AnalysisWorkspaceViewMode = 'map' | 'document';
