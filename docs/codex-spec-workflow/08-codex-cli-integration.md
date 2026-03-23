# Codex CLI Integration

## 목적

이 문서는 현재 구상 중인 로컬 앱에서 `Codex CLI`를 어떻게 연결할지 정리한 문서다.

핵심 질문은 아래다.

- 앱이 Codex를 일회성으로 호출할 것인가
- 명세서별 채팅처럼 장기 세션으로 붙일 것인가
- MCP 기반으로 다른 에이전트/도구와 연결할 것인가

## 결론

현재 제품 방향 기준으로는 아래처럼 가는 것이 가장 좋다.

### 1차 MVP

- `codex exec` 사용
- 목적:
  - 프로젝트 분석 요약
  - 명세 초안 생성
  - patch 초안 생성
- 앱이 `main process`에서 CLI를 subprocess로 실행
- 결과는 JSONL 또는 구조화 JSON으로 받고
- 실제 `.sdd` 저장은 앱이 직접 수행

### 2차 고도화

- 명세서별 채팅 UI를 깊게 붙일 때 `codex app-server`를 검토
- 이유:
  - 대화 스레드
  - 승인 흐름
  - 스트리밍 이벤트
  - 풍부한 클라이언트 연동

주의:

- 현재 로컬 CLI 기준 `app-server`는 experimental이다
- 따라서 2차 기본 경로로 단정하지 않고, 고도화 옵션으로 본다

### MCP는 언제 쓰는가

- 앱이 이미 MCP client 또는 Agents SDK 기반일 때만 고려
- 일반 Electron 앱에 처음 붙일 때는 `exec` 또는 `app-server`가 더 자연스럽다

## 연결 방식 비교

### Option A. `codex exec`

가장 단순한 연결 방식이다.

좋은 경우:

- 한 번 실행해서 결과만 받는 작업
- 프로젝트 분석
- 명세 초안 생성
- 명세 수정 제안 생성
- CI/배치/자동화

장점:

- 구현이 가장 단순하다
- subprocess 실행만 하면 된다
- `--json`으로 이벤트 스트림을 받을 수 있다
- `--output-schema`로 구조화 결과를 강제할 수 있다

단점:

- 장기 대화형 UX에는 덜 적합
- 스레드/승인/세션 제어가 `app-server`보다 단순하다

추천도:

- 현재 MVP에 가장 적합

### Option B. `codex app-server`

깊은 제품 통합용으로 검토할 수 있는 방식이다.

좋은 경우:

- 명세서별 채팅
- 승인 흐름
- 스트리밍 이벤트 UI
- 장기 세션 유지
- rich client 형태의 통합

장점:

- Codex rich client용 인터페이스에 가깝다
- stdio 또는 websocket 기반 JSON-RPC로 연결 가능
- thread / turn / notification 흐름을 다룰 수 있는 방향이다

단점:

- `exec`보다 구현이 복잡하다
- 클라이언트 프로토콜 구현이 필요하다
- 현재 CLI 기준 experimental 상태다

추천도:

- 명세서 채팅 UX를 본격적으로 붙일 시점에 적합

### Option C. `codex mcp-server`

Codex를 MCP 서버로 실행하는 방식이다.

좋은 경우:

- 앱이 MCP client를 이미 구현했을 때
- Agents SDK 기반 멀티 에이전트 구조일 때
- Codex를 하나의 tool/provider처럼 붙이고 싶을 때

장점:

- MCP 생태계와 자연스럽게 연결된다
- 다른 agent stack과 조합하기 쉽다

단점:

- 일반 Electron 앱에는 오히려 우회층이 하나 더 생긴다
- 처음 MVP에는 과할 수 있다

추천도:

- 현재 MVP에는 비추천

## 현재 제품에 대한 추천

현재 제품은 아래 특성을 가진다.

- 개발자 1인이 자기 노트북에서 실행
- 로컬 프로젝트 폴더를 선택
- 분석 결과와 명세를 `.sdd/`에 저장
- 별도 백엔드 서버 없음

이 조건에서는 아래처럼 가는 것이 가장 안전하다.

### 추천 단계

1. 먼저 `codex exec`로 시작
2. 명세 채팅 UX가 커지면 `codex app-server`를 옵션으로 검토
3. MCP는 나중에 정말 필요할 때만 검토

## Electron 연결 위치

Codex CLI 연결은 반드시 `renderer`가 아니라 `main process`에서 담당한다.

### 역할 분리

- `renderer`
  - 사용자 입력
  - 진행 상태 표시
  - 결과 렌더링
- `preload`
  - typed IPC facade
- `main`
  - `codex` subprocess 실행
  - stdout/stderr 이벤트 수집
  - 취소/종료 관리
  - 결과를 use case에 전달

즉, React 화면이 직접 `codex`를 호출하면 안 된다.

## 1차 MVP 추천 연결 방식

### 흐름

1. renderer에서 "분석 시작" 클릭
2. preload가 `window.sdd.codex.runAnalysis(...)` 호출
3. main process가 `codex exec` subprocess 실행
4. JSONL 이벤트를 읽어 진행률을 renderer에 전달
5. 최종 결과를 use case가 파싱
6. 앱이 `.sdd/analysis` 또는 `.sdd/specs`에 저장

### 권장 원칙

- Codex는 결과 생성만 담당
- `.sdd` 파일 저장은 앱이 담당
- Codex subprocess는 기본적으로 read-only 권한을 우선 검토
- 실제 코드 수정 자동화는 MVP 이후 단계로 보류

주의:

- 앱이 `.sdd/`를 프로젝트 내부에 저장하려면 대상 프로젝트 경로에 대한 쓰기 권한은 별도로 필요하다
- 즉, "Codex subprocess read-only"와 "앱의 `.sdd` 저장 가능"은 분리해서 생각한다
- 프로젝트가 읽기 전용이면 임시 분석만 허용하거나 명확한 오류로 종료하는 정책이 필요하다

## `codex exec` 예시

### 분석/명세 초안용

```bash
codex exec \
  --json \
  --output-schema ./schema.json \
  --output-last-message ./last-message.txt \
  -C /path/to/project \
  "Analyze this repository and return a structured project summary for spec generation."
```

### 특징

- `--json`은 진행 이벤트/중간 이벤트 스트림용이다
- `--output-schema`는 최종 응답 형태를 구조화하는 용도다
- `--output-last-message`는 앱이 읽을 최종 결과 payload를 안정적으로 분리하는 용도다
- Git 저장소가 아니면 `--skip-git-repo-check`를 검토할 수 있다

앱 계약 권장안:

1. stdout JSONL은 progress/event 용도로만 사용
2. 최종 결과는 `--output-last-message` 파일을 canonical output으로 사용
3. 구조화 응답이 필요하면 `--output-schema`와 앱 측 validation을 함께 사용

### 앱에서 권장 사용 방식

- 프로젝트 분석
- 명세 초안 생성
- patch proposal 생성

## `codex app-server` 예시

이 방식은 richer integration용이다.

### 개념 흐름

공식 예시 기준으로는 JSON-RPC 초기화 후 thread/turn 계열 흐름을 사용하게 된다.

다만 실제 세부 프로토콜은 CLI 버전 변화에 민감할 수 있으므로, 구현 시점에는 생성된 스키마나 공식 프로토콜 문서를 source of truth로 삼는다.

### 언제 도입할까

- 명세서별 채팅을 진짜 대화형으로 운영할 때
- 승인/이력/이벤트를 UI에 촘촘히 반영하고 싶을 때

## `codex mcp-server` 예시

이 방식은 앱이 MCP client일 때 고려한다.

### 개념

- `codex mcp-server`를 subprocess로 실행
- MCP client가 `codex` tool 호출
- prompt와 설정을 tool input으로 전달

### 현재 추천 여부

- 현 단계에서는 Electron MVP 기준 우선순위가 낮다

이유:

- Electron 앱에 필요한 것보다 추상화가 한 단계 많다

## 인증 방식

Codex CLI는 크게 두 방식으로 인증할 수 있다.

### 1. ChatGPT 로그인

좋은 경우:

- 개발자 개인 로컬 사용
- 수동 실행 중심

장점:

- 개인 개발 환경에서 바로 시작하기 쉽다

주의:

- 앱이 programmatic workflow로 깊게 사용할수록 관리가 애매해질 수 있다

### 2. API key 로그인

좋은 경우:

- 앱 내부에서 programmatic하게 Codex를 호출
- 자동화 작업
- 향후 CI/CD 또는 background run 고려

장점:

- 자동화에 더 적합
- 실행 환경을 통제하기 쉽다

현재 추천:

- 자동화나 앱 내부 호출이 많아질수록 API key 방식이 관리가 쉽다
- 개인 로컬 사용만 하면 ChatGPT 로그인도 충분히 가능하다

## 안전한 권한 전략

### 분석/명세 생성 단계

- 기본 read-only
- Codex는 결과 텍스트/구조화 결과만 반환
- 파일 저장은 앱이 수행

### 나중에 코드 수정 자동화 단계

- 사용자가 명시적으로 승인했을 때만 수정 모드 허용
- 최소 권한부터 시작
- `danger-full-access`는 통제된 환경에서만 검토

## 추천 구현 순서

### Step 1

- 앱에서 `codex exec` 한 번 호출하기
- 프로젝트 분석 결과를 JSON으로 받기

### Step 2

- `.sdd/analysis` 저장 연결
- 명세 초안 생성용 schema 설계

### Step 3

- patch proposal 생성용 `codex exec` 추가

### Step 4

- 명세서별 채팅 UX 필요성이 커지면 `app-server`로 전환 검토

## 최종 추천안

현재 요구사항 기준 최종 추천은 아래다.

- 지금은 `codex exec`
- 나중에 채팅이 깊어지면 `codex app-server`를 검토
- `mcp-server`는 MCP/Agents SDK가 필요할 때 검토
- 인증은 앱 통합용이면 API key 권장
- `main process`에서 subprocess로 관리하고, `renderer`는 IPC만 사용
