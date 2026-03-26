# Analysis Storage Fixture Scenarios

이 디렉터리는 `.sdd/analysis` 저장 계약 회귀 시나리오를 정의한다.

우선 유지할 샘플:

- `context-v2`
  - `referenceAnalysis` 없는 이전 `context.json`
- `context-v3`
  - `referenceAnalysis.structureDiscovery`
  - `referenceAnalysis.unresolvedFileReferences`
  - `referenceAnalysis.scanLimits`
- `file-index-v1`
  - `grouping`, `classification`, `unresolvedReferences` 없는 이전 `file-index.json`
- `file-index-v2`
  - 확장 필드 포함 최신 `file-index.json`

검증 포인트:

- read 직후 normalize 결과
- document layout 저장 후 신규 필드 보존
- manual-reference-tags overlay 비파괴 유지
