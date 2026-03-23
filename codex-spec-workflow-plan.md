# Codex Spec Workflow Docs

기존 단일 문서는 읽기 쉽게 주제별 문서로 분리했다.

## 문서 목록

- [README](docs/codex-spec-workflow/README.md)
- [01-product-overview](docs/codex-spec-workflow/01-product-overview.md)
- [02-architecture](docs/codex-spec-workflow/02-architecture.md)
- [03-mvp-plan](docs/codex-spec-workflow/03-mvp-plan.md)
- [04-storage-format](docs/codex-spec-workflow/04-storage-format.md)
- [05-risks-and-questions](docs/codex-spec-workflow/05-risks-and-questions.md)
- [06-design-patterns](docs/codex-spec-workflow/06-design-patterns.md)
- [07-engineering-conventions](docs/codex-spec-workflow/07-engineering-conventions.md)
- [08-codex-cli-integration](docs/codex-spec-workflow/08-codex-cli-integration.md)

## 추천 읽는 순서

1. `README`
2. `01-product-overview`
3. `03-mvp-plan`
4. `04-storage-format`
5. `02-architecture`
6. `06-design-patterns`
7. `07-engineering-conventions`
8. `08-codex-cli-integration`
9. `05-risks-and-questions`

## 현재 기준 핵심 결정

- 사용자는 개발자 본인
- 개발자 노트북에서 로컬 프로그램을 직접 실행
- 화면은 웹처럼 보여도 되지만 제품 성격은 로컬 앱
- 별도 백엔드 서버는 사용하지 않음
- DB는 사용하지 않음
- 분석/명세/채팅 데이터는 대상 프로젝트 내부 `.sdd/` 폴더에 저장
