# Analysis Fixture Scenarios

이 디렉터리는 참조 분석 회귀 시나리오를 작게 고정해 두는 용도다.

우선순위 시나리오:

- `structure-discovery`
  - 비표준 source root
  - 중첩 package root
  - alias config 존재
  - 반복 feature cluster 후보
- `typescript`
  - `import`, `export`, `require`, `dynamic import`, `import type`
- `javascript`
  - CommonJS + ESM 혼합
- `vue`
  - SFC script + template 추가 참조
- `java-kotlin`
  - package/import 기반 해석
  - package root 실패 / symbol resolution 실패
- `php`
  - `use`, `include`, framework loader, structural type, phpdoc type
  - fallback 탐색 근거 기록
- `scan-limit`
  - depth / directory / file 한도 도달

검증 포인트:

- resolved references 수
- unresolved references 존재 여부와 reason
- structureDiscovery.sourceRoots / packageRoots / featureClusters
- file-index grouping / classification / unresolvedReferences
- renderer가 필요한 area / cluster fallback 데이터 존재 여부
