# Engineering Conventions

## 목적

이 문서는 실제 구현 단계에서 코드 스타일과 구조가 흔들리지 않도록, 팀 공통 기준을 미리 고정하는 문서다.

이 문서의 목표는 아래다.

- 코드 읽기 비용 줄이기
- 파일/함수 책임 명확히 하기
- Electron, React, 파일 저장 경계를 일관되게 유지하기
- 나중에 리팩터링과 테스트가 쉬운 구조 만들기

## 1. 기본 원칙

- 단순한 코드를 우선한다.
- 한 파일과 한 함수는 하나의 주된 책임만 가진다.
- UI는 화면만, 유스케이스는 흐름만, 저장소는 파일 I/O만 담당한다.
- 도메인 규칙과 외부 의존성은 분리한다.
- 저장 포맷과 IPC 채널은 코드 전역에 흩뿌리지 않는다.
- 규칙은 문서가 아니라 lint와 테스트로 가능한 한 강제한다.
- 프로젝트를 다시 열었을 때 유지돼야 하는 화면 상태는 브라우저 임시 상태가 아니라 프로젝트 저장소와 use case를 통해 관리한다.

## 2. 기술 기본값

현재 기준 기본값은 아래로 고정한다.

- 언어: `TypeScript`
- UI: `React`
- 앱: `Electron`
- 포맷터: `Prettier`
- 린트: `ESLint`
- 테스트: `Vitest + Playwright(Electron)`

추가 원칙:

- 새 소스 파일은 기본적으로 `TypeScript`만 사용한다.
- 특별한 이유가 없으면 plain JavaScript 파일을 추가하지 않는다.
- TypeScript는 `strict` 모드 전제로 설계한다.

추가로 아래 플래그를 기본 활성화한다.

- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`
- `useUnknownInCatchVariables`
- `noImplicitOverride`
- `noFallthroughCasesInSwitch`

## 3. 포맷 컨벤션

### 기본 포맷 규칙

- 인코딩: `UTF-8`
- 줄바꿈: `LF`
- 들여쓰기: `2 spaces`
- 세미콜론: 사용
- 문자열: 기본 `single quote`
- trailing comma: 허용
- 한 줄 길이: `100`자 기준
- 파일 끝 newline: 반드시 추가

### Prettier 기본값

권장 기본값:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Editor 규칙

- 저장 시 자동 포맷 적용
- 저장 시 trailing whitespace 제거
- 저장 시 final newline 보장

## 4. 린트 컨벤션

### ESLint 기본 목표

ESLint는 단순 스타일보다 "버그 방지 + 경계 강제"에 집중한다.

반드시 강제할 항목:

- unused import / unused variable 금지
- floating promise 금지
- misused promise 금지
- `any` 남발 금지
- type-only import 분리
- exhaustive switch 강제
- React hooks 규칙 강제
- layer boundary 위반 금지
- renderer에서 파일 시스템 직접 접근 금지
- default export 금지

### 권장 린트 규칙 범주

- TypeScript 안정성
- React hooks 안정성
- import 정렬 및 순서
- 레이어/기능 경계 위반 탐지
- 복잡도 과다 함수 탐지

### console 규칙

- `renderer`에서는 `console.log` 사용 금지
- `main`과 `infrastructure`는 제한적으로 허용
- 장기적으로는 `logger` 인터페이스로 통일

## UI/UX 원칙

- 사용자 화면은 지금 할 수 있는 작업 중심으로 설계한다.
- 내부 로드맵, 향후 확장 계획, experimental 여부, transport/app-server/mcp 같은 엔지니어링 정보는 기본 UI 문구에 노출하지 않는다.
- 구현 제약을 알려야 할 때도 사용자 행동 기준으로 짧게 설명하고, 자세한 배경은 내부 문서에 남긴다.
- 연결되지 않은 기능은 과장해서 보이지 않게 하고, 가능한 행동만 명확히 노출한다.
- 분석 관련 관계 정보는 중앙 `분석` workspace에서 보여주고, 오른쪽 사이드바는 채팅 역할에만 사용한다.
- 문서 맵 연결선이나 파일 참조선은 UI가 임의 생성하지 말고 저장된 분석 계약을 렌더링한다.

## 5. 네이밍 컨벤션

### 파일/폴더

- 폴더명: `kebab-case`
- 일반 파일명: `kebab-case`
- React 컴포넌트 파일명: `PascalCase.tsx`
- 테스트 파일명: `*.test.ts`, `*.test.tsx`
- fixture 파일명: 목적이 보이게 명명

예시:

- `features/specs/spec-list-panel/`
- `apply-spec-patch.use-case.ts`
- `SpecEditorPanel.tsx`
- `fs-spec.repository.ts`

### 코드 심볼

- 변수/함수: `camelCase`
- 타입/인터페이스/클래스/컴포넌트: `PascalCase`
- 상수: `UPPER_SNAKE_CASE`는 진짜 상수에만 사용
- enum 대신 가능한 경우 string literal union + transition 함수 우선

### boolean 이름

- `is`, `has`, `can`, `should` 접두어 사용

좋은 예:

- `isApproved`
- `hasPendingPatch`
- `canApplyPatch`

## 6. import 규칙

### 기본 원칙

- import는 위에서 아래로 의존성이 내려가야 한다.
- 상위 레이어가 하위 구현을 알아도, 반대는 금지한다.
- 상대경로 `../../../../` 남발 금지

### 권장 순서

1. Node/Electron 내장 모듈
2. 외부 패키지
3. 앱 내부 alias import
4. 같은 feature 내부 상대 import

### alias 권장

- `@/domain`
- `@/application`
- `@/infrastructure`
- `@/renderer`
- `@/shared`

### 금지 규칙

- `renderer`가 `infrastructure/fs` 직접 import 금지
- `domain`이 `react`, `electron`, `fs` import 금지
- `application`이 `renderer` import 금지
- feature가 다른 feature의 내부 파일을 직접 import 금지
- cross-feature 접근은 public API를 통해서만 허용

예시:

- 허용: `@/renderer/features/specs`
- 금지: `@/renderer/features/specs/internal/spec-diff-utils`

## 7. 파일 분리 원칙

### 한 파일의 책임

한 파일은 하나의 "주된 이유로만" 변경되도록 유지한다.

좋은 예:

- 하나의 use case
- 하나의 repository
- 하나의 React component
- 하나의 state transition 규칙

나쁜 예:

- 한 파일 안에 UI + 파일 저장 + 상태 전이 + IPC 처리 전부 섞기

### 파일 크기 가이드

엄격한 제한은 아니지만, 아래를 넘으면 분리 검토한다.

- React component file: `200`줄 이상이면 분리 검토
- use case file: `150`줄 이상이면 분리 검토
- repository file: `200`줄 이상이면 serializer/mapper 분리 검토
- 함수 길이: `40`줄 이상이면 분리 검토

### export 규칙

- 파일당 하나의 대표 export 권장
- default export 금지
- 내부 전용 helper는 file-private로 유지

### barrel 규칙

- 무분별한 `index.ts` export 집합 금지
- feature의 public API가 필요한 경우에만 제한적으로 사용

## 8. 함수/메서드 생성 원칙

### 기본 원칙

- 함수는 하나의 동사적 의도를 표현해야 한다
- 입력과 출력이 명확해야 한다
- 부작용은 가능한 한 함수 바깥 경계에서 수행한다
- 숨은 상태 변경보다 반환값을 선호한다

### 매개변수 규칙

- 인자가 `3개`를 넘으면 object parameter 검토
- boolean flag 파라미터는 가능한 한 피한다

나쁜 예:

```ts
updateSpec(specId, true, false, true);
```

좋은 예:

```ts
updateSpec({
  specId,
  approveAfterApply: true,
  createNewVersion: true,
});
```

### 함수 분리 기준

아래가 동시에 들어가면 분리 검토한다.

- validation
- state transition
- file save
- mapping
- logging
- UI formatting

예를 들어 `applySpecPatch`가 너무 커지면 아래처럼 나눈다.

- `validatePatch`
- `buildNextVersion`
- `saveNextVersion`
- `updateSpecMeta`

### 반환 규칙

- 성공/실패를 숨기지 않는다
- use case는 명시적인 result를 반환
- `null`/`undefined`만으로 실패를 표현하지 않는다

## 9. 클래스 사용 원칙

이 프로젝트는 함수 우선 구조를 권장한다.

클래스를 써도 되는 경우:

- repository adapter
- long-lived coordinator
- JobRunner
- 상태를 가진 external adapter

클래스를 피하는 경우:

- 단순 mapper
- 순수 domain rule
- 작은 utility
- 단순 use case orchestration

## 10. React 컨벤션

### 컴포넌트 원칙

- 화면 컴포넌트는 표현과 이벤트 연결에 집중
- 비즈니스 규칙은 use case로 이동
- 컴포넌트 안에서 `.sdd` 구조를 직접 알지 않음
- 큰 화면은 container + presentational 분리 가능

### hook 규칙

- 커스텀 hook은 재사용 가능한 상태/행동만 담는다
- hook 안에 무거운 비즈니스 로직을 넣지 않는다
- hook 이름은 `use`로 시작

### 상태 관리 규칙

store는 화면 상태 중심으로만 사용한다.

store에 넣어도 되는 것:

- 현재 선택 프로젝트
- 현재 선택 명세
- 현재 열려 있는 patch preview
- 진행 중 작업 상태

store에 넣지 않는 것:

- 파일 저장 로직
- 상태 전이 규칙
- `.sdd` 파싱 규칙

### 컴포넌트 분리 기준

아래 중 2개 이상이면 분리 검토:

- 렌더링 블록이 3개 이상
- 이벤트 핸들러가 5개 이상
- 내부 state가 5개 이상
- 조건부 렌더링이 깊게 중첩

## 11. Electron / IPC 컨벤션

### 레이어 역할

- `main`: OS/프로세스 작업, 파일 시스템, 장기 작업 시작
- `preload`: typed bridge만 담당
- `renderer`: 화면과 사용자 상호작용만 담당

### IPC 채널 규칙

- 채널명은 `feature.action`
- 유스케이스 단위로 만든다
- request/response와 progress event를 구분한다

예시:

- `project.select`
- `project.analyze`
- `project.analyze.progress`
- `spec.generate-draft`
- `spec.apply-patch`

### preload 규칙

- `ipcRenderer.invoke`를 renderer에서 직접 호출하지 않는다
- preload는 `window.sdd` 같은 facade만 노출
- preload에서 비즈니스 로직 금지

### payload 규칙

- 모든 IPC payload와 response는 runtime schema로 검증
- `zod` 같은 스키마 기반 검증 권장

## 12. domain / use case / repository 컨벤션

### domain

- 외부 라이브러리 의존 최소화
- 순수 규칙과 상태 전이 중심
- 가능한 한 순수 함수 기반

### use case

- 사용자 의도 기준으로 분리
- 하나의 use case는 하나의 주요 결과만 책임
- UI 포맷이나 파일 경로 계산 금지

### repository

- 파일 읽기/쓰기 + 직렬화 책임만 가짐
- business rule 넣지 않음
- atomic write 기본 적용
- read 직후 runtime schema validation 수행

### 에러 반환 표준

레이어별 규칙을 아래처럼 고정한다.

- `domain`
  - 가능한 한 순수 규칙 유지
  - 예외를 최소화하고 명시적 validation 결과 선호
- `application/use case`
  - 기본 반환 타입은 `Result<T, AppError>`
  - UI에 넘길 수 있는 오류는 `AppError`로 통일
- `infrastructure`
  - 내부 예외를 잡아 `AppError` 또는 repository 전용 error로 변환
  - raw error를 그대로 renderer까지 올리지 않음

즉, use case 바깥으로는 "예상 가능한 실패 형태"만 노출하고, 예외는 boundary에서 정리한다.

### analyzer

- pipeline 단계별 분리
- framework별 strategy 분리
- analyzer 선택은 factory가 담당

## 13. `.sdd` 저장 컨벤션

### JSON 규칙

- pretty print `2 spaces`
- `schemaVersion` 필드 포함
- 날짜는 ISO 8601 문자열 사용
- 파일 저장은 atomic write
- repository가 읽은 직후 runtime schema validation 수행

### markdown 규칙

- 명세는 version 파일로만 저장
- 기존 버전 수정 금지
- 최신 버전 pointer는 `meta.json`이 관리

### JSONL 규칙

- `chat.jsonl`은 append-only
- 기존 줄 수정 금지
- 정정이 필요하면 새 이벤트 추가
- message log가 아니라 event log로 취급
- `type` 필드는 필수

### patch 규칙

- patch는 항상 별도 json 파일로 저장
- patch 적용은 copy-on-write
- 중복 patch 적용 방지 검사 필수

### 다중 파일 저장 규칙

`.sdd`는 한 번의 유스케이스에서 여러 파일을 함께 바꿀 수 있으므로, 부분 성공 복구 규칙을 미리 정한다.

권장 쓰기 순서:

1. 새 version 파일 생성
2. patch 상태 파일 갱신
3. chat 이벤트 append
4. 마지막에 `meta.json`과 `index.json` pointer 갱신

기본 원칙:

- `meta.json`을 최종 commit pointer처럼 취급한다
- 앞 단계 파일이 있어도 `meta.json`이 갱신되지 않았으면 반영 실패로 본다
- 재시도는 idempotent command 기준으로 수행한다
- 복구 기준 파일은 항상 `meta.json.latestVersion`
- `specs/index.json`은 파생 인덱스이므로 source of truth로 취급하지 않는다

즉, 중간 파일이 일부 남아도 최종 기준은 pointer 파일이 결정한다.

## 14. 에러 처리 컨벤션

### 기본 원칙

- 에러를 삼키지 않는다
- 사용자 메시지와 내부 원인을 분리한다
- boundary에서 domain-friendly error로 변환한다
- 예외와 Result 방식을 레이어마다 섞지 않는다

### 권장 분류

- validation error
- file system error
- concurrency error
- analysis error
- ipc contract error

### UI 규칙

- renderer는 raw stack을 그대로 사용자에게 보여주지 않는다
- 사용자에게는 행동 가능한 문장으로 보여준다

좋은 예:

- `명세를 반영할 수 없습니다. 기준 버전이 이미 변경되었습니다.`

## 15. 테스트 컨벤션

### 우선순위

1. domain/state transition
2. use case
3. repository integration
4. IPC contract
5. Electron E2E
6. component test

### 테스트 규칙

- 상태 전이는 순수 함수 테스트
- use case는 mock port로 테스트
- repository는 temp directory 기반 테스트
- 분석기는 fixture 프로젝트 기반 회귀 테스트
- markdown/patch 결과는 golden file 테스트

### fixture 규칙

- `tests/fixtures/projects/`
- `tests/fixtures/sdd/`
- fixture는 가능한 한 작고 읽기 쉽게 유지

### 계약 테스트 규칙

- repository는 실제 `.sdd` 샘플 구조를 읽고 쓰는 contract test를 가진다
- IPC는 payload/response 스키마 contract test를 가진다
- `.sdd` migration이 생기면 구버전 fixture 테스트를 추가한다

## 16. 주석과 문서화 규칙

### 주석 원칙

- "무엇"보다 "왜"를 적는다
- 자명한 코드는 주석 달지 않는다
- TODO는 책임과 맥락 없이 남기지 않는다

좋은 예:

```ts
// patch baseVersion이 다르면 오래된 화면에서 생성된 제안이므로 반영하지 않는다.
```

나쁜 예:

```ts
// spec title을 설정한다.
```

### 문서화 원칙

- public boundary(use case, repository port, IPC facade)는 문서화 우선
- 복잡한 저장 포맷은 예제와 함께 문서화
- 컨벤션 변경 시 문서 먼저 수정

## 17. 장기 작업 취소 규칙

분석, 명세 초안 생성, 대형 patch 생성 같은 장기 작업은 취소 가능해야 한다.

기본 규칙:

- 모든 장기 작업 경계는 `AbortSignal` 또는 동등한 cancel token을 받는다
- JobRunner는 취소 상태를 추적한다
- 취소 시 중간 결과를 최종 반영하지 않는다
- 취소 이벤트도 로그 또는 상태로 남긴다

적용 대상:

- 프로젝트 분석
- 재분석
- 명세 초안 생성
- patch 생성

## 18. 금지 목록

아래는 초기에 명시적으로 금지하는 편이 좋다.

- renderer에서 직접 `fs` 접근
- renderer에서 `.sdd` 파일 경로 조립
- `any`로 임시 우회
- giant `utils.ts`
- giant `types.ts`
- 상태 전이 문자열 직접 수정
- 기존 명세 버전 파일 덮어쓰기
- `chat.jsonl` 재정렬/수정
- default export 남발
- 하나의 함수에서 validation + 상태 전이 + 파일 저장 + UI 메시지 조립 전부 처리

## 19. 최종 권장안

현재 기준으로 구현 시 지켜야 할 최소 컨벤션 세트는 아래다.

- 구조: `Clean/Hexagonal + Feature-based`
- 코드 스타일: `TypeScript strict + ESLint + Prettier`
- 저장: `Repository + Atomic Write`
- 명세 관리: `Versioned Document + State Machine`
- 채팅 이력: `Append-only JSONL`
- IPC: `Typed IPC Facade`
- 테스트: `Use case 우선 + temp directory integration + fixture regression`

이 문서를 기준으로 실제 repo를 만들면, 초반 속도를 해치지 않으면서도 나중에 유지보수가 가능한 수준의 일관성을 확보할 수 있다.
