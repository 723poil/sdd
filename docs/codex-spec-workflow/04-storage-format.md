# Storage Format

## 저장 전략

현재 요구사항에서는 DB를 두지 않고, 대상 프로젝트 내부에서 데이터를 같이 관리하는 방식이 가장 적합하다.

단, 최근 프로젝트 목록 같은 앱 편의 설정은 프로젝트 내부가 아니라 앱 전역 설정 파일로 분리해도 된다.

## 기본 원칙

- 프로젝트 루트에 숨김 폴더 `.sdd/` 생성
- 분석 결과, 명세서, 채팅 이력, 실행 준비 데이터를 여기에 저장
- 앱 전역 상태는 최소화
- 핵심 작업 데이터는 프로젝트와 함께 이동 가능해야 함
- 프로젝트 분석은 앱 내부의 로컬 정적 분석 결과를 기본으로 저장하고, 필요하면 CLI 에이전트 결과로 문서 서술을 보강하는 방식으로 유지
- 분석 결과에는 문서 맵 연결선과 파일별 참조 관계가 함께 들어가야 한다
- 수동 reference-tag/assignment는 분석기 출력과 분리된 별도 분석 파일로 저장한다
- 사람이 읽는 분석 문서는 Markdown 을 기본으로 하고, 필요하면 Mermaid fenced block을 포함할 수 있다
- 사람이 읽는 분석 문서는 경로 덤프보다 상단 요약, 역할별 그룹화, Mermaid 시각화를 우선한다

추가 원칙:

- 각 주요 JSON 파일은 `schemaVersion`을 가진다
- 변경 가능한 메타 JSON은 `revision` 또는 `updatedAt` 기반 충돌 검사를 지원한다
- spec별 source of truth는 `meta.json`이다
- `specs/index.json`은 재생성 가능한 인덱스/캐시로 본다

## 왜 이 방식이 맞는가

- 사용자가 개발자 개인 1인이다.
- 기준이 항상 특정 로컬 프로젝트다.
- 명세와 분석 결과가 프로젝트와 함께 있어야 다시 열기 쉽다.
- DB 없이도 충분히 MVP를 운영할 수 있다.

## 권장 폴더 구조

```text
.sdd/
  project.json
  analysis/
    summary.md
    purpose.md
    structure.md
    layers.md
    connectivity.md
    context.json
    file-index.json
    manual-reference-tags.json
  sessions/
    index.json
    session-001/
      meta.json
      messages.jsonl
  specs/
    index.json
    project-overview/
      meta.json
      chat.jsonl
      versions/
        v1.md
        v2.md
      patches/
        patch-001.json
    feature-login/
      meta.json
      chat.jsonl
      versions/
        v1.md
      patches/
  runs/
    run-001.json
```

## 파일 포맷 초안

### `.sdd/project.json`

역할:

- 현재 프로젝트 메타데이터

권장 필드:

- `schemaVersion`
- `projectName`
- `rootPath`
- `createdAt`
- `updatedAt`
- `revision`
- `lastAnalyzedAt`
- `detectedStack`
- `defaultSpecId`

### `.sdd/analysis/context.json`

역할:

- 분석 원본 결과의 기계 판독용 집계본

권장 필드:

- `schemaVersion`
- `files`
- `directories`
- `detectedFrameworks`
- `entrypoints`
- `keyConfigs`
- `modules`
- `projectPurpose`
- `architectureSummary`
- `documentSummaries`
- `documentLayouts`
- `layers`
- `directorySummaries`
- `connections`
- `documentLinks`
- `fileReferences`
- `referenceAnalysis`
- `unknowns`
- `confidence`

주의:

- 이 파일은 분석 산출물 전체를 한 번에 다시 읽기 위한 집계 레이어다
- UI 렌더링용 문서는 아래 개별 Markdown 파일을 우선 사용한다
- `documentLayouts`는 문서 맵 카드의 사용자 배치 좌표를 저장하며, 재분석 후에도 유지한다
- `documentLinks`는 분석 문서 간 연결선을 저장하는 구조화 데이터다
- `fileReferences`는 파일 인덱스 기반의 파일 간 참조 관계를 저장하는 구조화 데이터다
- `referenceAnalysis`는 구조 발견 결과, 미해결 참조, 스캔 한도 도달 정보를 함께 저장하는 보조 계약이다
- `referenceAnalysis.structureDiscovery`는 `packageRoots`, `sourceRoots`, `aliasConfigPaths`, `featureClusters`, `notes`를 가진다
- `referenceAnalysis.unresolvedFileReferences`는 해석 실패를 버리지 않고 `from`, `specifier`, `resolutionKind`, `reason`, `confidence`, `candidatePaths`로 남긴다
- `referenceAnalysis.scanLimits`는 `depth`, `directory`, `file` 한도 도달 사실과 limit 값을 기록한다

### `.sdd/analysis/summary.md`

역할:

- 사람이 읽는 프로젝트 개요

권장 내용:

- 상단 1~2문장 요약
- 프로젝트 개요
- 스택
- 분석 범위
- 핵심 모듈
- 엔트리포인트
- unknowns
- 필요하면 Mermaid 다이어그램

### `.sdd/analysis/structure.md`

역할:

- 디렉터리와 모듈 계층 요약

권장 내용:

- 상단 1~2문장 요약
- 루트 디렉터리
- 주요 하위 디렉터리
- 기능 단위 모듈
- 상위/하위 계층 관계
- 필요하면 Mermaid graph / flowchart
- 긴 경로 나열보다 책임 단위 묶음과 대표 경로 위주로 설명

### `.sdd/analysis/layers.md`

역할:

- 레이어별 책임과 의존성 정리

권장 내용:

- 상단 1~2문장 요약
- `main`
- `preload`
- `renderer`
- `application`
- `domain`
- `infrastructure`
- 레이어 간 허용/금지 연결
- 필요하면 Mermaid graph
- 레이어별 대표 경로나 책임 묶음을 함께 적어 사람이 바로 읽을 수 있게 구성

### `.sdd/analysis/connectivity.md`

역할:

- 파일과 모듈의 연결성, 의존 관계, 진입점 정리

권장 내용:

- 상단 1~2문장 요약
- 엔트리포인트에서 시작되는 연결 경로
- 핵심 모듈 간 참조 관계
- 설정 파일과 런타임 경로
- 자주 이어지는 흐름
- 필요하면 Mermaid sequence / flowchart
- 파일 경로를 전부 나열하지 말고 핵심 흐름과 대표 예시만 압축해서 설명

### `.sdd/analysis/file-index.json`

역할:

- 분석 대상 파일의 빠른 탐색용 인덱스

권장 내용:

- `path`
- `role`
- `layer`
- `category`
- `summary`
- `grouping`
- `classification`
- `references`
- `unresolvedReferences`

주의:

- `references`는 해당 파일이 참조하는 다른 인덱스 파일들의 목록이다
- 각 참조는 `path`, `relationship`, `reason`을 가진다
- `grouping`은 renderer가 raw layer 문자열을 다시 추측하지 않도록 `area`, `cluster`를 함께 저장한다
- `classification`은 `category`와 `layer`가 확정인지 추정인지, confidence와 reasons를 함께 가진다
- `unresolvedReferences`는 해당 파일에서 해석하지 못한 import/use/include/load/type 참조를 별도 배열로 유지한다
- 이 정보는 중앙 분석 화면에서 파일 간 연결 관계를 보여줄 때 사용한다
- `file-index.json`은 analyzer 출력의 재생성 대상이고, 수동 reference-tag/assignment는 이 파일과 분리해 유지한다

추가 버전 규칙:

- `context.json` 계약이 `referenceAnalysis`를 포함하도록 바뀌면 `schemaVersion`을 올리고 이전 버전 읽기 migration을 함께 둔다
- `file-index.json` 계약이 `grouping`, `classification`, `unresolvedReferences`를 포함하도록 바뀌면 이전 버전 읽기 fallback을 함께 둔다

### `.sdd/analysis/manual-reference-tags.json`

역할:

- 사람이 수동으로 지정한 분석 파일별 reference-tag/assignment를 저장하는 보조 계약

권장 내용:

- `schemaVersion`
- `revision`
- `updatedAt`
- `tags`
  - `id`
  - `label`
  - `description`
  - `color`
  - `createdAt`
  - `updatedAt`
- `assignments`
  - `path`
  - `tagIds`

주의:

- 이 파일은 analyzer 출력이 아니다
- `file-index.json` 재생성으로 덮어쓰지 않는다
- `file-index.json`과 함께 읽어서 중앙 분석 화면에 반영한다
- 수동 태그는 renderer의 로컬 상태에만 두지 않고, 저장 가능한 분석 계약으로 유지한다

### `.sdd/specs/index.json`

역할:

- 전체 명세 목록 인덱스

권장 필드:

- `schemaVersion`
- `generatedAt`
- `specs`
  - `id`
  - `slug`
  - `title`
  - `status`
  - `latestVersion`
  - `currentVersion`
  - `updatedAt`

주의:

- `index.json`은 조회 최적화를 위한 인덱스다
- 실제 기준은 각 spec의 `meta.json`
- 필요하면 `specs/` 디렉터리를 스캔해 재생성 가능해야 한다

### `.sdd/sessions/index.json`

역할:

- 프로젝트 단위 대화 세션 목록 인덱스

권장 필드:

- `schemaVersion`
- `generatedAt`
- `sessions`
  - `id`
  - `specId`
  - `title`
  - `updatedAt`
  - `lastMessageAt`
  - `lastMessagePreview`
  - `messageCount`

주의:

- 빠른 조회용 인덱스다
- 실제 기준은 각 세션의 `meta.json`

### `.sdd/sessions/<session-id>/meta.json`

역할:

- 프로젝트 대화 세션 하나의 메타데이터

권장 필드:

- `schemaVersion`
- `id`
- `specId`
- `title`
- `createdAt`
- `updatedAt`
- `revision`
- `lastMessageAt`
- `lastMessagePreview`
- `messageCount`

### `.sdd/sessions/<session-id>/messages.jsonl`

역할:

- 명세 단위 대화 세션의 append-only 메시지 로그

권장 레코드 필드:

- `schemaVersion`
- `id`
- `sessionId`
- `createdAt`
- `role`
- `text`

주의:

- Codex 연결 전에는 user 중심 메시지만 존재할 수 있다
- 이후 assistant/system 역할이 추가돼도 같은 포맷을 이어서 사용 가능해야 한다

### `.sdd/specs/<spec-slug>/meta.json`

역할:

- 명세 하나의 메타데이터

권장 필드:

- `schemaVersion`
- `id`
- `slug`
- `title`
- `status`
- `latestVersion`
- `currentVersion`
- `draftMarkdown`
- `revision`
- `createdAt`
- `updatedAt`
- `summary`
- `relations`
  - `targetSpecId`
  - `type`
  - `createdAt`

주의:

- 새 명세 생성 직후에는 `latestVersion = null` 인 작업 초안 상태를 먼저 저장한다
- 작업 초안의 현재 본문은 `meta.json.draftMarkdown` 에 둔다
- 이후 채팅과 patch 는 이 명세 단위로 연결된다
- 첫 실질 저장 또는 첫 채팅 반영이 `v1` 이다
- 직접 편집 저장과 채팅 기반 초안 갱신 모두 실질 변경이 있을 때만 `versions/` 에 새 버전을 추가하고 `revision` 을 증가시킨다
- 이전 버전 적용은 `draftMarkdown` 과 `currentVersion` 만 바꾸고 기존 버전 파일은 덮어쓰지 않는다
- `status` 는 현재 MVP에서 `draft`, `approved`, `archived` 를 저장할 수 있지만, 사용자 메타데이터 편집 UI는 `draft <-> archived` 전환만 직접 노출한다
- `relations` 는 현재 명세 기준의 연결 메타다. `derived-from`, `follow-up-to` 두 타입만 저장하고, 렌더러는 이를 바탕으로 `targetSpecId -> current spec` 방향 연결선을 그린다
- `status` 변경과 `relations` 추가/삭제 같은 metadata-only update는 새 Markdown 버전을 만들지 않는다
- 최신 계약은 `schemaVersion: 3` 이고, 기존 `schemaVersion: 2` 메타는 `relations = []` 으로 fallback read 한다

### `.sdd/specs/<spec-slug>/versions/v1.md`

역할:

- 실제 명세 본문

권장 구조:

- 제목
- 요약
- 배경 / 문제
- 목표
- 비목표
- 사용자 시나리오
- 기능 요구사항
- 비기능 요구사항
- 참조 태그
- 영향도 분석
- 사용 스킬
- 수용 기준
- 오픈 질문

주의:

- Markdown 첫 줄 `# 제목` 과 `meta.json.title` 은 일치시킨다
- `meta.json.currentVersion` 은 현재 작업 초안이 어떤 저장 버전을 기준으로 삼는지 가리킬 수 있다
- `meta.json.latestVersion` 은 가장 최근에 생성된 저장 버전 pointer다
- `참조 태그` 는 기존 reference-tag 를 우선 적고, 현재 기능이 기존 태그로 충분히 설명되지 않으면 제안 태그를 함께 남긴다
- `영향도 분석` 은 `analysis/context.json`, `analysis/file-index.json`, `analysis/manual-reference-tags.json` 을 참고해 관련 파일, 모듈, 흐름, 리스크를 정리한다
- `사용 스킬` 은 `AGENTS.md` 와 `.codex/skills/` 를 참고해 이번 명세/구현에 사용할 프로젝트 전용 스킬을 적는다

### `.sdd/specs/<spec-slug>/chat.jsonl`

역할:

- 명세서별 append-only 이벤트 로그

권장 레코드 필드:

- `id`
- `createdAt`
- `type`
- `specVersion`
- `role` (message 계열 이벤트일 때)
- `message` (message 계열 이벤트일 때)
- `patchId` (patch 계열 이벤트일 때)
- `payload`

권장 이벤트 타입:

- `user_message`
- `assistant_message`
- `patch_proposed`
- `patch_applied`
- `patch_rejected`

즉, `chat.jsonl`은 단순 대화 배열이 아니라 projection 가능한 이벤트 로그로 유지한다.

### `.sdd/specs/<spec-slug>/patches/<patch-id>.json`

역할:

- 채팅으로부터 생성된 수정안

권장 필드:

- `schemaVersion`
- `id`
- `baseVersion`
- `proposedVersion`
- `summary`
- `status`
- `revision`
- `sectionsChanged`
- `createdAt`

### `.sdd/runs/<run-id>.json`

역할:

- 이후 Codex 실행 준비 또는 실행 결과 기록

권장 필드:

- `schemaVersion`
- `id`
- `specVersion`
- `snapshot`
- `candidateFiles`
- `status`
- `summary`

여기서 `snapshot`은 MVP 기준으로는 Git commit snapshot이 아니라 `lastAnalyzedAt` 시점의 로컬 분석 기준을 뜻한다.

## source of truth 규칙

spec 단위에서는 아래처럼 고정한다.

- 진실의 원본: `specs/<spec-slug>/meta.json`
- 버전 원본: `specs/<spec-slug>/versions/*`
- 인덱스/캐시: `specs/index.json`

즉, `index.json`과 `meta.json`이 어긋나면 `meta.json` 기준으로 복구한다.

권장 복구 방식:

1. `specs/` 하위 `meta.json`들을 스캔
2. `index.json` 재생성
3. 손상된 index는 덮어써도 됨

### 앱 전역 설정 파일

역할:

- 프로젝트와 직접 관계없는 로컬 편의 정보 저장

권장 예시:

- 최근 열어본 프로젝트 목록
- 마지막 열었던 창 상태
- 사용자 UI 설정

예시 위치:

- `~/.sdd-app/settings.json`

## 구현시 권장 규칙

- 명세 버전은 덮어쓰기보다 `versions/` 누적 저장
- 채팅은 append-only `jsonl`
- 분석 결과는 최신본 + 필요 시 snapshot 분리
- 사람이 직접 열어봐도 이해 가능한 파일명 사용
- `.sdd/` 내부 구조는 초기에 고정
- repository read 직후 runtime schema validation 수행
- 변경 가능한 JSON은 revision 또는 updatedAt 기준 충돌 검사 수행

## 장점과 주의점

### 장점

- DB 없이 바로 시작 가능
- 프로젝트와 함께 이동/백업 가능
- Git에 포함하기로 결정하면 추적이 쉬움
- 단일 사용자 로컬 도구에 잘 맞음

### 주의점

- 동시 편집과 충돌 처리에는 약함
- 검색/집계 성능은 DB보다 불리함
- 파일 규칙이 흐트러지면 금방 복잡해짐
- `.sdd/`를 Git에 포함할지 여부는 아직 정책 결정이 필요함
