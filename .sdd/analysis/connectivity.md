# 연결성과 데이터 흐름

## 핵심 레이어 연결

- infrastructure -> domain: 정적 참조 (정적 참조 35건. 예: src/infrastructure/agent-cli/node-agent-cli-runtime.adapter.ts -> src/domain/app-settings/agent-cli-connection-model.ts, src/infrastructure/analysis/in-memory-project-analysis-run-status.store.ts -> src/domain/project/project-analysis-model.ts, src/infrastructure/analysis/in-memory-project-analysis-run-status.store.ts -> src/domain/project/project-errors.ts)
- application -> domain: 정적 참조 (정적 참조 32건. 예: src/application/app-settings/app-settings.ports.ts -> src/domain/app-settings/agent-cli-connection-model.ts, src/application/app-settings/check-agent-cli-connection.use-case.ts -> src/domain/app-settings/agent-cli-connection-model.ts, src/application/app-settings/list-agent-cli-connections.use-case.ts -> src/domain/app-settings/agent-cli-connection-model.ts)
- infrastructure -> infrastructure: 정적 참조 (정적 참조 29건. 예: src/infrastructure/analysis/node-project-analyzer.adapter.ts -> src/infrastructure/analysis/project-analysis-codex-prompt.ts, src/infrastructure/analysis/node-project-analyzer.adapter.ts -> src/infrastructure/analysis/project-analysis-codex-result.ts, src/infrastructure/analysis/node-project-analyzer.adapter.ts -> src/infrastructure/analysis/project-analysis-local-draft.ts)
- application -> shared: 정적 참조 (정적 참조 23건. 예: src/application/app-settings/app-settings.ports.ts -> src/shared/contracts/result.ts, src/application/app-settings/check-agent-cli-connection.use-case.ts -> src/shared/contracts/result.ts, src/application/app-settings/list-agent-cli-connections.use-case.ts -> src/shared/contracts/result.ts)
- infrastructure -> shared: 정적 참조 (정적 참조 15건. 예: src/infrastructure/agent-cli/node-agent-cli-runtime.adapter.ts -> src/shared/contracts/result.ts, src/infrastructure/analysis/in-memory-project-analysis-run-status.store.ts -> src/shared/contracts/result.ts, src/infrastructure/analysis/node-project-analyzer.adapter.ts -> src/shared/contracts/result.ts)
- renderer -> renderer: 정적 참조 (정적 참조 11건. 예: src/renderer/App.tsx -> src/renderer/features/agent-cli-settings/index.ts, src/renderer/App.tsx -> src/renderer/features/project-bootstrap/index.ts, src/renderer/App.tsx -> src/renderer/app-view.ts)
- application -> application: 정적 참조 (정적 참조 6건. 예: src/application/project/analyze-project.use-case.ts -> src/application/project/ensure-project-storage-ready.ts, src/application/project/analyze-project.use-case.ts -> src/application/project/project-analysis-draft-merger.ts, src/application/project/create-project-session.use-case.ts -> src/application/project/ensure-project-storage-ready.ts)
- shared -> shared: 정적 참조 (정적 참조 5건. 예: src/shared/contracts/result.ts -> src/shared/contracts/app-error.ts, src/shared/ipc/project-ipc.ts -> src/shared/contracts/result.ts, src/shared/ipc/sdd-ipc.ts -> src/shared/ipc/project-ipc.ts)
- shared -> domain: 정적 참조 (정적 참조 5건. 예: src/shared/ipc/project-ipc.ts -> src/domain/project/project-analysis-model.ts, src/shared/ipc/project-ipc.ts -> src/domain/project/project-model.ts, src/shared/ipc/project-ipc.ts -> src/domain/project/project-spec-model.ts)
- main -> shared: 정적 참조 (정적 참조 4건. 예: src/main/create-main-window.ts -> src/shared/app/app-display-name.ts, src/main/ipc/register-project-ipc.ts -> src/shared/ipc/project-ipc.ts, src/main/ipc/register-settings-ipc.ts -> src/shared/ipc/settings-ipc.ts)
- main -> main: 정적 참조 (정적 참조 4건. 예: src/main/main.ts -> src/main/apply-mac-app-icon.ts, src/main/main.ts -> src/main/create-main-window.ts, src/main/main.ts -> src/main/ipc/register-project-ipc.ts)
- renderer -> domain: 정적 참조 (정적 참조 4건. 예: src/renderer/features/agent-cli-settings/AgentCliSettingsPage.tsx -> src/domain/app-settings/agent-cli-connection-model.ts, src/renderer/features/agent-cli-settings/types.ts -> src/domain/app-settings/agent-cli-connection-model.ts, src/renderer/features/agent-cli-settings/use-agent-cli-settings-workflow.ts -> src/domain/app-settings/agent-cli-connection-model.ts)

## 핵심 파일 참조

- scripts/prepare-dev-mac-app.ts -> src/shared/app/app-display-name.ts: imports (정적 import: ../src/shared/app/app-display-name.ts)
- scripts/run-dev.ts -> scripts/prepare-dev-mac-app.ts: imports (정적 import: ./prepare-dev-mac-app.ts)
- src/application/app-settings/app-settings.ports.ts -> src/domain/app-settings/agent-cli-connection-model.ts: imports (정적 import: @/domain/app-settings/agent-cli-connection-model)
- src/application/app-settings/app-settings.ports.ts -> src/shared/contracts/result.ts: imports (정적 import: @/shared/contracts/result)
- src/application/app-settings/check-agent-cli-connection.use-case.ts -> src/domain/app-settings/agent-cli-connection-model.ts: imports (정적 import: @/domain/app-settings/agent-cli-connection-model)
- src/application/app-settings/check-agent-cli-connection.use-case.ts -> src/shared/contracts/result.ts: imports (정적 import: @/shared/contracts/result)
- src/application/app-settings/list-agent-cli-connections.use-case.ts -> src/domain/app-settings/agent-cli-connection-model.ts: imports (정적 import: @/domain/app-settings/agent-cli-connection-model)
- src/application/app-settings/list-agent-cli-connections.use-case.ts -> src/shared/contracts/result.ts: imports (정적 import: @/shared/contracts/result)
- src/application/app-settings/save-agent-cli-connection.use-case.ts -> src/domain/app-settings/agent-cli-connection-model.ts: imports (정적 import: @/domain/app-settings/agent-cli-connection-model)
- src/application/app-settings/save-agent-cli-connection.use-case.ts -> src/shared/contracts/result.ts: imports (정적 import: @/shared/contracts/result)
- src/application/project/activate-project.use-case.ts -> src/domain/project/project-model.ts: imports (정적 import: @/domain/project/project-model)
- src/application/project/activate-project.use-case.ts -> src/shared/contracts/result.ts: imports (정적 import: @/shared/contracts/result)

## 주요 설정 파일

- electron.vite.config.ts
- eslint.config.mjs
- package.json
- tsconfig.json
