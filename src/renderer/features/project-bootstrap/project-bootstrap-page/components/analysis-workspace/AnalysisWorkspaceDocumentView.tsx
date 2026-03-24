import type { ProjectAnalysisDocument } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';
import { MarkdownDocument } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/MarkdownDocument';
import type { AnalysisFileReferenceCard } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/analysis-workspace.types';
import { getAnalysisDocumentFileName } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/analysis-workspace/analysis-workspace.utils';

interface AnalysisWorkspaceDocumentViewProps {
  fileReferenceCards: AnalysisFileReferenceCard[];
  onReturnToMap: () => void;
  selectedDocument: ProjectAnalysisDocument;
  totalFileReferenceCount: number;
}

export function AnalysisWorkspaceDocumentView(
  props: AnalysisWorkspaceDocumentViewProps,
) {
  const { fileReferenceCards, onReturnToMap, selectedDocument, totalFileReferenceCount } = props;

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
          <section className="analysis-document-page__references">
            <div className="analysis-document-page__references-header">
              <div className="analysis-document-page__references-copy">
                <h5>핵심 파일 참조</h5>
                <p>에이전트가 정리한 중요한 파일 간 참조 관계입니다.</p>
              </div>
              <div className="analysis-document-page__reference-stats">
                <span className="analysis-document-page__reference-stat">
                  파일 {fileReferenceCards.length}개
                </span>
                <span className="analysis-document-page__reference-stat">
                  참조선 {totalFileReferenceCount}개
                </span>
              </div>
            </div>

            {fileReferenceCards.length > 0 ? (
              <div className="analysis-document-page__references-grid">
                {fileReferenceCards.map((entry) => (
                  <article className="analysis-document-page__reference-card" key={entry.path}>
                    <div className="analysis-document-page__reference-card-header">
                      <div>
                        <strong className="analysis-document-page__reference-path">
                          {entry.path}
                        </strong>
                        <p className="analysis-document-page__reference-summary">{entry.summary}</p>
                      </div>
                      <div className="analysis-document-page__reference-metrics">
                        <span className="analysis-document-page__reference-metric">{entry.role}</span>
                        {entry.layer ? (
                          <span className="analysis-document-page__reference-metric">
                            {entry.layer}
                          </span>
                        ) : null}
                        <span className="analysis-document-page__reference-metric">
                          {entry.category}
                        </span>
                        <span className="analysis-document-page__reference-metric">
                          참조됨 {entry.incomingCount}회
                        </span>
                      </div>
                    </div>

                    {entry.references && entry.references.length > 0 ? (
                      <ul className="analysis-document-page__reference-list">
                        {entry.references.map((reference) => (
                          <li key={`${entry.path}-${reference.path}-${reference.relationship}`}>
                            <div className="analysis-document-page__reference-list-row">
                              <span className="analysis-document-page__reference-target">
                                {reference.path}
                              </span>
                              <span className="analysis-document-page__reference-meta">
                                {reference.relationship}
                              </span>
                            </div>
                            <p className="analysis-document-page__reference-reason">
                              {reference.reason}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="analysis-document-page__reference-empty">
                        직접 연결된 핵심 파일 참조가 없습니다.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="analysis-document-page__reference-empty">
                에이전트가 아직 파일 참조 구조를 반환하지 않았습니다.
              </p>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}
