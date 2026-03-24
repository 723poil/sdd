import { useState } from 'react';

import { AgentCliSettingsPage } from '@/renderer/features/agent-cli-settings';
import { ProjectBootstrapPage } from '@/renderer/features/project-bootstrap';
import type { AppView } from '@/renderer/app-view';

export function App() {
  const [activeView, setActiveView] = useState<AppView>('workspace');

  return (
    <div className={`app-shell ${activeView === 'workspace' ? 'app-shell--workspace' : ''}`}>
      <div aria-hidden="true" className="window-drag-region" />

      <div className="app-stage">
        <section
          aria-hidden={activeView !== 'workspace'}
          className={`app-view ${activeView === 'workspace' ? 'app-view--active' : ''}`}
          hidden={activeView !== 'workspace'}
        >
          <ProjectBootstrapPage
            activeAppView={activeView}
            onSelectAppView={setActiveView}
          />
        </section>
        <section
          aria-hidden={activeView !== 'settings'}
          className={`app-view ${activeView === 'settings' ? 'app-view--active' : ''}`}
          hidden={activeView !== 'settings'}
        >
          <AgentCliSettingsPage
            activeAppView={activeView}
            onSelectAppView={setActiveView}
          />
        </section>
      </div>
    </div>
  );
}
