import { useState } from 'react';

import { AgentCliSettingsPage } from '@/renderer/features/agent-cli-settings';
import { ProjectBootstrapPage } from '@/renderer/features/project-bootstrap';

type AppView = 'workspace' | 'settings';

export function App() {
  const [activeView, setActiveView] = useState<AppView>('workspace');

  return (
    <div className="app-shell">
      <div
        aria-hidden="true"
        className="window-drag-region"
      />
      <nav
        aria-label="화면 전환"
        className="app-switcher"
      >
        <button
          className={`app-switcher__tab ${activeView === 'workspace' ? 'app-switcher__tab--active' : ''}`}
          onClick={() => {
            setActiveView('workspace');
          }}
          type="button"
        >
          작업 화면
        </button>
        <button
          className={`app-switcher__tab ${activeView === 'settings' ? 'app-switcher__tab--active' : ''}`}
          onClick={() => {
            setActiveView('settings');
          }}
          type="button"
        >
          Codex 연결
        </button>
      </nav>

      <div className="app-stage">
        <section
          aria-hidden={activeView !== 'workspace'}
          className={`app-view ${activeView === 'workspace' ? 'app-view--active' : ''}`}
          hidden={activeView !== 'workspace'}
        >
          <ProjectBootstrapPage />
        </section>
        <section
          aria-hidden={activeView !== 'settings'}
          className={`app-view ${activeView === 'settings' ? 'app-view--active' : ''}`}
          hidden={activeView !== 'settings'}
        >
          <AgentCliSettingsPage />
        </section>
      </div>
    </div>
  );
}
