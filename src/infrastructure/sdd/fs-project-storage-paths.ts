import { join } from 'node:path';

import type { ProjectAnalysisDocumentId } from '@/domain/project/project-analysis-model';

export interface ProjectStoragePaths {
  analysisContextPath: string;
  analysisDirectoryPath: string;
  analysisFileIndexPath: string;
  analysisManualReferenceTagsPath: string;
  analysisSummaryPath: string;
  projectJsonPath: string;
  runsDirectoryPath: string;
  sddDirectoryPath: string;
  sessionsDirectoryPath: string;
  sessionsIndexPath: string;
  specsDirectoryPath: string;
  specsIndexPath: string;
}

export function getProjectStoragePaths(rootPath: string): ProjectStoragePaths {
  const sddDirectoryPath = join(rootPath, '.sdd');
  const analysisDirectoryPath = join(sddDirectoryPath, 'analysis');
  const specsDirectoryPath = join(sddDirectoryPath, 'specs');
  const runsDirectoryPath = join(sddDirectoryPath, 'runs');

  return {
    sddDirectoryPath,
    analysisDirectoryPath,
    analysisFileIndexPath: join(analysisDirectoryPath, 'file-index.json'),
    analysisManualReferenceTagsPath: join(analysisDirectoryPath, 'manual-reference-tags.json'),
    sessionsDirectoryPath: join(sddDirectoryPath, 'sessions'),
    specsDirectoryPath,
    runsDirectoryPath,
    projectJsonPath: join(sddDirectoryPath, 'project.json'),
    analysisContextPath: join(analysisDirectoryPath, 'context.json'),
    analysisSummaryPath: join(analysisDirectoryPath, 'summary.md'),
    sessionsIndexPath: join(sddDirectoryPath, 'sessions', 'index.json'),
    specsIndexPath: join(specsDirectoryPath, 'index.json'),
  };
}

export function getProjectAnalysisDocumentPath(input: {
  analysisDirectoryPath: string;
  documentId: ProjectAnalysisDocumentId;
}): string {
  if (input.documentId === 'overview') {
    return join(input.analysisDirectoryPath, 'summary.md');
  }

  return join(input.analysisDirectoryPath, `${input.documentId}.md`);
}

export function getSpecDirectoryPath(rootPath: string, specId: string): string {
  return join(getProjectStoragePaths(rootPath).specsDirectoryPath, specId);
}

export function getSpecMetaPath(rootPath: string, specId: string): string {
  return join(getSpecDirectoryPath(rootPath, specId), 'meta.json');
}

export function getSpecDraftPath(rootPath: string, specId: string): string {
  return join(getSpecDirectoryPath(rootPath, specId), 'draft.md');
}

export function getSpecVersionsDirectoryPath(rootPath: string, specId: string): string {
  return join(getSpecDirectoryPath(rootPath, specId), 'versions');
}

export function getSpecVersionPath(input: {
  rootPath: string;
  specId: string;
  versionId: string;
}): string {
  return join(
    getSpecVersionsDirectoryPath(input.rootPath, input.specId),
    `${input.versionId}.md`,
  );
}
