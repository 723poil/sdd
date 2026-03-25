import type { ProjectAnalysisFileReference } from '@/domain/project/project-analysis-model';
import type {
  ProjectReferenceTagDocument,
} from '@/domain/project/project-reference-tag-model';
import type { ReferenceTagGenerationResult } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/reference-tags/ReferenceTagManager';
import type { StructuredProjectAnalysis } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

export interface AnalysisViewport {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export interface AnalysisStageSize {
  height: number;
  width: number;
}

export interface AnalysisRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface AnalysisReferenceMapProps {
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

export interface AnalysisInteractionState {
  kind: 'pan';
  moved: boolean;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
}

export interface AnalysisReferenceNode {
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

export interface AnalysisReferenceArea extends AnalysisRect {
  clusterCount: number;
  count: number;
  key: string;
  label: string;
  name: string;
}

export interface AnalysisReferenceCluster extends AnalysisRect {
  areaName: string;
  count: number;
  groupCount: number;
  key: string;
  label: string;
  name: string;
}

export interface AnalysisReferenceRoleGroup extends AnalysisRect {
  category: string;
  clusterKey: string;
  count: number;
  hiddenCount: number;
  isExpanded: boolean;
  key: string;
  label: string;
}

export interface AnalysisReferenceLink {
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

export interface AnalysisReferenceGraph {
  areas: AnalysisReferenceArea[];
  clusters: AnalysisReferenceCluster[];
  edges: ProjectAnalysisFileReference[];
  isReduced: boolean;
  nodes: AnalysisReferenceNode[];
  retainedNodeCount: number;
  roleGroups: AnalysisReferenceRoleGroup[];
  totalEdgeCount: number;
  totalNodeCount: number;
}

export interface AnalysisReferenceBuildOptions {
  activeTagIds: Set<string>;
  expandedGroupKeys: Set<string>;
  stageWidth: number;
}

export interface AnalysisRoleGroupEntry {
  allPaths: string[];
  category: string;
  hiddenCount: number;
  isExpanded: boolean;
  visiblePaths: string[];
}

export interface AnalysisRoleGroupLayout extends AnalysisRoleGroupEntry {
  height: number;
  nodeHeights: number[];
  nodeOffsets: number[];
}
