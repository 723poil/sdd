import { useEffect, useState } from 'react';

import {
  replaceProjectSpecTitleHeading,
  type ProjectSpecDocument,
} from '@/domain/project/project-spec-model';

import { MarkdownDocument } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/MarkdownDocument';
import {
  describeSpecStatus,
  formatSpecDateTimeLabel,
  getSpecSummary,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/specs-workspace/specs-workspace.utils';

interface SpecsWorkspaceDocumentViewProps {
  isSavingSpec: boolean;
  onReturnToMap: () => void;
  onSaveSpec: (input: {
    markdown: string;
    revision: number;
    specId: string;
    title: string;
  }) => Promise<boolean>;
  selectedSpec: ProjectSpecDocument;
}

export function SpecsWorkspaceDocumentView(props: SpecsWorkspaceDocumentViewProps) {
  const { isSavingSpec, onReturnToMap, onSaveSpec, selectedSpec } = props;
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(selectedSpec.meta.title);
  const [draftMarkdown, setDraftMarkdown] = useState(selectedSpec.markdown);

  useEffect(() => {
    if (isEditing) {
      return;
    }

    setDraftTitle(selectedSpec.meta.title);
    setDraftMarkdown(selectedSpec.markdown);
  }, [isEditing, selectedSpec.markdown, selectedSpec.meta.title]);

  const handleStartEditing = () => {
    setDraftTitle(selectedSpec.meta.title);
    setDraftMarkdown(selectedSpec.markdown);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setDraftTitle(selectedSpec.meta.title);
    setDraftMarkdown(selectedSpec.markdown);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const didSave = await onSaveSpec({
      markdown: draftMarkdown,
      revision: selectedSpec.meta.revision,
      specId: selectedSpec.meta.id,
      title: draftTitle,
    });
    if (!didSave) {
      return;
    }

    setIsEditing(false);
  };

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
          <div className="analysis-document-page__toolbar-actions">
            {isEditing ? (
              <>
                <button
                  className="secondary-button"
                  disabled={isSavingSpec}
                  onClick={handleCancelEditing}
                  type="button"
                >
                  취소
                </button>
                <button
                  className="primary-button"
                  disabled={isSavingSpec}
                  onClick={() => {
                    void handleSave();
                  }}
                  type="button"
                >
                  {isSavingSpec ? '저장 중' : '저장'}
                </button>
              </>
            ) : (
              <button className="secondary-button" onClick={handleStartEditing} type="button">
                편집
              </button>
            )}
          </div>
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
            {isEditing ? (
              <div className="analysis-document-editor">
                <div className="analysis-document-editor__field">
                  <label className="analysis-document-editor__label" htmlFor="spec-title-input">
                    제목
                  </label>
                  <input
                    className="analysis-document-editor__title-input"
                    id="spec-title-input"
                    onChange={(event) => {
                      const nextTitle = event.target.value;
                      setDraftTitle(nextTitle);
                      setDraftMarkdown((current) =>
                        replaceProjectSpecTitleHeading({
                          markdown: current,
                          title: nextTitle,
                        }),
                      );
                    }}
                    placeholder="명세 제목"
                    value={draftTitle}
                  />
                </div>
                <div className="analysis-document-editor__field">
                  <div className="analysis-document-editor__label-row">
                    <label
                      className="analysis-document-editor__label"
                      htmlFor="spec-markdown-textarea"
                    >
                      내용
                    </label>
                    <span className="analysis-document-editor__hint">저장 시 새 버전으로 남습니다.</span>
                  </div>
                  <textarea
                    className="analysis-document-editor__textarea"
                    id="spec-markdown-textarea"
                    onChange={(event) => {
                      setDraftMarkdown(event.target.value);
                    }}
                    rows={24}
                    spellCheck={false}
                    value={draftMarkdown}
                  />
                </div>
              </div>
            ) : (
              <div className="analysis-document-markdown">
                <MarkdownDocument markdown={selectedSpec.markdown} />
              </div>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}
