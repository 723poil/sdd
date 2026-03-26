import { IconActionButton } from '@/renderer/components/IconActionButton';
import type { ProjectAnalysisDocument } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';
import { MarkdownDocument } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/MarkdownDocument';
import { getAnalysisDocumentFileName } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/analysis-workspace.utils';

interface AnalysisWorkspaceDocumentViewProps {
  onReturnToMap: () => void;
  selectedDocument: ProjectAnalysisDocument;
}

export function AnalysisWorkspaceDocumentView(props: AnalysisWorkspaceDocumentViewProps) {
  const { onReturnToMap, selectedDocument } = props;

  return (
    <article className="analysis-document-page">
      <div className="analysis-document-page__toolbar">
        <IconActionButton
          className="analysis-document-page__return-button"
          icon={
            <svg aria-hidden="true" viewBox="0 0 20 20">
              <path
                d="M11.5 4.5 6 10l5.5 5.5M7 10h7"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          }
          label="맵으로 돌아가기"
          onClick={onReturnToMap}
          tooltipSide="bottom"
        />
        <div className="analysis-document-page__toolbar-meta">
          <span className="analysis-document-panel__id">
            {getAnalysisDocumentFileName(selectedDocument.id)}
          </span>
          <span className="analysis-document-page__toolbar-hint">Esc</span>
        </div>
      </div>
      <div className="analysis-document-page__header">
        <div>
          <h4>{selectedDocument.title}</h4>
        </div>
      </div>
      <div className="analysis-document-page__body">
        <div className="analysis-document-page__scroll">
          <section className="analysis-document-page__content-card">
            <p className="analysis-document-panel__summary">{selectedDocument.summary}</p>
            <div className="analysis-document-markdown">
              <MarkdownDocument markdown={selectedDocument.markdown} />
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}
