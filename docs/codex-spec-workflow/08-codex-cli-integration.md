# CLI Agent Exec Integration

## 목적

이 문서는 현재 구상 중인 로컬 앱에서 `Codex CLI`, `Claude Code`, `Gemini CLI` 같은 CLI 에이전트를 어떻게 연결할지 정리한 문서다.

핵심 질문은 아래다.

- 앱이 Codex를 일회성으로 호출할 것인가
- 명세서별 채팅처럼 장기 세션으로 붙일 것인가
- MCP 기반으로 다른 에이전트/도구와 연결할 것인가

## 결론

현재 제품 방향 기준으로는 아래처럼 가는 것이 가장 좋다.

### 1차 MVP

- 각 에이전트의 `exec` 계열 단발 실행 경로 사용
- 목적:
  - 프로젝트 구조와 연결성 분석
  - 명세 초안 생성
  - patch 초안 생성
- 앱이 `main process`에서 선택된 CLI 에이전트를 subprocess로 실행
- 결과는 JSONL 또는 구조화 JSON으로 받고
- 실제 `.sdd` 저장은 앱이 직접 수행
- 분석 실행은 고정된 10분 wall timeout보다 activity/progress 기반으로 관리하고, 정체가 확인될 때만 실패로 전환한다
- hard safety cap이 필요하면 별도 상한을 두되, inactivity 기반 중단을 우선한다

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

1. 먼저 선택된 CLI 에이전트의 exec 경로로 시작
2. 명세 채팅 UX가 커지면 `codex app-server`를 옵션으로 검토
3. MCP는 나중에 정말 필요할 때만 검토

## 현재 구현 상태

현재 앱에서는 실제 분석 실행 전에 아래를 먼저 준비한다.

- 앱 전역 설정에서 여러 CLI 에이전트 연결 정보를 함께 관리한다
- 기본 에이전트는 앱 전역 설정에 저장하고, 오른쪽 채팅 패널에서 현재 turn 전에 바꿀 수 있다
- 저장 위치는 프로젝트 내부 `.sdd/`가 아니라 앱 전역 `~/.sdd-app/settings.json` 이다
- 사용자는 PATH 자동 감지 또는 직접 실행 경로 입력을 선택하고 인증 방식, 모델, 지원되는 경우 추론 강도를 기록할 수 있다
- `system` 실행 모드는 process PATH 만 보지 않고, macOS에서는 `/Applications/Codex.app/Contents/Resources/codex`, `~/Applications/Codex.app/Contents/Resources/codex`, `/opt/homebrew/bin/codex`, `/usr/local/bin/codex` 같은 대표 설치 위치도 함께 탐색한다
- Codex 설정이 아직 앱에 저장되지 않았으면 첫 로드에서 `~/.codex/config.toml` 의 `model`, `model_reasoning_effort` 를 기본 참고값으로 읽는다
- `main process`에서 간단한 연결 확인을 수행할 수 있다

현재 MVP capability 기준:

- `Codex CLI`
  - 전체 분석, 자동 참조 태그, 명세 채팅 지원
  - 모델 / 추론 강도 지원
- `Claude Code`
  - 전체 분석, 자동 참조 태그, 명세 채팅 지원
  - 모델 지원
  - 추론 강도 입력은 노출하지 않음
- `Gemini CLI`
  - 명세 채팅 우선 지원
  - 전체 분석 / 자동 참조 태그는 차단하고 짧은 이유를 표시
  - 모델 지원

현재 분석 실행 경로는 먼저 로컬 정적 분석으로 참조 그래프와 기본 분석 초안을 만들고, 선택된 에이전트가 이 기능을 지원할 때만 해당 CLI exec 를 호출해 문서 서술을 보강한다.

분석이 실행 중일 때는 renderer가 typed IPC로 취소를 요청할 수 있고, main process가 로컬 분석 진행 상태와 선택된 CLI exec subprocess 종료, 최종 상태 정리를 함께 담당한다.

현재 채팅 UI에서도 이 설정을 직접 확인하고 바로 조정할 수 있다.

현재 명세 채팅 실행 경로는 renderer가 typed IPC로 현재 turn 의 텍스트와 첨부 binary payload, `agentId` 를 전달하고, main process가 사용자 메시지와 첨부 사본을 먼저 `.sdd/sessions/<session-id>/attachments/<message-id>/` 아래에 저장한 뒤, 저장된 CLI 연결 정보와 현재 선택된 모델/추론 강도를 합쳐 선택된 CLI exec 를 실행한다. 최종 assistant 응답은 세션 로그에 append 하며, prompt 는 선택된 명세 Markdown, 최근 세션 메시지, 저장된 첨부 경로와 필요한 텍스트/code excerpt 를 함께 넘겨 현재 명세 문맥을 유지한다.

아직 분리된 것:

- patch 생성은 다음 단계의 연결 대상으로 남겨둔다

## Electron 연결 위치

CLI 에이전트 연결은 반드시 `renderer`가 아니라 `main process`에서 담당한다.

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

1. renderer에서 `전체 분석` 또는 `참조 분석` 클릭
2. preload가 typed IPC로 main process 실행 요청을 전달
3. main process가 먼저 로컬 정적 분석으로 파일 참조와 기본 구조 초안을 만든다
4. `참조 분석` 요청이면 여기서 종료하고 정적 참조 결과만 저장한다
5. `전체 분석`이고 선택된 에이전트 설정이 이 기능을 지원하면 main process가 해당 CLI exec subprocess를 실행해 문서 서술을 보강한다
6. JSONL 이벤트를 읽어 진행률을 renderer에 전달하고, 필요하면 취소 요청을 받아 subprocess 종료를 시도한다
7. 최종 결과를 use case가 파싱하고, 로컬 정적 참조 결과와 병합한다
8. 취소되지 않은 경우에만 앱이 `.sdd/analysis` 또는 `.sdd/specs`에 저장한다

### 권장 원칙

- 로컬 정적 분석은 참조 그래프와 파일 인덱스의 기본 source를 담당한다
- Codex는 Markdown 문서 서술과 목적/구조 설명 보강을 우선 담당한다
- `.sdd` 파일 저장은 앱이 담당
- 다만 참조 분석은 프로젝트가 읽기 전용일 때 저장 없이 현재 화면에만 임시 표시할 수 있다
- Codex subprocess는 기본적으로 read-only 권한을 우선 검토
- 실제 코드 수정 자동화는 MVP 이후 단계로 보류
- 프로젝트 분석 결과는 단일 문서가 아니라 목적별 산출물로 저장한다
- 분석 산출물은 `summary.md`, `purpose.md`, `structure.md`, `layers.md`, `connectivity.md`, `file-index.json`, `context.json` 으로 나눈다
- 분석 산출물은 문서 맵 연결선과 파일별 참조 관계까지 포함해야 한다
- TS/JS/Kotlin/PHP/Java 파일의 정적 참조는 앱 내부 분석기로 우선 수집한다
- 로컬 참조 분석은 테스트를 feature cluster 근처에 배치할 수 있게 분리하고, 가능하면 `module / controller / command-service / query-service / handler / query / repository` 역할까지 세분화한다
- 로컬 file index는 상위 일부 참조 파일만 뽑는 방식보다, 스캔된 소스 파일 전체를 유지하고 renderer에서 그룹 미리보기로 가시성을 조절하는 방식을 우선한다
- 구조화 응답은 최소한 `context.documentLinks` 를 포함해야 하고, 앱은 로컬 정적 분석 결과의 `fileIndex[].references` 를 바탕으로 저장용 `context.fileReferences` 를 함께 집계한다
- 사람이 읽는 Markdown 문서는 상단 요약과 2~4개 고신호 섹션을 기본으로 하고, 구조/계층/연결성 문서에는 Mermaid 다이어그램을 우선 포함한다
- 문서는 긴 파일 목록을 그대로 덤프하지 말고, 책임/레이어/흐름 단위로 묶은 설명과 대표 예시만 남긴다
- 큰 저장소이거나 자연스럽게 분리되는 저장소라면, 분석 프롬프트에서 subagent 또는 delegated worker 활용을 유도하되 최종 응답은 하나의 통합된 구조화 결과로 수렴시킨다

주의:

- 앱이 `.sdd/`를 프로젝트 내부에 저장하려면 대상 프로젝트 경로에 대한 쓰기 권한은 별도로 필요하다
- 즉, "Codex subprocess read-only"와 "앱의 `.sdd` 저장 가능"은 분리해서 생각한다
- 프로젝트가 읽기 전용이면 임시 분석만 허용하거나 명확한 오류로 종료하는 정책이 필요하다

## `codex exec` 예시

### 분석/명세 초안용

```bash
codex exec \
  --model gpt-5.4 \
  -c model_reasoning_effort="xhigh" \
  --json \
  --output-schema ./schema.json \
  --output-last-message ./last-message.txt \
  -C /path/to/project \
  "Analyze this repository and return a structured project summary for spec generation."
```

### 특징

- `--json`은 진행 이벤트/중간 이벤트 스트림용이다
- `--model` 과 `-c model_reasoning_effort=...` 는 앱 전역 설정 또는 로컬 Codex 설정에서 확인한 현재 실행값을 그대로 전달하는 용도다
- `--output-schema`는 최종 응답 형태를 구조화하는 용도다
- `--output-last-message`는 앱이 읽을 최종 결과 payload를 안정적으로 분리하는 용도다
- 입력 프롬프트는 길어질 수 있으므로 인라인 문자열보다 stdin 전달이 안전하다
- 분석 프롬프트는 plain text 한 덩어리보다 XML 섹션 구조를 권장한다
- Git 저장소가 아니면 `--skip-git-repo-check`를 검토할 수 있다
- 분석 응답은 전체 프로젝트를 요약하는 것보다, 저장 가능한 구조화 산출물에 맞춰 반환하는 편이 좋다
- 긴 분석은 progress/activity 신호를 계속 관찰하고, 정체가 확인될 때만 실패로 전환한다
- 큰 저장소 분석에서는 프롬프트에 subagent 활용 가능성을 명시해, 분리 가능한 하위 작업을 에이전트가 스스로 나누도록 유도한다
- 분석 문서는 Markdown 기준으로 작성하고, 구조나 흐름 설명이 더 명확해질 때는 Mermaid fenced block을 포함하게 한다

앱 계약 권장안:

1. stdout JSONL은 progress/event 용도로만 사용
2. 최종 결과는 `--output-last-message` 파일을 canonical output으로 사용
3. 구조화 응답이 필요하면 `--output-schema`와 앱 측 validation을 함께 사용
4. 프로젝트 분석은 목적별 Markdown 문서와 JSON 인덱스를 함께 생성하도록 schema를 맞춘다
5. 프로젝트 분석 입력은 stdin 으로 전달하고, prompt body 는 `task / scope / constraints / delegation / output_contract` 같은 XML 섹션으로 나눈다

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
