import type { ProjectInspection, RecentProject } from '@/domain/project/project-model';
import type { ProjectSessionSummary } from '@/domain/project/project-session-model';

interface ProjectSidebarProps {
  inspection: ProjectInspection | null;
  selectedPath: string | null;
  projectEntries: RecentProject[];
  selectedSessionId: string | null;
  sessions: ProjectSessionSummary[];
  draggingProjectRootPath: string | null;
  dropTargetRootPath: string | null;
  isCreatingSession: boolean;
  onActivateProject: (rootPath: string) => void;
  onCreateSession: () => void;
  onToggleSidebar: () => void;
  onStartDraggingProject: (rootPath: string) => void;
  onDragOverProject: (rootPath: string) => void;
  onDropProject: (rootPath: string) => void;
  onEndDraggingProject: () => void;
  onSelectSession: (sessionId: string) => void;
}

export function ProjectSidebar(props: ProjectSidebarProps) {
  return (
    <aside className="sidebar sidebar--projects">
      <section className="sidebar-section">
        <div className="sidebar-header">
          <p className="section-label">프로젝트</p>
          <button
            aria-label="왼쪽 프로젝트 패널 닫기"
            className="sidebar-icon-button"
            onClick={props.onToggleSidebar}
            type="button"
          >
            <span aria-hidden="true">‹</span>
          </button>
        </div>
        <div className="project-list">
          {props.projectEntries.map((project) => {
            const isActive = props.selectedPath === project.rootPath;

            return (
              <div
                className="project-stack"
                key={project.rootPath}
              >
                <button
                  aria-label={`${project.projectName} 프로젝트 열기`}
                  className={`project-row project-row--switchable ${
                    props.draggingProjectRootPath === project.rootPath ? 'project-row--dragging' : ''
                  } ${props.dropTargetRootPath === project.rootPath ? 'project-row--drop-target' : ''}`}
                  draggable
                  onClick={() => {
                    props.onActivateProject(project.rootPath);
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
                  <span
                    aria-hidden="true"
                    className={`project-row-indicator ${isActive ? '' : 'project-row-indicator--placeholder'}`}
                  />
                  <span className="project-row-name">{project.projectName}</span>
                </button>

                {isActive ? (
                  <div className="project-subsection">
                    <p className="project-subsection-label">대화 세션</p>
                    {props.inspection?.initializationState === 'ready' ? (
                      <>
                        <button
                          className="project-subsection-button"
                          onClick={props.onCreateSession}
                          disabled={props.isCreatingSession}
                          type="button"
                        >
                          {props.isCreatingSession ? '만드는 중...' : '새 대화'}
                        </button>

                        {props.sessions.length > 0 ? (
                          <div className="project-session-list">
                            {props.sessions.map((session) => (
                              <button
                                className={`project-session-row ${
                                  props.selectedSessionId === session.id ? 'project-session-row--selected' : ''
                                }`}
                                key={session.id}
                                onClick={() => {
                                  props.onSelectSession(session.id);
                                }}
                                title={session.lastMessagePreview ?? session.title}
                                type="button"
                              >
                                <span className="project-session-title">{session.title}</span>
                                <span className="project-session-state">{session.messageCount}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="project-subsection-note">아직 저장된 대화가 없습니다.</p>
                        )}
                      </>
                    ) : (
                      <p className="project-subsection-note">
                        {props.inspection?.isWritable
                          ? '프로젝트 정보를 확인한 뒤 이 영역에서 대화 세션을 사용할 수 있습니다.'
                          : '이 프로젝트 폴더에 쓰기 권한이 있어야 대화 세션을 저장할 수 있습니다.'}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}

          {props.projectEntries.length === 0 ? (
            <p className="sidebar-note">프로젝트를 열면 이 목록에 그대로 추가되고, 순서도 직접 바꿀 수 있습니다.</p>
          ) : null}
        </div>
      </section>
    </aside>
  );
}
