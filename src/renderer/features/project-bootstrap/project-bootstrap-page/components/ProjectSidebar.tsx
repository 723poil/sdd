import type { RecentProject } from '@/domain/project/project-model';

interface ProjectSidebarProps {
  selectedPath: string | null;
  projectEntries: RecentProject[];
  draggingProjectRootPath: string | null;
  dropTargetRootPath: string | null;
  isSelecting: boolean;
  onActivateProject: (rootPath: string) => void;
  onSelectProject: () => void;
  onToggleSidebar: () => void;
  onStartDraggingProject: (rootPath: string) => void;
  onDragOverProject: (rootPath: string) => void;
  onDropProject: (rootPath: string) => void;
  onEndDraggingProject: () => void;
}

export function ProjectSidebar(props: ProjectSidebarProps) {
  return (
    <aside className="sidebar sidebar--projects project-sidebar">
      <section className="sidebar-section project-sidebar__section">
        <div className="sidebar-header">
          <p className="section-label">프로젝트</p>
          <div className="sidebar-header__actions">
            <button
              aria-label="프로젝트 추가"
              className="sidebar-icon-button sidebar-icon-button--ghost"
              disabled={props.isSelecting}
              onClick={props.onSelectProject}
              title="프로젝트 추가"
              type="button"
            >
              <span aria-hidden="true">{props.isSelecting ? '…' : '+'}</span>
            </button>
            <button
              aria-label="왼쪽 프로젝트 패널 닫기"
              className="sidebar-icon-button"
              onClick={props.onToggleSidebar}
              type="button"
            >
              <span aria-hidden="true">‹</span>
            </button>
          </div>
        </div>
        <div className="project-list">
          {props.projectEntries.map((project) => {
            const isActive = props.selectedPath === project.rootPath;

            return (
              <div className="project-stack" key={project.rootPath}>
                <div
                  className={`project-row-shell ${isActive ? 'project-row-shell--selected' : ''} ${
                    props.draggingProjectRootPath === project.rootPath
                      ? 'project-row-shell--dragging'
                      : ''
                  } ${props.dropTargetRootPath === project.rootPath ? 'project-row-shell--drop-target' : ''}`}
                >
                  <button
                    aria-label={`${project.projectName} 프로젝트 열기`}
                    className="project-row"
                    draggable
                    onClick={() => {
                      void props.onActivateProject(project.rootPath);
                    }}
                    onDragEnd={props.onEndDraggingProject}
                    onDragOver={(event) => {
                      event.preventDefault();
                      props.onDragOverProject(project.rootPath);
                    }}
                    onDragStart={() => {
                      props.onStartDraggingProject(project.rootPath);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      props.onDropProject(project.rootPath);
                    }}
                    title={project.rootPath}
                    type="button"
                  >
                    <span aria-hidden="true" className="project-row-icon">
                      <svg viewBox="0 0 20 20">
                        <path
                          d="M3.5 5.5h4l1.4 1.7H16a1.5 1.5 0 0 1 1.5 1.5v5.8A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 4 5.5Z"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.35"
                        />
                      </svg>
                    </span>
                    <span className="project-row-copy">
                      <span className="project-row-name">{project.projectName}</span>
                    </span>
                  </button>
                </div>
              </div>
            );
          })}

          {props.projectEntries.length === 0 ? (
            <p className="sidebar-note">최근 프로젝트 없음</p>
          ) : null}
        </div>
      </section>
    </aside>
  );
}
