import type { ProjectSpecDocument } from '@/domain/project/project-spec-model';

import { MarkdownDocument } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/MarkdownDocument';
import {
  describeSpecStatus,
  formatSpecDateTimeLabel,
  getSpecSummary,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/specs-workspace/specs-workspace.utils';

interface SpecsWorkspaceDocumentViewProps {
  onReturnToMap: () => void;
  selectedSpec: ProjectSpecDocument;
}

export function SpecsWorkspaceDocumentView(props: SpecsWorkspaceDocumentViewProps) {
  const { onReturnToMap, selectedSpec } = props;

  return (
    <article className="analysis-document-page">
      <div className="analysis-document-page__toolbar">
        <button
          className="secondary-button analysis-document-page__return"
          onClick={onReturnToMap}
          type="button"
        >
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
          <span>맵으로 돌아가기</span>
        </button>
        <div className="analysis-document-page__toolbar-meta">
          <span className="analysis-document-panel__id">{selectedSpec.meta.slug}</span>
          <span className="analysis-document-page__toolbar-hint">Esc</span>
        </div>
      </div>
      <div className="analysis-document-page__header">
        <div>
          <h4>{selectedSpec.meta.title}</h4>
          <div className="specs-map__meta">
            <span className="specs-map__meta-chip">
              {describeSpecStatus(selectedSpec.meta.status)}
            </span>
            <span className="specs-map__meta-chip">{selectedSpec.meta.latestVersion}</span>
            <span className="specs-map__meta-chip">
              수정 {formatSpecDateTimeLabel(selectedSpec.meta.updatedAt)}
            </span>
          </div>
        </div>
      </div>
      <div className="analysis-document-page__body">
        <div className="analysis-document-page__scroll">
          <section className="analysis-document-page__content-card">
            <p className="analysis-document-panel__summary">{getSpecSummary(selectedSpec)}</p>
            <div className="analysis-document-markdown">
              <MarkdownDocument markdown={selectedSpec.markdown} />
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}
