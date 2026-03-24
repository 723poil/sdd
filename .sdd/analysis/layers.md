# 계층과 책임

- application: 애플리케이션 유스케이스 관련 코드 24개, 의존: domain, shared
- domain: 도메인 규칙 관련 코드 6개, 의존: shared
- electron.vite.config.ts: electron.vite.config.ts 경로 아래 주요 코드 1개
- eslint.config.mjs: eslint.config.mjs 경로 아래 주요 코드 1개
- infrastructure: 인프라 연동 관련 코드 24개, 의존: domain, shared
- main: 메인 프로세스 관련 코드 5개, 의존: shared
- package.json: package.json 경로 아래 주요 코드 1개
- preload: preload bridge 관련 코드 1개, 의존: shared
- renderer: renderer UI 관련 코드 13개, 의존: domain, shared
- scripts: scripts 경로 아래 주요 코드 2개, 의존: shared
- shared: 공용 계약 및 유틸리티 6개, 의존: domain
- tsconfig.json: tsconfig.json 경로 아래 주요 코드 1개
