import { ANALYSIS_CONTEXT_SCHEMA_VERSION } from '@/domain/project/project-model';

export interface ProjectAnalysisContext {
  schemaVersion: typeof ANALYSIS_CONTEXT_SCHEMA_VERSION;
  files: string[];
  directories: string[];
  detectedFrameworks: string[];
  entrypoints: string[];
  keyConfigs: string[];
  modules: string[];
  unknowns: string[];
  confidence: number;
}

export interface ProjectAnalysis {
  context: ProjectAnalysisContext;
  summaryMarkdown: string;
}

export interface ProjectAnalysisDraft extends ProjectAnalysis {
  detectedStack: string[];
}

export function isProjectAnalysisContext(value: unknown): value is ProjectAnalysisContext {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.schemaVersion === ANALYSIS_CONTEXT_SCHEMA_VERSION &&
    isStringArray(candidate.files) &&
    isStringArray(candidate.directories) &&
    isStringArray(candidate.detectedFrameworks) &&
    isStringArray(candidate.entrypoints) &&
    isStringArray(candidate.keyConfigs) &&
    isStringArray(candidate.modules) &&
    isStringArray(candidate.unknowns) &&
    typeof candidate.confidence === 'number'
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
