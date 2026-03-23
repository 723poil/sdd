# Architecture

## 상위 계층

이 도구는 크게 세 층으로 본다.

### 1. 프로젝트 이해 계층

- 코드베이스 읽기
- 구조 요약 생성
- 모듈, 엔트리포인트, API, DB, UI, 설정 추출
- 작업 가능한 명세 컨텍스트 생성

### 2. 명세 관리 계층

- 명세서 생성/저장
- 버전 관리
- 채팅 스레드 관리
- 수정안 diff 생성

### 3. 실행 준비 계층

- 확정된 명세 선택
- 프로젝트 컨텍스트 결합
- 관련 파일 후보 계산
- 이후 Codex 작업용 입력 조립

## 구성 요소

DB 없이도 아래 논리 컴포넌트는 필요하다.

- `Project Analyzer`
  - 저장소 스캔
  - 구조 분석
  - 분석 결과 생성
- `Spec Service`
  - 명세서 CRUD
  - 버전 관리
  - 상태 관리
- `Spec Chat Orchestrator`
  - 명세별 채팅 관리
  - 수정안 생성
  - diff 생성
- `Execution Orchestrator`
  - 확정 명세와 프로젝트 문맥을 결합
  - 실행 입력 준비
- `Context Store`
  - 실제 구현은 `.sdd/` 파일 저장 구조로 대체

## 논리 모델

파일 기반 저장이어도 아래 개념은 유지해야 한다.

- `Project`
- `ProjectSnapshot`
- `SpecDocument`
- `SpecVersion`
- `SpecChatThread`
- `SpecChatMessage`
- `SpecPatchProposal`
- `ExecutionRun`

이 모델은 DB 테이블이 아니라, 파일 포맷을 설계할 때 지켜야 하는 개념 단위다.

## UI 기본 구조

- 좌측: 프로젝트/명세 목록
- 중앙: 현재 명세 본문
- 우측 또는 하단: 명세 채팅
- 상단 액션:
  - 새 명세서
  - 재분석
  - diff 보기
  - 명세 반영
  - 작업 준비

중요한 UI 원칙은 세 가지다.

- 현재 기준 명세가 무엇인지 명확해야 한다.
- 채팅 결과가 문서에 어떻게 바뀌는지 보여줘야 한다.
- 어떤 버전을 기준으로 다음 작업을 준비하는지 추적 가능해야 한다.

## 상태 전이

### 명세 상태

- `draft`
- `proposed`
- `approved`
- `superseded`
- `obsolete`

### 실행 상태

- `queued`
- `running`
- `blocked`
- `completed`
- `verified`
- `rejected`

명세 상태와 실행 상태를 분리해야 "문서는 확정됐지만 실행은 아직" 같은 상황을 다룰 수 있다.

## 단일 사용자 승인 규칙

이 도구는 단일 사용자 로컬 앱이므로, `approved`는 팀 승인 개념이 아니라 "개발자 본인이 현재 기준 명세로 확정했다"는 뜻으로 본다.

권장 흐름:

1. 명세 초안 생성 시 `draft`
2. 채팅이나 수동 편집으로 수정안이 생기면 `proposed`
3. 개발자가 diff를 보고 `명세 반영` 또는 `현재 버전으로 확정`을 누르면 `approved`
4. 더 최신 확정본이 생기면 이전 `approved`는 `superseded`

파일 반영 규칙:

- `draft`와 `proposed`는 patch 또는 임시 변경안 중심
- `approved`가 되면 새 버전 파일을 `versions/`에 저장
- 실행 준비는 항상 가장 최신 `approved` 기준

## 기능별 구현 방식

### 프로젝트 분석 기능

1. 저장소 스캐너
   - 파일 트리
   - 확장자 분포
   - 주요 설정 파일 감지
2. 구조 추출기
   - frontend, backend, infra 관점 분석
3. 컨텍스트 생성기
   - markdown 요약
   - json 요약
   - 관련 파일 후보
4. 질의 인터페이스
   - 어떤 모듈이 관련되는지
   - 어떤 부분이 불확실한지

### 명세 채팅 기능

1. 명세서 버전 시스템
2. 명세서별 채팅 스레드
3. patch/diff 생성
4. 반영 및 새 버전 저장

## 명세 문서 구조 권장안

명세 본문은 자유롭게 보이더라도 최소 공통 구조는 유지하는 편이 좋다.

- 제목
- 배경 / 문제
- 목표
- 비목표
- 사용자 시나리오
- 기능 요구사항
- 비기능 요구사항
- 제약 사항
- acceptance criteria
- 영향 범위
- 관련 파일/화면/API
- 오픈 이슈

구조화 메타데이터 예시:

- `spec_type`
- `priority`
- `status`
- `owner`
- `target_modules`
- `related_files`
- `acceptance_checklist`

## 실행 안전장치

초기 버전에서 꼭 필요한 안전장치는 아래다.

- 확정 명세 없이는 다음 작업 준비를 하지 않음
- 관련 파일 후보를 먼저 제시
- 예상 변경 범위를 보여줌
- 작업 후 결과 요약을 남김
- 실패 시 `blocked` 상태와 재질문 포인트를 저장

## snapshot 정의

초기 MVP에서 `snapshot`은 Git commit snapshot이 아니라 "마지막 분석 시점의 로컬 프로젝트 상태를 요약한 분석 기준"으로 정의한다.

즉, 현재 단계에서는 아래처럼 단순화한다.

- 별도 전체 파일 복제본을 만들지 않음
- 분석 시각과 분석 결과를 `.sdd/analysis/` 아래에 저장
- 이후 Git 연동이 들어가면 commit 기준 snapshot으로 확장 가능
