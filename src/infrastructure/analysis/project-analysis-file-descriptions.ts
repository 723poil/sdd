import type { ProjectAnalysisFileIndexEntry } from '@/domain/project/project-analysis-model';

export type SupportedSourceLanguage = 'typescript' | 'javascript' | 'vue' | 'kotlin' | 'php' | 'java';

const MONOREPO_AREA_ROOTS = new Set(['apps', 'libs', 'modules', 'packages']);

export function createFileSummary(input: {
  category: string;
  incomingCount: number;
  language: SupportedSourceLanguage | null;
  outgoingCount: number;
  role: string;
}): string {
  if (input.category === 'config') {
    return '정적 분석에서 확인한 주요 설정 파일입니다.';
  }

  if (input.category === 'entrypoint') {
    return '정적 분석에서 진입점 후보로 감지한 파일입니다.';
  }

  if (input.category === 'test') {
    return `${input.role}입니다. 테스트 경로를 별도 그룹으로 분리해 관리합니다.`;
  }

  const languageLabel = input.language ? getLanguageDisplayName(input.language) : '코드';
  const incomingPhrase =
    input.incomingCount > 0 ? `들어오는 참조 ${input.incomingCount}건` : '들어오는 참조 없음';
  const outgoingPhrase =
    input.outgoingCount > 0 ? `나가는 참조 ${input.outgoingCount}건` : '나가는 참조 없음';

  return `${input.role}입니다. ${languageLabel} 파일 기준으로 ${outgoingPhrase}, ${incomingPhrase}.`;
}

export function describeLayerResponsibility(layerName: string, fileCount: number): string {
  if (layerName === 'test') {
    return `테스트 지원 및 공통 테스트 코드 ${fileCount}개`;
  }

  if (layerName.endsWith('/test')) {
    return `${getLayerDisplayName(layerName)} ${fileCount}개`;
  }

  if (layerName.includes('/')) {
    return `${getLayerDisplayName(layerName)} 관련 코드 ${fileCount}개`;
  }

  switch (layerName) {
    case 'main':
      return `메인 프로세스 관련 코드 ${fileCount}개`;
    case 'preload':
      return `preload bridge 관련 코드 ${fileCount}개`;
    case 'renderer':
      return `renderer UI 관련 코드 ${fileCount}개`;
    case 'application':
      return `애플리케이션 유스케이스 관련 코드 ${fileCount}개`;
    case 'domain':
      return `도메인 규칙 관련 코드 ${fileCount}개`;
    case 'infrastructure':
      return `인프라 연동 관련 코드 ${fileCount}개`;
    case 'shared':
      return `공용 계약 및 유틸리티 ${fileCount}개`;
    case '기타':
      return `정적 분석에서 묶인 기타 코드 ${fileCount}개`;
    default:
      return `${getLayerDisplayName(layerName)} 관련 코드 ${fileCount}개`;
  }
}

export function describeDirectoryRole(
  indexedEntries: ProjectAnalysisFileIndexEntry[],
): string {
  const fileCount = indexedEntries.length;
  if (fileCount === 0) {
    return '정적 분석에서 주요 디렉터리로 감지했습니다.';
  }

  const topCategories = summarizeTopDirectoryCategories(indexedEntries);
  if (topCategories.length === 0) {
    return `정적 분석 기준 주요 파일 ${fileCount}개가 이 경로 아래에 있습니다.`;
  }

  return `주요 파일 ${fileCount}개. ${topCategories.join(', ')} 중심 경로입니다.`;
}

export function getLanguageDisplayName(language: SupportedSourceLanguage): string {
  switch (language) {
    case 'typescript':
      return 'TypeScript';
    case 'javascript':
      return 'JavaScript';
    case 'vue':
      return 'Vue';
    case 'java':
      return 'Java';
    case 'kotlin':
      return 'Kotlin';
    case 'php':
      return 'PHP';
  }
}

export function getLayerAreaDisplayName(areaName: string): string {
  const segments = areaName.split('/').filter(Boolean);
  if (segments.length > 1) {
    const [rootAreaName = areaName, ...restSegments] = segments;
    const rootAreaLabel = getLayerAreaDisplayName(rootAreaName);
    return `${rootAreaLabel} ${restSegments.join('/')}`.trim();
  }

  switch (areaName) {
    case 'api':
      return 'API';
    case 'apps':
      return '앱';
    case 'application':
      return '애플리케이션';
    case 'client':
      return '클라이언트';
    case 'config':
      return '설정';
    case 'controller':
      return '컨트롤러';
    case 'core':
      return '코어';
    case 'domain':
      return '도메인';
    case 'entrypoint':
      return '진입점';
    case 'infrastructure':
      return '인프라';
    case 'library':
      return '라이브러리';
    case 'libs':
      return '라이브러리';
    case 'main':
      return '메인';
    case 'model':
      return '모델';
    case 'modules':
      return '모듈';
    case 'packages':
      return '패키지';
    case 'preload':
      return 'preload';
    case 'renderer':
      return '렌더러';
    case 'server':
      return '서버';
    case 'service':
      return '서비스';
    case 'shared':
      return '공용';
    case 'src':
      return '소스';
    case 'test':
      return '테스트';
    case 'types':
      return '타입';
    case 'util':
    case 'utils':
      return '유틸리티';
    default:
      return areaName;
  }
}

export function getFileCategoryDisplayName(category: string): string | null {
  switch (category) {
    case 'command':
      return '커맨드';
    case 'command-service':
      return '커맨드 서비스';
    case 'command-handler':
      return '커맨드 핸들러';
    case 'config':
      return '설정 파일';
    case 'controller':
      return '컨트롤러';
    case 'decorator':
      return '데코레이터';
    case 'dto':
      return 'DTO';
    case 'entity':
      return '엔티티';
    case 'entrypoint':
      return '진입점';
    case 'exception':
      return '예외';
    case 'factory':
      return '팩토리';
    case 'filter':
      return '필터';
    case 'guard':
      return '가드';
    case 'handler':
      return '핸들러';
    case 'interceptor':
      return '인터셉터';
    case 'mapper':
      return '매퍼';
    case 'middleware':
      return '미들웨어';
    case 'model':
      return '모델';
    case 'module':
      return '모듈';
    case 'pipe':
      return '파이프';
    case 'policy':
      return '정책';
    case 'query':
      return '쿼리';
    case 'query-service':
      return '쿼리 서비스';
    case 'query-handler':
      return '쿼리 핸들러';
    case 'repository':
      return '레포지토리';
    case 'service':
      return '서비스';
    case 'source':
      return '소스';
    case 'strategy':
      return '전략';
    case 'test':
      return '테스트';
    case 'type':
      return '타입';
    case 'utility':
      return '유틸리티';
    case 'validator':
      return '검증';
    default:
      return null;
  }
}

function summarizeTopDirectoryCategories(
  indexedEntries: ProjectAnalysisFileIndexEntry[],
): string[] {
  const counts = new Map<string, number>();

  for (const entry of indexedEntries) {
    const key = entry.category;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([category, count]) => `${getFileCategoryDisplayName(category) ?? category} ${count}개`);
}

function getLayerDisplayName(layerName: string): string {
  if (layerName === 'test') {
    return '테스트';
  }

  const segments = layerName.split('/').filter(Boolean);
  const areaSegmentLength = resolveLayerAreaSegmentLength(segments);
  const areaName = segments.slice(0, areaSegmentLength).join('/') || layerName;
  if (segments.length <= areaSegmentLength) {
    return getLayerAreaDisplayName(areaName);
  }

  const categoryName = segments[segments.length - 1] ?? '';
  const scopeSegments = segments.slice(areaSegmentLength, -1);
  const labelParts = [getLayerAreaDisplayName(areaName)];

  if (scopeSegments.length > 0) {
    labelParts.push(scopeSegments.join('/'));
  }

  if (categoryName === 'test') {
    labelParts.push('테스트');
    return labelParts.join(' ');
  }

  const categoryLabel = getFileCategoryDisplayName(categoryName) ?? categoryName;
  if (categoryLabel !== labelParts[0]) {
    labelParts.push(categoryLabel);
  }

  return labelParts.join(' ');
}

function resolveLayerAreaSegmentLength(segments: string[]): number {
  const [rootSegment, packageName] = segments;
  if (rootSegment && packageName && MONOREPO_AREA_ROOTS.has(rootSegment)) {
    return 2;
  }

  return 1;
}
