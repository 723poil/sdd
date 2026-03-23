# Codex Spec Workflow

이 문서 묶음은 "로컬 프로젝트를 읽고 명세를 정리하고, 명세 채팅을 통해 작업 준비까지 이어지는 개발자용 로컬 도구"의 구조를 정리한 것이다.

## 문서 구조

- [01-product-overview](01-product-overview.md)
  - 제품 목적
  - 사용자 시나리오
  - 가능 여부와 핵심 흐름
- [02-architecture](02-architecture.md)
  - 아키텍처 계층
  - 논리 모델
  - 상태 전이
  - 실행 안전장치
- [03-mvp-plan](03-mvp-plan.md)
  - MVP 범위
  - 화면 흐름
  - 1차 기능 목록
  - 구현 순서
- [04-storage-format](04-storage-format.md)
  - `.sdd/` 저장 구조
  - 파일 포맷 초안
  - 프로젝트 내부 데이터 관리 방식
- [05-risks-and-questions](05-risks-and-questions.md)
  - 리스크
  - 아키텍처 결정 포인트
  - 문답식 보완 질문
- [06-design-patterns](06-design-patterns.md)
  - 유지보수용 설계 패턴
  - 레이어 경계
  - 모듈 분리 규칙
  - 테스트 전략
- [07-engineering-conventions](07-engineering-conventions.md)
  - 코드 컨벤션
  - 포맷/린트 기준
  - 파일 분리 원칙
  - 함수/메서드 생성 원칙
- [08-codex-cli-integration](08-codex-cli-integration.md)
  - Codex CLI 연결 방식
  - exec / app-server / mcp-server 비교
  - 인증 방식
  - Electron 연결 포인트

## 현재까지 확정된 전제

- 사용자는 개발자 본인이다.
- 사용 환경은 개발자 자신의 노트북이다.
- 개발자가 프로그램을 직접 실행한다.
- 화면은 앱 창이 기본이고, 웹처럼 보이는 UI여도 괜찮다.
- 대상은 로컬 경로의 프로젝트다.
- 앱이 프로젝트를 직접 읽고 분석한다.
- 분석 결과와 명세서는 프로젝트 내부 `.sdd/` 폴더에 저장한다.
- 별도 백엔드 서버는 두지 않는다.
- DB도 두지 않는다.

## 한 줄 요약

가장 맞는 방향은 `Electron + React` 기반의 로컬 앱으로 시작하고, 프로젝트 내부 `.sdd/`에 분석 결과와 명세 데이터를 저장하는 방식이다.
