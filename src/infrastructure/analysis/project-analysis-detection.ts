import type { ProjectAnalysisContext } from '@/domain/project/project-analysis-model';
import { ANALYSIS_CONTEXT_SCHEMA_VERSION } from '@/domain/project/project-model';
import type { ProjectAnalysisScanState } from '@/infrastructure/analysis/project-analysis-scanner';

export interface ProjectAnalysisDetectionResult {
  context: ProjectAnalysisContext;
  detectedFrameworks: string[];
  detectedStack: string[];
  unknowns: string[];
  confidence: number;
}

export function createProjectAnalysisDetection(
  scanState: ProjectAnalysisScanState,
): ProjectAnalysisDetectionResult {
  const detectedFrameworks = detectFrameworks(scanState);
  const detectedStack = buildDetectedStack({
    detectedFrameworks,
    languageExtensions: scanState.languageExtensions,
    packageManager: scanState.packageManager,
  });
  const unknowns = buildUnknowns({
    detectedFrameworks,
    entrypoints: scanState.entrypoints,
    hasPackageJson: scanState.packageJson !== null,
    reachedDirectoryLimit: scanState.reachedDirectoryLimit,
    reachedFileLimit: scanState.reachedFileLimit,
  });
  const confidence = calculateConfidence({
    detectedFrameworks,
    entrypoints: scanState.entrypoints,
    hasPackageJson: scanState.packageJson !== null,
    keyConfigs: scanState.keyConfigs,
    modules: scanState.modules,
    unknowns,
  });

  return {
    context: {
      schemaVersion: ANALYSIS_CONTEXT_SCHEMA_VERSION,
      files: toSortedArray(scanState.files),
      directories: toSortedArray(scanState.directories),
      detectedFrameworks,
      entrypoints: toSortedArray(scanState.entrypoints),
      keyConfigs: toSortedArray(scanState.keyConfigs),
      modules: toSortedArray(scanState.modules),
      unknowns,
      confidence,
      projectPurpose: '',
      architectureSummary: '',
      documentSummaries: [],
      documentLayouts: {},
      layers: [],
      directorySummaries: [],
      connections: [],
      documentLinks: [],
      fileReferences: [],
    },
    confidence,
    detectedFrameworks,
    detectedStack,
    unknowns,
  };
}

function detectFrameworks(scanState: ProjectAnalysisScanState): string[] {
  const frameworks = new Set<string>();
  const dependencies = {
    ...scanState.packageJson?.dependencies,
    ...scanState.packageJson?.devDependencies,
  };

  if (scanState.packageJson !== null) {
    frameworks.add('Node.js');
  }

  if ('typescript' in dependencies || hasNamedConfig(scanState.keyConfigs, 'tsconfig')) {
    frameworks.add('TypeScript');
  }

  if ('electron' in dependencies || hasNamedConfig(scanState.keyConfigs, 'electron.vite.config')) {
    frameworks.add('Electron');
  }

  if ('react' in dependencies) {
    frameworks.add('React');
  }

  if ('vite' in dependencies || hasNamedConfig(scanState.keyConfigs, 'vite.config')) {
    frameworks.add('Vite');
  }

  if ('next' in dependencies || hasNamedConfig(scanState.keyConfigs, 'next.config')) {
    frameworks.add('Next.js');
  }

  if ('express' in dependencies) {
    frameworks.add('Express');
  }

  if ('@nestjs/core' in dependencies) {
    frameworks.add('NestJS');
  }

  if ('vue' in dependencies) {
    frameworks.add('Vue');
  }

  if ('svelte' in dependencies) {
    frameworks.add('Svelte');
  }

  if ('@tauri-apps/api' in dependencies || '@tauri-apps/cli' in dependencies) {
    frameworks.add('Tauri');
  }

  if ('turbo' in dependencies || hasNamedConfig(scanState.keyConfigs, 'turbo.json')) {
    frameworks.add('Turborepo');
  }

  return toSortedArray(frameworks);
}

function hasNamedConfig(keyConfigs: Set<string>, segment: string): boolean {
  return [...keyConfigs].some((configPath) => {
    const fileName = configPath.split('/').pop();
    return typeof fileName === 'string' ? fileName.startsWith(segment) : false;
  });
}

function buildDetectedStack(input: {
  detectedFrameworks: string[];
  languageExtensions: Set<string>;
  packageManager: string | null;
}): string[] {
  const detectedStack = new Set<string>(input.detectedFrameworks);

  for (const language of input.languageExtensions) {
    if (language === 'TypeScript' || language === 'JavaScript') {
      detectedStack.add(language);
    }
  }

  if (input.packageManager) {
    detectedStack.add(input.packageManager);
  }

  return toSortedArray(detectedStack);
}

function buildUnknowns(input: {
  detectedFrameworks: string[];
  entrypoints: Set<string>;
  hasPackageJson: boolean;
  reachedDirectoryLimit: boolean;
  reachedFileLimit: boolean;
}): string[] {
  const unknowns = new Set<string>();

  if (!input.hasPackageJson) {
    unknowns.add('package.json 을 찾지 못했습니다.');
  }

  if (input.detectedFrameworks.length === 0) {
    unknowns.add('사용 중인 프레임워크를 확신하기 어렵습니다.');
  }

  if (input.entrypoints.size === 0) {
    unknowns.add('명확한 진입점을 자동으로 찾지 못했습니다.');
  }

  if (input.reachedDirectoryLimit || input.reachedFileLimit) {
    unknowns.add('스캔 범위를 제한해 일부 폴더는 분석에서 제외되었습니다.');
  }

  return toSortedArray(unknowns);
}

function calculateConfidence(input: {
  detectedFrameworks: string[];
  entrypoints: Set<string>;
  hasPackageJson: boolean;
  keyConfigs: Set<string>;
  modules: Set<string>;
  unknowns: string[];
}): number {
  let confidence = 0.2;

  if (input.hasPackageJson) {
    confidence += 0.2;
  }

  if (input.detectedFrameworks.length > 0) {
    confidence += 0.2;
  }

  if (input.entrypoints.size > 0) {
    confidence += 0.15;
  }

  if (input.keyConfigs.size > 0) {
    confidence += 0.1;
  }

  if (input.modules.size > 0) {
    confidence += 0.1;
  }

  if (input.unknowns.length === 0) {
    confidence += 0.05;
  }

  return Number(Math.min(0.95, confidence).toFixed(2));
}

function toSortedArray(values: Set<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}
