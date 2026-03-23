import { ProjectBootstrapPage } from '@/renderer/features/project-bootstrap';

export function App() {
  return (
    <>
      <div
        aria-hidden="true"
        className="window-drag-region"
      />
      <ProjectBootstrapPage />
    </>
  );
}
