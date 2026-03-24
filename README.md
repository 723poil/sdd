# SDD

SDD는 개발자가 자신의 로컬 프로젝트를 선택하면 프로젝트 구조를 읽고, 프로젝트 내부 `.sdd/` 폴더를 기준으로 분석 결과와 명세 작업 기반을 쌓아가는 Electron 앱입니다.

현재는 MVP의 초기 분석과 프로젝트별 대화 세션 단계까지 구현되어 있습니다. 앱을 실행해서 프로젝트 폴더를 고르고, 읽기/쓰기 가능 여부를 확인한 뒤, 대상 프로젝트 안에 `.sdd/` 저장소를 초기화하고 기본 분석 결과와 대화 세션을 저장할 수 있습니다.

## 현재 구현 범위

- Electron + React + TypeScript 앱 골격
- `main / preload / renderer / application / domain / infrastructure / shared` 계층 분리
- 로컬 프로젝트 폴더 선택
- 최근 프로젝트 목록 유지 및 수동 순서 변경
- 프로젝트 경로 읽기/쓰기 가능 여부 검사
- 대상 프로젝트 내부 `.sdd/` 초기화
- 기본 프로젝트 분석 실행
- 분석 결과 요약 표시
- 프로젝트별 대화 세션 생성/선택
- 세션별 메시지 저장
- 아래 기본 파일 생성
  - `.sdd/project.json`
  - `.sdd/analysis/context.json`
  - `.sdd/analysis/summary.md`
  - `.sdd/sessions/index.json`
  - `.sdd/specs/index.json`

## 실행 환경

- `nvm` 사용
- Node `24` 기준

프로젝트 루트의 [.nvmrc](/Users/723poil/Desktop/projects/sdd/.nvmrc) 로 버전을 맞춥니다.

## 실행 방법

```bash
nvm use
npm install
npm run dev
```

macOS에서는 `npm run dev` 가 메뉴바 이름 표시를 위해 로컬 dev wrapper app(`out/dev-app/SDD.app`)을 준비한 뒤 실행합니다.
기존 기본 실행 경로가 필요하면 `npm run dev:raw` 를 사용합니다.

## macOS 패키징

```bash
npm run dist:mac
```

성공하면 아키텍처별 출력 폴더 아래 `dist/mac-*/SDD.app` 가 생성됩니다.
패키징은 `electron-vite` 번들 기준으로 진행되며, 전체 타입체크는 별도 `npm run build` 로 검증합니다.
아이콘 원본은 `build/icon/sdd-icon.svg` 이고, 파생 자산은 `npm run generate:icons` 로 다시 생성합니다.

## 검증 명령

```bash
npm run typecheck
npm run lint
npm run build
```

## 현재 구조

```text
src/
  main/
  preload/
  renderer/
  application/
  domain/
  infrastructure/
  shared/
```

렌더러는 `window.sdd.project.*` API만 사용하고, 파일 시스템 접근은 `main -> application -> infrastructure` 경계 뒤에서 처리합니다.

## 현재 연결된 기능

- `project/select-directory`
- `project/inspect`
- `project/initialize-storage`
- `project/read-analysis`
- `project/analyze`
- `project/list-recent-projects`
- `project/activate`
- `project/reorder-recent-projects`
- `project/list-sessions`
- `project/create-session`
- `project/read-session-messages`
- `project/send-session-message`

## 다음 구현 예정

1. 프로젝트 개요 화면 정리
2. 세션별 assistant 응답 연결
3. 명세 초안 생성/저장
4. 명세 채팅 / patch / diff
5. `codex exec` 연동

## 참고 문서

- 설계 문서 인덱스: [codex-spec-workflow-plan.md](/Users/723poil/Desktop/projects/sdd/codex-spec-workflow-plan.md)
- 에이전트 안내: [AGENTS.md](/Users/723poil/Desktop/projects/sdd/AGENTS.md)
- 프로젝트 스킬: [/Users/723poil/Desktop/projects/sdd/.codex/skills/](/Users/723poil/Desktop/projects/sdd/.codex/skills/)
