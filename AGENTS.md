# AGENTS

이 저장소는 `sdd` 로컬 앱의 설계 문서와 프로젝트 전용 스킬을 함께 관리한다.

## 우선 읽을 문서

- 전체 인덱스: `/Users/723poil/Desktop/projects/sdd/codex-spec-workflow-plan.md`
- 문서 개요: `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/README.md`
- 제품/범위: `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/01-product-overview.md`
- 아키텍처: `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/02-architecture.md`
- MVP 계획: `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/03-mvp-plan.md`
- 저장 포맷: `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/04-storage-format.md`
- 리스크/오픈질문: `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/05-risks-and-questions.md`
- 설계 패턴: `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/06-design-patterns.md`
- 엔지니어링 컨벤션: `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/07-engineering-conventions.md`
- Codex CLI 연동: `/Users/723poil/Desktop/projects/sdd/docs/codex-spec-workflow/08-codex-cli-integration.md`

## 프로젝트 전용 스킬

스킬 위치:

- `/Users/723poil/Desktop/projects/sdd/.codex/skills/sdd-product-mvp/SKILL.md`
- `/Users/723poil/Desktop/projects/sdd/.codex/skills/sdd-implementation-guardrails/SKILL.md`
- `/Users/723poil/Desktop/projects/sdd/.codex/skills/sdd-engineering-conventions/SKILL.md`
- `/Users/723poil/Desktop/projects/sdd/.codex/skills/sdd-storage-contracts/SKILL.md`
- `/Users/723poil/Desktop/projects/sdd/.codex/skills/sdd-codex-cli/SKILL.md`

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

## 고정된 프로젝트 규칙

- 제품은 개발자 개인용 로컬 앱 전제다.
- 별도 백엔드 서버는 사용하지 않는다.
- 데이터 저장은 대상 프로젝트 내부 `.sdd/` 폴더가 기본이다.
- spec 단위 source of truth는 `specs/<spec-slug>/meta.json`이다.
- `specs/index.json`은 재생성 가능한 인덱스/캐시다.
- `chat.jsonl`은 단순 메시지 배열이 아니라 append-only event log다.
- 주요 JSON 파일은 `schemaVersion`을 가져야 한다.
- 변경 가능한 JSON은 `revision` 또는 `updatedAt` 기준 충돌 검사를 고려한다.
- Codex CLI MVP 연결은 `codex exec` 우선이다.
- `app-server`는 현재 experimental이므로 고도화 옵션으로만 본다.

## 작업 시 기본 행동

1. 관련 문서를 먼저 확인한다.
2. 해당 영역에 맞는 프로젝트 스킬을 읽는다.
3. 문서 계약과 컨벤션을 어기지 않는 방향으로 수정한다.
4. 저장 포맷이나 규칙을 바꾸면 관련 문서를 함께 갱신한다.

## 현재 구현 상태

- 실제 앱 소스는 `/Users/723poil/Desktop/projects/sdd/src/` 아래에 있다.
- 계층은 `main / preload / renderer / application / domain / infrastructure / shared` 로 유지한다.
- renderer feature는 `page 조립 + feature hook + components + constants/types/utils` 구조를 우선한다.
- 현재 완료된 첫 수직 슬라이스는 아래다.
  - 로컬 프로젝트 폴더 선택
  - 읽기/쓰기 가능 여부 검사
  - 대상 프로젝트 내부 `.sdd/` 초기화
  - `project.json`, `analysis/context.json`, `analysis/summary.md`, `specs/index.json` 기본 생성
  - 기본 프로젝트 분석 실행
  - 분석 결과를 `.sdd/analysis/*` 와 `project.json.lastAnalyzedAt` 에 반영
  - 최근 프로젝트 목록 유지 및 수동 드래그 정렬
  - 프로젝트별 대화 세션 생성/선택/메시지 저장
  - 세션 데이터를 `.sdd/sessions/*` 에 저장
- 현재 UI 구조는 아래 기준을 따른다.
  - 왼쪽 패널: 현재 프로젝트 + 프로젝트 내부 세션 + 최근 프로젝트
  - 중앙 패널: 현재 작업, 핵심 액션, 분석 결과, 세션 대화 영역
  - 오른쪽 패널: 분석 요약 지표와 세션 개수
  - 좌우 패널은 토글 가능
  - 최근 프로젝트는 선택만으로 재정렬하지 않으며, 사용자 드래그 정렬을 우선한다
- 아직 연결하지 않은 다음 단계는 아래다.
  - 명세 초안 생성
  - 명세 채팅 / patch / diff
  - 세션별 assistant 응답 연결
  - `codex exec` 연동

## 문서 동기화 주의

아래 변경은 반드시 연관 문서를 함께 본다.

- `.sdd` 포맷 변경
  - `04-storage-format.md`
  - `06-design-patterns.md`
  - `07-engineering-conventions.md`
- Codex 연결 방식 변경
  - `08-codex-cli-integration.md`
  - `03-mvp-plan.md`
- 아키텍처/레이어 경계 변경
  - `02-architecture.md`
  - `06-design-patterns.md`
  - `07-engineering-conventions.md`
