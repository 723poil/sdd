import type { ScriptKind } from 'typescript';

import type {
  ProjectAnalysisConnection,
  ProjectAnalysisDirectorySummary,
  ProjectAnalysisFileClassification,
  ProjectAnalysisFileGrouping,
  ProjectAnalysisFileIndexEntry,
  ProjectAnalysisFileReference,
  ProjectAnalysisLayerSummary,
  ProjectAnalysisReferenceAnalysis,
  ProjectAnalysisStructureDiscovery,
  ProjectAnalysisUnresolvedFileReference,
} from '@/domain/project/project-analysis-model';
import type { PhpPathConstantName } from '@/infrastructure/analysis/project-analysis-local-reference-extractor.constants';
import type { SupportedSourceLanguage } from '@/infrastructure/analysis/project-analysis-file-descriptions';
import type { ProjectAnalysisScanState } from '@/infrastructure/analysis/project-analysis-scanner';

export type ExtractedReferenceRelationship =
  | 'imports'
  | 'requires'
  | 'dynamic-import'
  | 'includes'
  | 'loads'
  | 'uses'
  | 'phpdoc'
  | 'extends'
  | 'implements'
  | 'instantiates'
  | 'decorates'
  | 'module-imports'
  | 'provides'
  | 'registers-controller'
  | 'exports';

export interface LoadedSourceFile {
  additionalReferences: Array<{
    relationship: ExtractedReferenceRelationship;
    specifier: string;
  }>;
  path: string;
  language: SupportedSourceLanguage;
  content: string;
  baseName: string;
  packageName: string | null;
  namespaceName: string | null;
  declarations: string[];
  scriptKind: ScriptKind;
}

export interface PhpUseImport {
  alias: string;
  kind: 'class' | 'function' | 'const';
  qualifiedName: string;
}

export type PhpFrameworkLoadKind = 'config' | 'helper' | 'library' | 'model' | 'service';

export interface PhpFrameworkLoadReference {
  kind: PhpFrameworkLoadKind;
  path: string;
}

export interface PhpIncludeReference {
  path: string;
  rawSpecifier: string;
  rootConstant: PhpPathConstantName | null;
}

export interface ExtractedReference {
  from: string;
  relationship: ExtractedReferenceRelationship;
  specifier: string;
  to: string;
}

export interface UnresolvedExtractedReference extends ProjectAnalysisUnresolvedFileReference {
  relationship: ExtractedReferenceRelationship;
}

export interface ExtractedStructuralHint {
  confidence: number;
  kind: string;
  reason: string;
  value: string;
}

export interface ReferenceResolution {
  candidatePaths: string[];
  reason: string;
  resolutionKind: string;
  resolvedPath: string | null;
}

export interface ReferenceExtractionResult {
  path: string;
  resolvedReferences: ExtractedReference[];
  structuralHints: ExtractedStructuralHint[];
  unresolvedReferences: UnresolvedExtractedReference[];
}

export interface LayerConnectionAccumulator {
  count: number;
  from: string;
  samples: string[];
  to: string;
}

export interface FileClassification {
  category: string;
  classification: ProjectAnalysisFileClassification;
  grouping: ProjectAnalysisFileGrouping;
  layer: string | null;
  role: string;
}

export interface LocalProjectReferenceAnalysis {
  connections: ProjectAnalysisConnection[];
  directorySummaries: ProjectAnalysisDirectorySummary[];
  fileIndex: ProjectAnalysisFileIndexEntry[];
  fileReferences: ProjectAnalysisFileReference[];
  layers: ProjectAnalysisLayerSummary[];
  referenceAnalysis: ProjectAnalysisReferenceAnalysis;
}

export interface BuildFileIndexInput {
  fileReferences: ProjectAnalysisFileReference[];
  keyConfigs: Set<string>;
  loadedFiles: LoadedSourceFile[];
  scanState: ProjectAnalysisScanState;
  structuralHintsByPath: Map<string, ExtractedStructuralHint[]>;
  structureDiscovery: ProjectAnalysisStructureDiscovery;
  unresolvedFileReferences: ProjectAnalysisUnresolvedFileReference[];
}
