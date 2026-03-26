# Design Patterns

## 목적

이 문서는 실제 구현 단계에서 유지보수가 쉬운 구조를 만들기 위해, 이 프로젝트에 맞는 설계 패턴을 지정하는 문서다.

핵심 원칙은 아래다.

- 과한 추상화보다 명확한 경계를 우선
- 파일 시스템, Electron, LLM 호출 같은 바깥 의존성은 안쪽 로직과 분리
- 기능별로 묶고, 공통 규칙은 얇게 공유
- 상태 전이는 코드로 강제

## 가장 추천하는 전체 구조

이 프로젝트에는 `가벼운 Clean/Hexagonal Architecture + Feature-based module structure + Typed IPC` 조합이 가장 잘 맞는다.

의미는 아래와 같다.

- 비즈니스 규칙은 중심에 둔다
- 파일 시스템, Electron IPC, LLM 호출은 바깥 어댑터로 둔다
- 폴더 구조는 기능 단위로 나눈다

즉, "계층은 논리적으로 분리하고, 실제 코드는 기능 기준으로 묶는 방식"이다.

## 1. 아키텍처 패턴

### 1) Ports and Adapters

가장 중요한 기본 패턴이다.

적용 대상:

- 프로젝트 읽기
- `.sdd/` 저장
- Electron IPC
- LLM/Codex 호출

왜 쓰는가:

- 구현체를 바꿔도 핵심 로직이 흔들리지 않는다
- 테스트에서 파일 시스템과 IPC를 쉽게 대체할 수 있다

예시:

- Port
  - `ProjectRepository`
  - `SpecRepository`
  - `ChatLogRepository`
  - `ProjectAnalysisGateway`
  - `CodexGateway`
- Adapter
  - `FsProjectRepository`
  - `FsSpecRepository`
  - `JsonlChatLogRepository`
  - `ElectronIpcAdapter`
  - `CodexExecAnalyzerAdapter`

권장 규칙:

- renderer는 파일 시스템을 직접 읽지 않는다
- use case는 Electron API를 직접 호출하지 않는다
- 도메인/유스케이스는 항상 port 인터페이스만 안다
- 문서 맵처럼 프로젝트에 귀속되는 UI 배치 상태는 renderer 임시 state로 끝내지 말고 `.sdd/analysis/context.json`을 통해 저장한다
- 문서 맵 연결선과 파일별 참조 관계도 분석 산출물로 함께 저장하고, renderer가 임의로 생성하지 않는다
- 구조 발견 결과, 미해결 참조, 스캔 한도 도달 정보도 분석 산출물에 포함하고 renderer가 별도 규칙으로 추정하지 않는다
- 수동 reference-tag/assignment는 analyzer 출력과 분리된 별도 분석 파일로 보존하고, `file-index.json` 재생성으로 덮어쓰지 않는다
- renderer는 수동 태그를 local-only state로 두지 말고 use case/repository 경계를 통해 저장한다

### 2) Feature-based Module Structure

코드는 기술 종류별이 아니라 기능별로 묶는 편이 유지보수에 좋다.

권장 기능 단위:

- `project-import`
- `analysis`
- `specs`
- `spec-chat`
- `execution-prep`
- `settings`

좋은 예:

- `features/specs/`
  - 명세 목록
  - 명세 조회
  - 명세 저장
  - 명세 상태 전이
  - 명세 단위 채팅 연결

피해야 할 예:

- `components/`
- `services/`
- `utils/`

이런 폴더만 지나치게 커지면 나중에 책임이 섞이기 쉽다.

### 2-1) Aggregate Root

파일 기반 저장에서도 aggregate 경계를 두는 편이 좋다.

권장 aggregate:

- `Project`
- `SpecDocument`

의미:

- `Project`는 프로젝트 전체 설정과 분석 기준의 루트
- `SpecDocument`는 버전, 상태, patch 적용 규칙의 루트

권장 규칙:

- 여러 파일을 바꾸는 작업도 aggregate 단위 유스케이스로 처리
- UI는 개별 파일이 아니라 aggregate 결과를 바라봄

## 2. 애플리케이션 패턴

### 3) Use Case Pattern

사용자 액션마다 유스케이스를 하나씩 두는 방식이다.

적용 대상:

- 프로젝트 가져오기
- 프로젝트 분석 실행
- 명세 초안 생성
- 명세 수정안 생성
- 명세 반영
- 작업 준비 입력 생성

예시:

- `ImportProjectUseCase`
- `AnalyzeProjectUseCase`
- `GenerateInitialSpecUseCase`
- `ProposeSpecPatchUseCase`
- `ApplySpecPatchUseCase`
- `PrepareExecutionContextUseCase`

왜 쓰는가:

- UI 코드와 핵심 로직이 섞이지 않는다
- 테스트 대상이 명확하다
- 어떤 액션이 어떤 저장소를 건드리는지 추적이 쉽다

권장 규칙:

- 유스케이스 하나는 하나의 사용자 의도를 처리한다
- 유스케이스는 성공/실패 결과를 명시적으로 반환한다
- 유스케이스 안에서 파일 경로나 IPC 이벤트를 직접 계산하지 않는다

### 4) Command Pattern

`적용`, `재분석`, `초안 생성`, `patch 반영` 같은 실행 액션은 command처럼 다루는 편이 좋다.

적용 이유:

- 나중에 작업 이력 기록이 쉬움
- 재시도와 취소 지점이 명확해짐
- UI 버튼과 실행 로직을 안정적으로 연결할 수 있음

가볍게 적용하면 충분하다.

- `command type`
- `payload`
- `handler`

완전한 커맨드 버스까지는 초기 MVP에서 필요 없다.

patch 반영에는 특히 command 형태가 잘 맞는다.

예시:

- `ApplySpecPatchCommand`
- `ApproveSpecVersionCommand`
- `ReanalyzeProjectCommand`

### 5) State Machine Pattern

이 프로젝트에서는 반드시 필요한 패턴이다.

적용 대상:

- 명세 상태
  - `draft -> proposed -> approved -> superseded`
- 실행 상태
  - `queued -> running -> blocked -> completed`

왜 쓰는가:

- 잘못된 상태 전이를 막을 수 있다
- UI 버튼 활성화 조건이 분명해진다
- 파일 저장 규칙과 상태가 맞물린다

권장 규칙:

- 상태 전이는 enum + transition function으로 관리
- UI에서 직접 문자열 상태를 바꾸지 않는다
- `approveSpec(spec)` 같은 함수가 내부적으로만 상태를 바꾼다

추가 규칙:

- patch 적용 전 상태 전이 가능 여부를 검증
- 같은 patch의 중복 적용을 막는 idempotency 검사를 둔다

## 3. 분석 기능 패턴

### 6) Pipeline Pattern

프로젝트 분석은 파이프라인으로 만드는 편이 좋다.

권장 단계:

1. 프로젝트 문맥 수집
2. 저장소 스캔
3. 구조 발견
4. 언어별 참조 추출
5. 참조 해석/정규화
6. 파일 분류와 참조 맵 초안 생성
7. 연결된 CLI 에이전트 입력 조립
8. `codex exec` 분석 실행
9. 구조화 결과 정규화
10. `.sdd/analysis/*` 문서 저장
11. 명세 초안 입력 생성

왜 쓰는가:

- 각 단계 실패 지점을 분리할 수 있다
- 진행 상태를 UI에 보여주기 쉽다
- 부분 재실행이 가능해진다

권장 분석 산출물:

- `summary.md`
- `purpose.md`
- `structure.md`
- `layers.md`
- `connectivity.md`
- `file-index.json`
- `context.json`

추가 보조 파일:

- `manual-reference-tags.json`

추가 권장 구조화 데이터:

- `context.documentLinks`
- `context.fileReferences`
- `file-index.json[].references`

추가 규칙:

- UI는 이 Markdown 문서를 직접 읽는 docs-style 페이지를 우선한다
- Mermaid 코드 블록은 분석 문서 안에 함께 저장하고 렌더링 가능한 블록으로 취급한다
- `manual-reference-tags.json`은 analyzer 재생성 결과가 아니라 사용자 편집 오버레이이므로, `file-index.json`과 별도 유지한다

### 7) Strategy Pattern

언어/프레임워크별 분석 차이는 strategy로 분리하는 것이 좋다.

적용 대상:

- React 분석기
- Next.js 분석기
- Node 백엔드 분석기
- Python 분석기

예시:

- `FrameworkAnalyzer` 인터페이스
- `ReactAnalyzer`
- `NextAnalyzer`
- `NodeServiceAnalyzer`

왜 쓰는가:

- 새 스택 지원이 기존 코드에 미치는 영향을 줄인다
- `if/else` 덩어리를 피할 수 있다

### 8) Factory Pattern

분석기 선택은 factory로 감싸는 편이 깔끔하다.

예시:

- `AnalyzerFactory.detectAndCreate(projectInfo)`

왜 쓰는가:

- strategy 선택 로직이 한 곳에 모인다
- 분석기 생성 규칙을 UI나 유스케이스에 흩뿌리지 않게 된다

## 4. 저장과 문서 관리 패턴

### 9) Repository Pattern

파일 기반 저장에서는 특히 중요하다.

적용 대상:

- `.sdd/project.json`
- `.sdd/analysis/*`
- `.sdd/specs/*`
- `.sdd/runs/*`

예시:

- `ProjectMetaRepository`
- `AnalysisRepository`
- `SpecRepository`
- `RunRepository`

왜 쓰는가:

- JSON/Markdown/JSONL 포맷 차이를 숨길 수 있다
- 나중에 저장 포맷이 바뀌어도 유스케이스를 안 건드려도 된다

권장 규칙:

- repository는 파일 I/O와 직렬화에 집중
- 상태 전이 규칙이나 diff 생성 규칙은 repository 밖에 둔다
- UI와 use case는 파일 경로를 직접 다루지 않는다
- `.sdd` 내부 구조는 repository 뒤에 숨긴다
- 분석 저장소는 사람이 읽는 Markdown 문서와 기계 판독용 JSON 집계를 함께 유지한다
- 연결성 정보는 파일 목록이 아니라 참조 경로와 의존 방향까지 포함한다

### 9-1) Atomic Write Pattern

파일 기반 저장에서는 거의 필수다.

권장 방식:

1. 임시 파일에 먼저 기록
2. flush/fsync
3. 최종 파일명으로 rename

왜 쓰는가:

- 앱 종료나 예외 상황에서 파일이 반쯤 저장되는 문제를 줄인다
- `meta.json`, `index.json`, patch 파일 저장 안정성이 올라간다

특히 아래 파일은 atomic write를 권장한다.

- `.sdd/project.json`
- `.sdd/specs/index.json`
- `.sdd/specs/<spec-slug>/meta.json`
- `.sdd/specs/<spec-slug>/patches/*.json`

### 10) Versioned Document Pattern

명세서는 항상 버전 문서로 다루는 것이 좋다.

권장 방식:

- 현재 문서를 덮어쓰지 않음
- `versions/v1.md`, `v2.md` 식으로 누적
- `meta.json`이 최신 버전을 가리킴

왜 쓰는가:

- 변경 이력 추적이 쉽다
- diff 생성이 단순해진다
- 잘못 반영했을 때 복구가 쉽다

추가 규칙:

- `meta.json.latestVersion`은 현재 기준 버전을 가리키는 pointer 역할만 한다
- 기존 버전 파일은 수정하지 않는다

### 11) Append-only Log Pattern

채팅 기록은 수정형보다 append-only 로그로 유지하는 게 좋다.

적용 방식:

- `chat.jsonl`에 순서대로 누적

왜 쓰는가:

- 이력 보존이 쉽다
- 디버깅이 편하다
- patch 제안과 연결하기 좋다

주의:

- 채팅 로그는 실행 기준 문서가 아니다
- 실행 기준은 항상 버전 문서다

가능하면 이벤트 타입도 나눠두는 것이 좋다.

- `user_message`
- `assistant_message`
- `patch_proposed`
- `patch_applied`

### 11-1) Schema Versioning Pattern

파일 포맷은 초기에 단순해 보여도 금방 바뀐다.

권장 규칙:

- 주요 json 파일에 `schemaVersion` 포함
- reader는 현재 버전과 구버전을 구분
- 필요하면 migration 함수를 둔다

권장 대상:

- `.sdd/project.json`
- `.sdd/specs/index.json`
- `.sdd/specs/<spec-slug>/meta.json`
- patch json
- run json

### 11-2) Optimistic Concurrency Pattern

단일 사용자 앱이어도 중복 클릭, 오래 열린 화면, 다중 창 때문에 충돌이 생길 수 있다.

권장 규칙:

- `revision` 또는 `updatedAt` 기반 검사
- patch 적용 시 baseVersion 불일치 검증
- 오래된 화면에서 저장하려 할 때 충돌 메시지 반환

## 5. Electron/Renderer 패턴

### 12) IPC Facade Pattern

renderer에서 IPC를 직접 여기저기 호출하지 말고 facade로 감싼다.

예시:

- `window.sdd.project.selectFolder()`
- `window.sdd.analysis.run(projectPath)`
- `window.sdd.specs.applyPatch(specId, patchId)`

왜 쓰는가:

- IPC 채널 이름이 흩어지지 않는다
- preload 경계가 명확해진다
- 테스트용 mock을 만들기 쉽다

권장 규칙:

- renderer는 `window.sdd.*` 같은 좁은 API만 사용
- preload는 validation과 bridge 역할만 수행
- main process는 handler 등록만 하고 핵심 로직은 application layer로 위임

### 12-1) Typed IPC Pattern

IPC는 문자열 채널이 늘어나면 빠르게 복잡해진다.

권장 규칙:

- 채널은 유스케이스 단위로 고정
- payload와 response는 런타임 스키마로 검증
- preload가 타입 있는 facade를 노출

예시 채널:

- `project.select`
- `project.analyze`
- `project.analyze.progress`
- `spec.generateDraft`
- `spec.applyPatch`

권장 도구:

- `zod` 같은 런타임 스키마 검증

### 12-2) Job Runner Pattern

분석처럼 오래 걸리는 작업은 IPC handler 안에 직접 전부 넣지 않는 편이 좋다.

적용 대상:

- 프로젝트 분석
- 명세 초안 생성
- 대형 patch 생성

왜 쓰는가:

- 취소, 재시도, 진행률 표시를 한곳에서 관리할 수 있다
- main process handler가 얇아진다

예시 책임:

- 작업 시작
- 진행률 이벤트 발행
- 작업 취소
- 최종 결과 저장

### 13) Presenter / ViewModel-lite Pattern

React 화면에는 도메인 객체를 그대로 뿌리기보다, 화면에 맞는 가공 상태를 두는 편이 좋다.

적용 대상:

- 프로젝트 개요 화면
- 명세 목록 화면
- 명세 diff 화면

왜 쓰는가:

- UI 포맷팅 로직이 도메인에 섞이지 않는다
- 컴포넌트가 가벼워진다

가볍게 적용하면 충분하다.

- query/use case 결과
- mapper
- view state

### 13-1) UI State Separation Pattern

renderer 상태는 한 덩어리 전역 상태로 두지 않는 편이 좋다.

분리 기준:

- `UI state`
  - 현재 선택한 탭
  - 열려 있는 패널
  - 입력 중 draft
- `Document state`
  - 현재 보고 있는 명세
  - patch preview
  - 기준 버전
- `Job state`
  - 분석 진행률
  - 실행 준비 상태

권장:

- store에는 화면 상태만 두고
- 데이터 정합성 기준은 use case 결과와 `.sdd` 파일에 둔다

### 13-2) Progressive Disclosure Pattern

밀도가 높은 workspace UI는 설명을 모두 상시 노출하기보다, 필요한 때만 열리는 도움말로 나누는 편이 좋다.

적용 대상:

- 분석 인스펙터
- 참조/태그 카드
- 플로팅 패널
- 빈 상태와 도움말 문구

왜 쓰는가:

- 맵, 문서, 채팅 같은 핵심 작업 면적을 덜 가린다
- 같은 설명 문구가 카드마다 반복되는 문제를 줄인다
- 사용자는 제목, 상태, 액션만으로 빠르게 스캔하고, 필요할 때만 설명을 연다

권장 규칙:

- 기본 노출은 제목, 상태, 핵심 액션, 선택 맥락, 필요한 수치 위주로 둔다
- 선택형 설명이나 배경 설명은 툴팁, 도움말 버튼, 접이식 보조 패널로 보낸다
- 같은 설명은 여러 카드에 반복하지 말고 하나의 도움말 진입점으로 모은다
- inline 문구는 오류 복구, 빈 상태 다음 행동, 파괴적 액션 경고처럼 즉시 필요한 정보에만 쓴다

## 6. 추천 폴더 구조

아래처럼 나누면 유지보수가 편하다.

```text
src/
  main/
    ipc/
    bootstrap/
  preload/
  renderer/
    app/
    features/
      project-import/
      analysis/
      specs/
      spec-chat/
      execution-prep/
    shared/
  application/
    use-cases/
    ports/
    services/
  domain/
    project/
    spec/
    run/
  infrastructure/
    fs/
    analyzers/
    codex/
    mappers/
```

핵심 규칙:

- `renderer`는 UI
- `application`은 유스케이스
- `domain`은 상태/규칙
- `infrastructure`는 파일 시스템, 분석기, 외부 연동

## 7. 테스트 패턴

### 우선순위

1. domain/state transition 테스트
2. use case 테스트
3. repository 파일 입출력 테스트
4. renderer 핵심 화면 테스트
5. Electron IPC 통합 테스트

### 권장 방식

- 상태 전이는 순수 함수로 테스트
- 유스케이스는 port mock으로 테스트
- repository는 temp directory 기준 테스트
- IPC는 facade 기준 계약 테스트
- fixture 프로젝트 샘플 기반 분석 회귀 테스트
- golden file 기반 markdown/patch 결과 테스트
- Electron 최소 E2E
  - 앱 실행
  - 프로젝트 선택
  - 분석
  - 명세 생성
  - patch 반영

## 8. 피해야 할 패턴

이 프로젝트에서 특히 피하는 게 좋은 것은 아래다.

- 거대한 `utils.ts`
- renderer에서 직접 `fs` 접근
- main process에 모든 로직 몰아넣기
- 상태 문자열을 화면 곳곳에서 직접 수정
- 명세 저장 로직과 명세 상태 전이를 같은 함수에 뒤섞기
- 분석기 선택을 긴 `if/else`로 누적
- 채팅 로그를 수정 가능한 배열 JSON 하나로만 관리

## 9. 최종 추천 조합

현재 요구사항 기준으로 가장 추천하는 패턴 조합은 아래다.

- 전체 구조: `Hexagonal Architecture lite`
- 코드 조직: `Feature-based modules`
- 사용자 액션: `Use Case Pattern`
- 상태 관리: `State Machine Pattern`
- 분석기 선택: `Strategy + Factory`
- 프로젝트 분석: `Pipeline Pattern`
- 저장: `Repository Pattern`
- 파일 저장 안정성: `Atomic Write Pattern`
- 명세 이력: `Versioned Document Pattern`
- 채팅 이력: `Append-only Log Pattern`
- 포맷 진화: `Schema Versioning Pattern`
- 충돌 방지: `Optimistic Concurrency Pattern`
- Electron 경계: `Typed IPC Facade Pattern`

이 조합이면 지금 요구사항에는 충분히 견고하면서도, 과하게 무거워지지 않는다.
