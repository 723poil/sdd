import type { ProjectAnalysisContext } from '@/domain/project/project-analysis-model';

export function createProjectAnalysisSummaryMarkdown(input: {
  context: ProjectAnalysisContext;
  packageManager: string | null;
  projectName: string;
}): string {
  const lines = [
    `# ${input.projectName}`,
    '',
    '## 프로젝트 개요',
    '',
    createBullet(
      '감지한 스택',
      input.context.detectedFrameworks.length > 0 ? input.context.detectedFrameworks.join(', ') : '확인 중',
    ),
    createBullet('신뢰도', `${Math.round(input.context.confidence * 100)}%`),
    createBullet('패키지 매니저', input.packageManager ?? '확인하지 못함'),
    '',
    '## 핵심 모듈',
    '',
    ...createBulletList(input.context.modules, '구조상 눈에 띄는 모듈을 찾지 못했습니다.'),
    '',
    '## 엔트리포인트 후보',
    '',
    ...createBulletList(input.context.entrypoints, '자동으로 찾은 진입점이 없습니다.'),
    '',
    '## 주요 설정 파일',
    '',
    ...createBulletList(input.context.keyConfigs, '주요 설정 파일을 찾지 못했습니다.'),
    '',
    '## 추가 확인 필요',
    '',
    ...createBulletList(input.context.unknowns, '추가 확인이 필요한 항목은 아직 없습니다.'),
    '',
  ];

  return lines.join('\n');
}

function createBullet(label: string, value: string): string {
  return `- ${label}: ${value}`;
}

function createBulletList(values: string[], emptyMessage: string): string[] {
  if (values.length === 0) {
    return [`- ${emptyMessage}`];
  }

  return values.slice(0, 6).map((value) => `- ${value}`);
}
