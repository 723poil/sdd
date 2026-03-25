import { type CSSProperties, useState } from 'react';

import type { ReferenceTagSummary } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/reference-tags/reference-tag-manager.utils';

export type ReferenceTagCreateResult = 'created' | 'duplicate' | 'failed';
export type ReferenceTagGenerationResult = 'succeeded' | 'failed' | 'cancelled';

interface ReferenceTagManagerProps {
  activeTagIds: string[];
  canManageTags: boolean;
  isCancellingReferenceTags: boolean;
  isGeneratingReferenceTags: boolean;
  isSaving: boolean;
  onCreateTag: (input: { description: string; label: string }) => Promise<ReferenceTagCreateResult>;
  onCancelReferenceTagGeneration: () => void;
  onClearTags: () => void;
  onDeleteTag: (tagId: string) => Promise<void>;
  onGenerateReferenceTags: () => Promise<ReferenceTagGenerationResult>;
  onToggleTagFilter: (tagId: string) => void;
  onToggleTagAssignment: (tagId: string) => Promise<void>;
  selectedPath: string | null;
  selectedPathLabel: string | null;
  taggedFileCount: number;
  tagSummaries: ReferenceTagSummary[];
}

export function ReferenceTagManager(props: ReferenceTagManagerProps) {
  const [draftDescription, setDraftDescription] = useState('');
  const [draftLabel, setDraftLabel] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const isBusy = props.isSaving || props.isGeneratingReferenceTags;
  const hasActiveTagFilters = props.activeTagIds.length > 0;
  const canStartGeneration = props.canManageTags && !isBusy;
  const canCancelGeneration =
    props.isGeneratingReferenceTags && !props.isCancellingReferenceTags;

  const handleCreateTag = async () => {
    if (isBusy) {
      return;
    }

    const normalizedLabel = draftLabel.trim();
    if (normalizedLabel.length === 0) {
      setLocalError('태그 이름을 입력해 주세요.');
      return;
    }

    setLocalError(null);
    const createResult = await props.onCreateTag({
      description: draftDescription,
      label: normalizedLabel,
    });
    if (createResult === 'duplicate') {
      setLocalError('같은 이름의 태그가 이미 있습니다.');
      return;
    }
    if (createResult === 'failed') {
      setLocalError('태그를 저장하지 못했습니다. 아래 알림을 확인해 주세요.');
      return;
    }

    setDraftLabel('');
    setDraftDescription('');
    setIsOpen(true);
  };

  const handleGenerateReferenceTags = async () => {
    if (!props.canManageTags || isBusy) {
      return;
    }

    setLocalError(null);
    setIsOpen(true);
    const generationResult = await props.onGenerateReferenceTags();
    if (generationResult === 'failed') {
      setLocalError('태그를 자동 생성하지 못했습니다. 아래 알림을 확인해 주세요.');
    }
  };

  return (
    <section className="analysis-reference-tags">
      <div className="analysis-reference-tags__header">
        <div className="analysis-reference-tags__copy">
          <span className="analysis-reference-map__eyebrow">태그 그룹</span>
          <h5>파일 태그</h5>
        </div>
        <div className="analysis-reference-tags__header-actions">
          <button
            className="analysis-reference-tags__generate-button"
            disabled={
              props.isCancellingReferenceTags ||
              (!canStartGeneration && !canCancelGeneration)
            }
            onClick={() => {
              if (canCancelGeneration) {
                props.onCancelReferenceTagGeneration();
                return;
              }

              void handleGenerateReferenceTags();
            }}
            type="button"
          >
            {props.isCancellingReferenceTags
              ? '취소 요청 중'
              : props.isGeneratingReferenceTags
                ? '생성 취소'
                : '태그 자동 생성'}
          </button>
          <button
            className="analysis-reference-map__action-button"
            onClick={() => {
              setIsOpen((current) => !current);
            }}
            type="button"
          >
            {isOpen ? '관리 접기' : '태그 관리'}
          </button>
        </div>
      </div>

      <div className="analysis-reference-tags__stats">
        <div className="analysis-reference-tags__stat">
          <span className="analysis-reference-tags__stat-label">태그</span>
          <strong className="analysis-reference-tags__stat-value">
            {props.tagSummaries.length}개
          </strong>
        </div>
        <div className="analysis-reference-tags__stat">
          <span className="analysis-reference-tags__stat-label">태깅 파일</span>
          <strong className="analysis-reference-tags__stat-value">
            {props.taggedFileCount}개
          </strong>
        </div>
      </div>

      <div className="analysis-reference-tags__filters">
        <button
          className={`analysis-reference-tags__filter-chip ${
            !hasActiveTagFilters ? 'analysis-reference-tags__filter-chip--active' : ''
          }`}
          onClick={props.onClearTags}
          type="button"
        >
          전체
        </button>
        {props.tagSummaries.map((summary) => (
          <button
            aria-pressed={props.activeTagIds.includes(summary.tag.id)}
            className={`analysis-reference-tags__filter-chip ${
              props.activeTagIds.includes(summary.tag.id)
                ? 'analysis-reference-tags__filter-chip--active'
                : ''
            }`}
            key={summary.tag.id}
            onClick={() => {
              props.onToggleTagFilter(summary.tag.id);
            }}
            style={
              {
                ['--reference-tag-color' as string]: summary.tag.color,
              } as CSSProperties
            }
            type="button"
          >
            <span>{summary.tag.label}</span>
            <strong>{summary.fileCount}</strong>
          </button>
        ))}
      </div>

      {isOpen ? (
        <div className="analysis-reference-tags__panel">
          {props.selectedPath ? (
            <section className="analysis-reference-tags__card">
              <div className="analysis-reference-tags__card-header">
                <div className="analysis-reference-tags__card-copy">
                  <strong>선택한 파일 태그</strong>
                  <span>{props.selectedPathLabel}</span>
                </div>
                {!props.canManageTags ? (
                  <span className="analysis-reference-tags__readonly">읽기 전용</span>
                ) : null}
              </div>

              {props.tagSummaries.length > 0 ? (
                <ul className="analysis-reference-tags__tag-list">
                  {props.tagSummaries.map((summary) => (
                    <li className="analysis-reference-tags__tag-row" key={summary.tag.id}>
                      <div className="analysis-reference-tags__tag-copy">
                        <span
                          className="analysis-reference-tags__tag-dot"
                          style={
                            {
                              ['--reference-tag-color' as string]: summary.tag.color,
                            } as CSSProperties
                          }
                        />
                        <div>
                          <strong>{summary.tag.label}</strong>
                          {summary.tag.description ? <p>{summary.tag.description}</p> : null}
                        </div>
                      </div>
                      <button
                        className={`analysis-reference-tags__assign-button ${
                          summary.isAssignedToSelectedPath
                            ? 'analysis-reference-tags__assign-button--active'
                            : ''
                        }`}
                        disabled={!props.canManageTags || isBusy}
                        onClick={() => {
                          void props.onToggleTagAssignment(summary.tag.id);
                        }}
                        type="button"
                      >
                        {summary.isAssignedToSelectedPath ? '제거' : '붙이기'}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="analysis-reference-map__empty-copy">
                  먼저 태그를 만든 뒤 선택한 파일에 연결해 주세요.
                </p>
              )}
            </section>
          ) : null}

          <section className="analysis-reference-tags__card">
            <div className="analysis-reference-tags__card-header">
              <div className="analysis-reference-tags__card-copy">
                <strong>태그 목록</strong>
              </div>
            </div>

            {props.tagSummaries.length > 0 ? (
              <ul className="analysis-reference-tags__tag-list">
                {props.tagSummaries.map((summary) => (
                  <li
                    className="analysis-reference-tags__tag-row"
                    key={`${summary.tag.id}-catalog`}
                  >
                    <div className="analysis-reference-tags__tag-copy">
                      <span
                        className="analysis-reference-tags__tag-dot"
                        style={
                          {
                            ['--reference-tag-color' as string]: summary.tag.color,
                          } as CSSProperties
                        }
                      />
                      <div>
                        <strong>{summary.tag.label}</strong>
                        <p>
                          연결 파일 {summary.fileCount}개
                          {summary.tag.description ? ` · ${summary.tag.description}` : ''}
                        </p>
                      </div>
                    </div>
                    {props.canManageTags ? (
                      <button
                        className="analysis-reference-tags__delete-button"
                        disabled={isBusy}
                        onClick={() => {
                          void props.onDeleteTag(summary.tag.id);
                        }}
                        type="button"
                      >
                        삭제
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="analysis-reference-map__empty-copy">
                아직 만든 태그가 없습니다. 관련 파일을 묶을 이름을 먼저 추가해 주세요.
              </p>
            )}
          </section>

          {props.canManageTags ? (
            <section className="analysis-reference-tags__card">
              <div className="analysis-reference-tags__card-header">
                <div className="analysis-reference-tags__card-copy">
                  <strong>새 태그 만들기</strong>
                </div>
              </div>

              <div className="analysis-reference-tags__form">
                <label className="analysis-reference-tags__field">
                  <span>태그 이름</span>
                  <input
                    disabled={isBusy}
                    onChange={(event) => {
                      setLocalError(null);
                      setDraftLabel(event.target.value);
                    }}
                    placeholder="예: 로그인 흐름"
                    type="text"
                    value={draftLabel}
                  />
                </label>

                <label className="analysis-reference-tags__field">
                  <span>설명</span>
                  <textarea
                    disabled={isBusy}
                    onChange={(event) => {
                      setLocalError(null);
                      setDraftDescription(event.target.value);
                    }}
                    placeholder="선택 사항"
                    rows={3}
                    value={draftDescription}
                  />
                </label>

                {localError ? <p className="analysis-reference-tags__error">{localError}</p> : null}

                <div className="analysis-reference-tags__actions">
                  <button
                    className="analysis-reference-tags__submit-button"
                    disabled={isBusy}
                    onClick={() => {
                      void handleCreateTag();
                    }}
                    type="button"
                  >
                    태그 추가
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <p className="analysis-reference-map__empty-copy">
              읽기 전용 프로젝트에서는 태그를 저장하지 않고 조회만 할 수 있습니다.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
