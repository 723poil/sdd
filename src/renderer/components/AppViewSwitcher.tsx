import type { AppView } from '@/renderer/app-view';

interface AppViewSwitcherProps {
  activeView: AppView;
  className?: string;
  onSelectView: (view: AppView) => void;
}

export function AppViewSwitcher(props: AppViewSwitcherProps) {
  return (
    <nav aria-label="화면 전환" className={props.className ?? 'app-switcher'}>
      <button
        className={`app-switcher__tab ${
          props.activeView === 'workspace' ? 'app-switcher__tab--active' : ''
        }`}
        onClick={() => {
          props.onSelectView('workspace');
        }}
        type="button"
      >
        작업 화면
      </button>
      <button
        className={`app-switcher__tab ${
          props.activeView === 'settings' ? 'app-switcher__tab--active' : ''
        }`}
        onClick={() => {
          props.onSelectView('settings');
        }}
        type="button"
      >
        에이전트 설정
      </button>
    </nav>
  );
}
