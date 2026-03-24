import { join } from 'node:path';

export interface ProjectStoragePaths {
  analysisContextPath: string;
  analysisDirectoryPath: string;
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
