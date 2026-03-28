# AGENTS

이 저장소는 `sdd` 로컬 앱의 설계 문서와 프로젝트 전용 스킬을 함께 관리한다.

## 우선 읽을 문서

- 전체 인덱스: `/Users/723poil/git/side/sdd/codex-spec-workflow-plan.md`
- 문서 개요: `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/README.md`
- 제품/범위: `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/01-product-overview.md`
- 아키텍처: `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/02-architecture.md`
- MVP 계획: `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/03-mvp-plan.md`
- 저장 포맷: `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/04-storage-format.md`
- 리스크/오픈질문: `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/05-risks-and-questions.md`
- 설계 패턴: `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/06-design-patterns.md`
- 엔지니어링 컨벤션: `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/07-engineering-conventions.md`
- Codex CLI 연동: `/Users/723poil/git/side/sdd/docs/codex-spec-workflow/08-codex-cli-integration.md`

## 프로젝트 전용 스킬

스킬 위치:

- `/Users/723poil/git/side/sdd/.codex/skills/sdd-product-mvp/SKILL.md`
- `/Users/723poil/git/side/sdd/.codex/skills/sdd-implementation-guardrails/SKILL.md`
- `/Users/723poil/git/side/sdd/.codex/skills/sdd-engineering-conventions/SKILL.md`
- `/Users/723poil/git/side/sdd/.codex/skills/sdd-storage-contracts/SKILL.md`
- `/Users/723poil/git/side/sdd/.codex/skills/sdd-codex-cli/SKILL.md`
- `/Users/723poil/git/side/sdd/.codex/skills/sdd-commit-workflow/SKILL.md`
- `/Users/723poil/git/side/sdd/.codex/skills/sdd-ui-disclosure/SKILL.md`
- `/Users/723poil/git/side/sdd/.codex/skills/sdd-agent-xml-prompt/SKILL.md`

각 스킬 용도:

- `sdd-product-mvp`
  - 제품 방향, 화면 흐름, MVP 범위를 다룰 때 사용
- `sdd-implementation-guardrails`
  - 실제 구현, 리팩터링, 코드 구조 설계 시 사용
- `sdd-engineering-conventions`
  - 코드 스타일, 파일 분리, 메서드 설계, 에러 처리, 테스트 우선순위를 확인할 때 사용
- `sdd-storage-contracts`
  - `.sdd` 포맷, 명세 버전, patch, chat log, source of truth를 건드릴 때 사용
- `sdd-codex-cli`
  - Codex CLI 실행, subprocess 연결, auth, exec/app-server 판단 시 사용
- `sdd-commit-workflow`
  - 커밋 범위 점검, staged/unstaged 확인, 문서 동기화 확인, Conventional Commit 메시지 작성 시 사용
- `sdd-ui-disclosure`
  - renderer UI 설명 문구 밀도, 툴팁/보조 도움말 노출, 빈 상태/보조 카피 설계 시 사용
- `sdd-agent-xml-prompt`
  - Codex exec/에이전트 요청 프롬프트를 XML 계약으로 작성하거나 수정할 때 사용
  - 서브에이전트 활용 지시와 `분석 -> 실행 -> 검증` 기본 루틴을 프롬프트에 넣을 때 사용

## 고정된 프로젝트 규칙

- 제품은 개발자 개인용 로컬 앱 전제다.
- 별도 백엔드 서버는 사용하지 않는다.
- 사용자 UI에는 내부 로드맵, 향후 확장 계획, 구현 디테일을 기본 설명으로 노출하지 않는다.
- 사용자 UI 설명 문구는 기본 노출을 최소화하고, 반복되거나 선택형인 설명은 툴팁이나 다른 on-demand 도움말로 지연 노출한다.
- 데이터 저장은 대상 프로젝트 내부 `.sdd/` 폴더가 기본이다.
- spec 단위 source of truth는 `specs/<spec-slug>/meta.json`이다.
- `specs/index.json`은 재생성 가능한 인덱스/캐시다.
- `chat.jsonl`은 단순 메시지 배열이 아니라 append-only event log다.
- 주요 JSON 파일은 `schemaVersion`을 가져야 한다.
- 변경 가능한 JSON은 `revision` 또는 `updatedAt` 기준 충돌 검사를 고려한다.
- CLI 에이전트 MVP 연결은 각 에이전트의 `exec` 계열 단발 실행 경로를 우선한다.
- `app-server`는 현재 experimental이므로 고도화 옵션으로만 본다.
- 분석 실행은 activity 기반으로 추적하고, 단순 고정 wall timeout보다 inactivity/hang 검출을 우선한다.
- 큰 저장소나 자연스럽게 분리되는 작업은 subagent/delegation 활용을 유도하되, 결과는 하나의 통합된 산출물로 정리한다.
- 사용자에게 노출되는 채팅은 그냥 `채팅`으로 표현하고, 자유형 프로젝트 세션 UI로 보이지 않게 한다.
- 채팅 화면은 중앙 하단보다 오른쪽 패널에 배치하는 구성을 우선한다.
- 내부 저장은 프로젝트 세션/채팅 로그 구조를 재사용할 수 있지만, 제품 의미는 항상 명세 컨텍스트에 연결된 대화여야 한다.
- 중앙 작업 영역은 docs 페이지처럼 `분석 / 명세` 두 페이지 구조를 우선한다.
- 분석 문서는 Markdown 기준으로 저장/렌더링하고, 필요하면 Mermaid fenced block을 포함할 수 있다.
- 분석 페이지는 문서 맵 연결선과 파일별 참조 관계를 중앙 패널에서 함께 보여준다.
- 선택된 CLI 에이전트의 모델은 앱 전역 설정과 오른쪽 채팅에서 직접 확인/조정 가능해야 하며, 추론 강도는 지원하는 에이전트에서만 노출하고 실행 인자에도 그대로 반영한다.

## 작업 시 기본 행동

1. 관련 문서를 먼저 확인한다.
2. 해당 영역에 맞는 프로젝트 스킬을 읽는다.
3. 문서 계약과 컨벤션을 어기지 않는 방향으로 수정한다.
4. 저장 포맷이나 규칙을 바꾸면 관련 문서를 함께 갱신한다.

## 현재 구현 상태

- 실제 앱 소스는 `/Users/723poil/git/side/sdd/src/` 아래에 있다.
- 계층은 `main / preload / renderer / application / domain / infrastructure / shared` 로 유지한다.
- renderer feature는 `page 조립 + feature hook + components + constants/types/utils` 구조를 우선한다.
- 현재 완료된 첫 수직 슬라이스는 아래다.
  - 로컬 프로젝트 폴더 선택
  - 읽기/쓰기 가능 여부 검사
  - 대상 프로젝트 내부 `.sdd/` 초기화
  - `project.json`, `analysis/context.json`, `analysis/summary.md`, `analysis/file-index.json`, `specs/index.json` 기본 생성
  - `전체 분석`과 `참조 분석` 실행 경로 분리
  - 로컬 정적 분석 기반 기본 프로젝트 분석 실행
  - TS/JS/Kotlin/PHP/Java 파일의 정적 참조 관계 추출
  - 읽기 전용 프로젝트에서도 참조 분석은 저장 없이 화면에 임시 표시 가능
  - 필요 시 선택된 CLI 에이전트 exec 기반 문서 서술 보강
  - 분석 결과를 `.sdd/analysis/*` 와 `project.json.lastAnalyzedAt` 에 반영
  - 분석 결과의 문서 맵 연결선과 파일별 참조 관계를 함께 저장
  - 최근 프로젝트 목록 유지 및 수동 드래그 정렬
  - 앱 전역 CLI 에이전트 연결 설정 저장
  - `Codex CLI`, `Claude Code`, `Gemini CLI` 연결 확인
  - 에이전트별 모델 / 지원되는 경우 추론 강도 확인 및 저장
  - 새 명세 채팅 시작
  - 명세 문맥 기반 채팅 저장
  - 현재 채팅 에이전트 / 모델 / 지원되는 경우 추론 강도를 실제 명세 채팅 실행 인자에 반영
  - 명세 문맥 + 세션 이력 기반 선택된 CLI 에이전트 exec assistant 응답 생성
  - 명세 단위 세션 연결
  - 내부 채팅 로그를 `.sdd/sessions/*` 에 재사용 가능하게 저장
- 현재 UI 구조는 아래 기준을 따른다.
  - 앱 전역 workspace/settings 전환을 둘 수 있다
  - 왼쪽 패널: 현재 프로젝트 + 최근 프로젝트
  - 중앙 패널: `분석 / 명세` 페이지 전환과 Markdown 본문
  - 분석 페이지는 문서 맵 연결선과 파일별 참조 관계를 함께 보여준다
  - 오른쪽 패널: 채팅
  - 좌우 패널은 토글 가능
  - 최근 프로젝트는 선택만으로 재정렬하지 않으며, 사용자 드래그 정렬을 우선한다
- 아직 연결하지 않은 다음 단계는 아래다.
  - 명세 초안 생성
  - 채팅 / patch / diff

## 문서 동기화 주의

아래 변경은 반드시 연관 문서를 함께 본다.

- `.sdd` 포맷 변경
  - `04-storage-format.md`
  - `06-design-patterns.md`
  - `07-engineering-conventions.md`
- CLI 에이전트 연결 방식 변경
  - `08-codex-cli-integration.md`
  - `03-mvp-plan.md`
- 아키텍처/레이어 경계 변경
  - `02-architecture.md`
  - `06-design-patterns.md`
  - `07-engineering-conventions.md`
- UI 설명 문구/툴팁/보조 도움말 규칙 변경
  - `06-design-patterns.md`
  - `07-engineering-conventions.md`
  - `.codex/skills/sdd-ui-disclosure/SKILL.md`
