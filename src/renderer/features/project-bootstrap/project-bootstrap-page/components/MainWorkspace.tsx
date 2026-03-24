import { useEffect, useState } from 'react';

import type {
  ProjectAnalysisDocumentId,
  ProjectAnalysisDocumentLayoutMap,
} from '@/domain/project/project-analysis-model';
import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';

import { AnalysisReferenceMap } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/AnalysisReferenceMap';
import { AnalysisWorkspace } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/AnalysisWorkspace';
import { SpecsWorkspace } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/SpecsWorkspace';
import type { AnalysisWorkspaceViewMode } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/analysis-workspace.types';
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
  const [analysisViewMode, setAnalysisViewMode] = useState<AnalysisWorkspaceViewMode>('map');

  useEffect(() => {
    if (props.activeWorkspacePage !== 'analysis') {
      setAnalysisViewMode('map');
    }
  }, [props.activeWorkspacePage]);

  useEffect(() => {
    setAnalysisViewMode('map');
  }, [props.analysisSessionKey]);

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
            isActive={props.activeWorkspacePage === 'analysis'}
            onViewModeChange={setAnalysisViewMode}
            onSelectDocument={props.onSelectAnalysisDocument}
            onSaveDocumentLayouts={props.onSaveAnalysisDocumentLayouts}
            selectedDocumentId={props.selectedAnalysisDocumentId}
            viewMode={analysisViewMode}
          />
        </div>

        <div
          aria-hidden={props.activeWorkspacePage !== 'specs'}
          className="workspace-page-view"
          hidden={props.activeWorkspacePage !== 'specs'}
        >
          <SpecsWorkspace
            isActive={props.activeWorkspacePage === 'specs'}
            onSelectSpec={props.onSelectSpec}
            selectedSpecId={props.selectedSpecId}
            specs={props.specs}
          />
        </div>

        <div
          aria-hidden={props.activeWorkspacePage !== 'references'}
          className="workspace-page-view"
          hidden={props.activeWorkspacePage !== 'references'}
        >
          {props.analysis ? (
            <AnalysisReferenceMap
              analysis={props.analysis}
              isActive={props.activeWorkspacePage === 'references'}
            />
          ) : (
            <section className="analysis-empty-panel">
              <div className="analysis-empty-panel__card">
                <span className="analysis-empty-panel__eyebrow">참조 준비</span>
                <h3 className="analysis-empty-panel__title">참조 맵이 아직 없습니다.</h3>
                <p className="analysis-empty-panel__description">
                  분석을 먼저 실행하면 파일 간 참조 구조를 여기서 볼 수 있습니다.
                </p>
              </div>
            </section>
          )}
        </div>

        {analysisViewMode !== 'document' ? (
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
            <button
              aria-selected={props.activeWorkspacePage === 'references'}
              className={`workspace-page-tab ${
                props.activeWorkspacePage === 'references' ? 'workspace-page-tab--active' : ''
              }`}
              onClick={() => {
                props.onSelectWorkspacePage('references');
              }}
              role="tab"
              type="button"
            >
              참조
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
