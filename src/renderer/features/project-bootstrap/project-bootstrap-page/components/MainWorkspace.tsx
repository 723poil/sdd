import { useEffect, useState } from 'react';

import type {
  ProjectAnalysisDocumentId,
  ProjectAnalysisDocumentLayoutMap,
} from '@/domain/project/project-analysis-model';
import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';

import { AnalysisWorkspace } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/AnalysisWorkspace';
import { SpecsWorkspace } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/SpecsWorkspace';
import type {
  SelectedProjectAnalysisDocumentId,
  StructuredProjectAnalysis,
  WorkspacePageId,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

interface MainWorkspaceProps {
  activeWorkspacePage: WorkspacePageId;
  analysis: StructuredProjectAnalysis | null;
  analysisSessionKey: string;
  specs: ProjectSpecDocument[];
  selectedAnalysisDocumentId: SelectedProjectAnalysisDocumentId;
  selectedSpecId: string | null;
  errorMessage: string | null;
  onSelectAnalysisDocument: (documentId: ProjectAnalysisDocumentId) => void;
  onSaveAnalysisDocumentLayouts: (documentLayouts: ProjectAnalysisDocumentLayoutMap) => void;
  onSelectSpec: (specId: string) => void;
  onSelectWorkspacePage: (page: WorkspacePageId) => void;
}

export function MainWorkspace(props: MainWorkspaceProps) {
  const [isAnalysisDocumentViewOpen, setIsAnalysisDocumentViewOpen] = useState(false);

  useEffect(() => {
    if (props.activeWorkspacePage !== 'analysis') {
      setIsAnalysisDocumentViewOpen(false);
    }
  }, [props.activeWorkspacePage]);

  return (
    <section className="main-panel">
      <div className="workspace-page-stage">
        <div
          aria-hidden={props.activeWorkspacePage !== 'analysis'}
          className="workspace-page-view"
          hidden={props.activeWorkspacePage !== 'analysis'}
        >
          <AnalysisWorkspace
            analysis={props.analysis}
            analysisSessionKey={props.analysisSessionKey}
            onViewModeChange={(viewMode) => {
              setIsAnalysisDocumentViewOpen(viewMode === 'document');
            }}
            onSelectDocument={props.onSelectAnalysisDocument}
            onSaveDocumentLayouts={props.onSaveAnalysisDocumentLayouts}
            selectedDocumentId={props.selectedAnalysisDocumentId}
          />
        </div>

        <div
          aria-hidden={props.activeWorkspacePage !== 'specs'}
          className="workspace-page-view"
          hidden={props.activeWorkspacePage !== 'specs'}
        >
          <SpecsWorkspace onSelectSpec={props.onSelectSpec} selectedSpecId={props.selectedSpecId} specs={props.specs} />
        </div>

        {!isAnalysisDocumentViewOpen ? (
          <div className="workspace-page-floating-tabs" role="tablist" aria-label="작업 페이지">
            <button
              aria-selected={props.activeWorkspacePage === 'analysis'}
              className={`workspace-page-tab ${
                props.activeWorkspacePage === 'analysis' ? 'workspace-page-tab--active' : ''
              }`}
              onClick={() => {
                props.onSelectWorkspacePage('analysis');
              }}
              role="tab"
              type="button"
            >
              분석
            </button>
            <button
              aria-selected={props.activeWorkspacePage === 'specs'}
              className={`workspace-page-tab ${
                props.activeWorkspacePage === 'specs' ? 'workspace-page-tab--active' : ''
              }`}
              onClick={() => {
                props.onSelectWorkspacePage('specs');
              }}
              role="tab"
              type="button"
            >
              명세
            </button>
          </div>
        ) : null}
      </div>

      {props.errorMessage ? (
        <section className="panel-card panel-card--alert">
          <header className="card-header">
            <h3>알림</h3>
          </header>
          <p className="helper-text helper-text--alert">{props.errorMessage}</p>
        </section>
      ) : null}
    </section>
  );
}
