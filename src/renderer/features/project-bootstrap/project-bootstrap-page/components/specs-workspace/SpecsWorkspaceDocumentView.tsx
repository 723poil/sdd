import { useEffect, useMemo, useRef, useState } from 'react';

import {
  replaceProjectSpecTitleHeading,
  type ProjectSpecApplyVersionResult,
  type ProjectSpecDeleteVersionResult,
  type ProjectSpecDocument,
  type ProjectSpecMetaUpdateResult,
  type ProjectSpecRelation,
  type ProjectSpecSaveResult,
  type ProjectSpecStatus,
  type ProjectSpecVersionDiff,
  type ProjectSpecVersionHistoryEntry,
} from '@/domain/project/project-spec-model';

import { IconActionButton } from '@/renderer/components/IconActionButton';
import { MarkdownDocument } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/MarkdownDocument';
import { SpecActionIcon } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/specs-workspace/SpecActionIcon';
import { SpecMetadataPanel } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/specs-workspace/SpecMetadataPanel';
import {
  describeSpecStatus,
  describeSpecVersionBadge,
  formatSpecDateTimeLabel,
  getSpecSummary,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/specs-workspace/specs-workspace.utils';

type SpecEditorViewMode = 'preview' | 'split' | 'write';
type SpecSidePanelSection = 'relations' | 'versions';
type SpecVersionPanelView = 'diff' | 'history';
type CopyStatus = 'error' | 'idle' | 'success';

const SPEC_EDITOR_VIEW_MODE_OPTIONS: ReadonlyArray<{
  icon: 'preview' | 'split' | 'write';
  label: string;
  mode: SpecEditorViewMode;
}> = [
  { icon: 'write', label: '작성 보기', mode: 'write' },
  { icon: 'preview', label: '미리보기', mode: 'preview' },
  { icon: 'split', label: '분할 보기', mode: 'split' },
];

const SPEC_VERSION_PANEL_OPTIONS: ReadonlyArray<{
  icon: 'diff' | 'list';
  label: string;
  view: SpecVersionPanelView;
}> = [
  { icon: 'list', label: '저장 이력', view: 'history' },
  { icon: 'diff', label: '비교 보기', view: 'diff' },
];

interface SpecsWorkspaceDocumentViewProps {
  canWriteSpecs: boolean;
  hasConflict: boolean;
  isSavingSpec: boolean;
  isUpdatingSpecMeta: boolean;
  onApplySpecVersion: (input: {
    revision: number;
    specId: string;
    versionId: string;
  }) => Promise<ProjectSpecApplyVersionResult | null>;
  onDeleteSpecVersion: (input: {
    revision: number;
    specId: string;
    versionId: string;
  }) => Promise<ProjectSpecDeleteVersionResult | null>;
  onReadSpecVersionDiff: (input: {
    currentMarkdown?: string | null;
    currentTitle?: string | null;
    specId: string;
    versionId: string;
  }) => Promise<ProjectSpecVersionDiff | null>;
  onReadSpecVersionHistory: (input: {
    specId: string;
  }) => Promise<ProjectSpecVersionHistoryEntry[] | null>;
  onReturnToMap: () => void;
  onSaveSpec: (input: {
    markdown: string;
    revision: number;
    specId: string;
    title: string;
  }) => Promise<ProjectSpecSaveResult | null>;
  onSelectSpec: (specId: string) => void;
  onUpdateSpecMeta: (input: {
    specId: string;
    revision: number;
    status: ProjectSpecStatus;
    relations: ProjectSpecRelation[];
  }) => Promise<ProjectSpecMetaUpdateResult | null>;
  selectedSpec: ProjectSpecDocument;
  specs: ProjectSpecDocument[];
}

export function SpecsWorkspaceDocumentView(props: SpecsWorkspaceDocumentViewProps) {
  const {
    canWriteSpecs,
    hasConflict,
    isSavingSpec,
    isUpdatingSpecMeta,
    onApplySpecVersion,
    onDeleteSpecVersion,
    onReadSpecVersionDiff,
    onReadSpecVersionHistory,
    onReturnToMap,
    onSaveSpec,
    onSelectSpec,
    onUpdateSpecMeta,
    selectedSpec,
    specs,
  } = props;
  const [isEditing, setIsEditing] = useState(false);
  const [editorViewMode, setEditorViewMode] = useState<SpecEditorViewMode>('write');
  const [draftTitle, setDraftTitle] = useState(selectedSpec.meta.title);
  const [draftMarkdown, setDraftMarkdown] = useState(selectedSpec.markdown);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [sidePanelSection, setSidePanelSection] = useState<SpecSidePanelSection>('versions');
  const [versionPanelView, setVersionPanelView] = useState<SpecVersionPanelView>('history');
  const [versionHistory, setVersionHistory] = useState<ProjectSpecVersionHistoryEntry[] | null>(
    null,
  );
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selectedVersionDiff, setSelectedVersionDiff] = useState<ProjectSpecVersionDiff | null>(
    null,
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [isApplyingVersion, setIsApplyingVersion] = useState(false);
  const [isDeletingVersion, setIsDeletingVersion] = useState(false);
  const [panelErrorMessage, setPanelErrorMessage] = useState<string | null>(null);
  const previousSpecIdRef = useRef(selectedSpec.meta.id);

  useEffect(() => {
    if (isEditing) {
      return;
    }

    setDraftTitle(selectedSpec.meta.title);
    setDraftMarkdown(selectedSpec.markdown);
  }, [isEditing, selectedSpec.markdown, selectedSpec.meta.title]);

  useEffect(() => {
    if (previousSpecIdRef.current === selectedSpec.meta.id) {
      return;
    }

    previousSpecIdRef.current = selectedSpec.meta.id;
    setIsSidePanelOpen(false);
    setSidePanelSection('versions');
    setVersionPanelView('history');
    setVersionHistory(null);
    setSelectedVersionId(null);
    setSelectedVersionDiff(null);
    setPanelErrorMessage(null);
    setCopyStatus('idle');
    setEditorViewMode('write');
    setIsEditing(false);
    setDraftTitle(selectedSpec.meta.title);
    setDraftMarkdown(selectedSpec.markdown);
  }, [selectedSpec]);

  useEffect(() => {
    if (copyStatus === 'idle') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyStatus('idle');
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyStatus]);

  const isDirty = draftTitle !== selectedSpec.meta.title || draftMarkdown !== selectedSpec.markdown;
  const currentVersionLabel = describeSpecVersionBadge(selectedSpec);
  const latestVersionLabel =
    selectedSpec.meta.latestVersion &&
    selectedSpec.meta.currentVersion &&
    selectedSpec.meta.latestVersion !== selectedSpec.meta.currentVersion
      ? `최신 ${selectedSpec.meta.latestVersion}`
      : null;
  const relationCount = selectedSpec.meta.relations.length;
  const versionCount = versionHistory?.length ?? 0;
  const compareSummaryLabel = selectedVersionDiff
    ? `+${selectedVersionDiff.summary.addedLineCount} / -${selectedVersionDiff.summary.removedLineCount}`
    : null;
  const relationCountLabel = `연결 ${relationCount}`;
  const isRelationPanelOpen = isSidePanelOpen && sidePanelSection === 'relations';
  const isVersionPanelOpen = isSidePanelOpen && sidePanelSection === 'versions';
  const copyStatusMessage =
    copyStatus === 'success'
      ? '본문을 클립보드에 복사했습니다.'
      : copyStatus === 'error'
        ? '본문 복사에 실패했습니다.'
        : null;
  const previewMarkdown = useMemo(
    () =>
      replaceProjectSpecTitleHeading({
        markdown: draftMarkdown,
        title: draftTitle,
      }),
    [draftMarkdown, draftTitle],
  );

  const handleStartEditing = () => {
    if (!canWriteSpecs) {
      return;
    }

    setDraftTitle(selectedSpec.meta.title);
    setDraftMarkdown(selectedSpec.markdown);
    setEditorViewMode('write');
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setDraftTitle(selectedSpec.meta.title);
    setDraftMarkdown(selectedSpec.markdown);
    setPanelErrorMessage(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const saveResult = await onSaveSpec({
      markdown: draftMarkdown,
      revision: selectedSpec.meta.revision,
      specId: selectedSpec.meta.id,
      title: draftTitle,
    });
    if (!saveResult) {
      return;
    }

    if (saveResult.kind === 'conflict') {
      setPanelErrorMessage('최신 저장본과 충돌했습니다. 아래 충돌 상태를 확인해 주세요.');
      return;
    }

    setPanelErrorMessage(saveResult.kind === 'no-op' ? '변경 없음으로 처리했습니다.' : null);
    setIsEditing(false);
  };

  const handleToggleArchived = async () => {
    if (!canWriteSpecs) {
      return;
    }

    setPanelErrorMessage(null);
    const nextStatus = selectedSpec.meta.status === 'archived' ? 'draft' : 'archived';
    const updateResult = await onUpdateSpecMeta({
      specId: selectedSpec.meta.id,
      revision: selectedSpec.meta.revision,
      status: nextStatus,
      relations: selectedSpec.meta.relations,
    });

    if (!updateResult) {
      setPanelErrorMessage('명세 상태를 저장하지 못했습니다.');
      return;
    }

    if (updateResult.kind === 'conflict') {
      setPanelErrorMessage('명세 상태 변경 중 충돌이 발생했습니다. 최신 명세를 다시 확인해 주세요.');
    }
  };

  const handleToggleRelationsPanel = () => {
    setPanelErrorMessage(null);
    if (isRelationPanelOpen) {
      setIsSidePanelOpen(false);
      return;
    }

    setIsSidePanelOpen(true);
    setSidePanelSection('relations');
  };

  const handleToggleVersionPanel = async () => {
    setPanelErrorMessage(null);
    if (isVersionPanelOpen) {
      setIsSidePanelOpen(false);
      return;
    }

    setIsSidePanelOpen(true);
    setSidePanelSection('versions');
    setVersionPanelView('history');

    if (versionHistory !== null) {
      return;
    }

    setIsLoadingHistory(true);
    const historyResult = await onReadSpecVersionHistory({
      specId: selectedSpec.meta.id,
    });
    setIsLoadingHistory(false);

    if (!historyResult) {
      setPanelErrorMessage('버전 기록을 불러오지 못했습니다.');
      return;
    }

    setVersionHistory(historyResult);
  };

  const handleCompareVersion = async (versionId: string) => {
    setSelectedVersionId(versionId);
    setPanelErrorMessage(null);
    setIsLoadingDiff(true);

    const diffResult = await onReadSpecVersionDiff({
      currentMarkdown: isEditing ? previewMarkdown : null,
      currentTitle: isEditing ? draftTitle : null,
      specId: selectedSpec.meta.id,
      versionId,
    });

    setIsLoadingDiff(false);
    if (!diffResult) {
      setPanelErrorMessage('버전 비교를 불러오지 못했습니다.');
      return;
    }

    setSelectedVersionDiff(diffResult);
    setVersionPanelView('diff');
  };

  const handleApplyVersion = async (versionId: string) => {
    if (!canWriteSpecs) {
      return;
    }

    if (isEditing && isDirty) {
      const shouldContinue = window.confirm(
        '현재 편집 중인 초안을 버리고 선택한 버전을 적용할까요?',
      );
      if (!shouldContinue) {
        return;
      }
    }

    setIsApplyingVersion(true);
    setPanelErrorMessage(null);

    const applyResult = await onApplySpecVersion({
      revision: selectedSpec.meta.revision,
      specId: selectedSpec.meta.id,
      versionId,
    });

    setIsApplyingVersion(false);
    if (!applyResult) {
      setPanelErrorMessage('선택한 버전을 적용하지 못했습니다.');
      return;
    }

    setDraftTitle(applyResult.spec.meta.title);
    setDraftMarkdown(applyResult.spec.markdown);

    if (applyResult.kind === 'conflict') {
      setPanelErrorMessage('적용 중 충돌이 발생했습니다. 최신 초안을 다시 확인해 주세요.');
      return;
    }

    setIsEditing(false);
    await reloadVersionHistoryAndDiff(versionId);
  };

  const handleDeleteVersion = async (entry: ProjectSpecVersionHistoryEntry) => {
    if (!canWriteSpecs || !entry.canDelete) {
      return;
    }

    const shouldDelete = window.confirm(
      `${entry.versionId} 버전을 삭제할까요?\n현재 기준 버전과 최신 저장 버전은 삭제되지 않습니다.`,
    );
    if (!shouldDelete) {
      return;
    }

    setIsDeletingVersion(true);
    setPanelErrorMessage(null);

    const deleteResult = await onDeleteSpecVersion({
      revision: selectedSpec.meta.revision,
      specId: selectedSpec.meta.id,
      versionId: entry.versionId,
    });

    setIsDeletingVersion(false);
    if (!deleteResult) {
      setPanelErrorMessage('버전을 삭제하지 못했습니다.');
      return;
    }

    if (deleteResult.kind === 'conflict') {
      setPanelErrorMessage('버전 삭제 중 충돌이 발생했습니다. 최신 초안을 다시 확인해 주세요.');
      return;
    }

    setVersionHistory(deleteResult.history);
    if (selectedVersionId === entry.versionId) {
      setSelectedVersionId(null);
      setSelectedVersionDiff(null);
      setVersionPanelView('history');
    }
  };

  const reloadVersionHistoryAndDiff = async (versionId: string | null) => {
    const historyResult = await onReadSpecVersionHistory({
      specId: selectedSpec.meta.id,
    });
    if (historyResult) {
      setVersionHistory(historyResult);
    }

    if (!versionId) {
      setSelectedVersionDiff(null);
      return;
    }

    const diffResult = await onReadSpecVersionDiff({
      specId: selectedSpec.meta.id,
      versionId,
    });
    if (diffResult) {
      setSelectedVersionDiff(diffResult);
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(isEditing ? draftMarkdown : selectedSpec.markdown);
      setCopyStatus('success');
    } catch {
      setCopyStatus('error');
    }
  };

  return (
    <article className="analysis-document-page">
      <div className="analysis-document-page__toolbar">
        <IconActionButton
          className="analysis-document-page__return-button"
          icon={<SpecActionIcon name="back" />}
          label="맵으로 돌아가기"
          onClick={onReturnToMap}
          tooltipSide="bottom"
        />
        <div className="analysis-document-page__toolbar-meta">
          <span className="analysis-document-panel__id">{selectedSpec.meta.slug}</span>
          <span className="analysis-document-page__toolbar-hint">Esc</span>
          <div className="analysis-document-page__toolbar-actions">
            <div className="analysis-document-page__toolbar-action-group">
              <IconActionButton
                icon={<SpecActionIcon name="copy" />}
                label="본문 복사"
                onClick={handleCopyMarkdown}
                tooltipSide="bottom"
              />
              <IconActionButton
                aria-pressed={isVersionPanelOpen}
                icon={<SpecActionIcon name="history" />}
                isActive={isVersionPanelOpen}
                label={isVersionPanelOpen ? '버전 기록 닫기' : '저장된 버전 보기'}
                onClick={() => void handleToggleVersionPanel()}
                tooltipSide="bottom"
              />
              <IconActionButton
                icon={<SpecActionIcon name="relations" />}
                isActive={isRelationPanelOpen}
                label={isRelationPanelOpen ? '연결 명세 패널 닫기' : '연결 명세 관리'}
                onClick={handleToggleRelationsPanel}
                tooltipSide="bottom"
              />
              <IconActionButton
                disabled={!canWriteSpecs || isUpdatingSpecMeta}
                icon={
                  <SpecActionIcon
                    name={selectedSpec.meta.status === 'archived' ? 'restore' : 'archive'}
                  />
                }
                isActive={selectedSpec.meta.status === 'archived'}
                label={
                  selectedSpec.meta.status === 'archived'
                    ? '보관된 명세를 다시 초안 상태로 전환'
                    : '현재 명세를 보관 상태로 전환'
                }
                onClick={() => {
                  void handleToggleArchived();
                }}
                tooltipSide="bottom"
              />
            </div>
            {isEditing ? (
              <>
                <div className="spec-editor-mode-toggle" role="tablist" aria-label="편집 보기 모드">
                  {SPEC_EDITOR_VIEW_MODE_OPTIONS.map((option) => (
                    <IconActionButton
                      aria-selected={editorViewMode === option.mode}
                      icon={<SpecActionIcon name={option.icon} />}
                      isActive={editorViewMode === option.mode}
                      key={option.mode}
                      label={option.label}
                      onClick={() => {
                        setEditorViewMode(option.mode);
                      }}
                      role="tab"
                      size="small"
                      tooltipSide="bottom"
                    />
                  ))}
                </div>
                <div className="analysis-document-page__toolbar-action-group">
                  <IconActionButton
                    disabled={isSavingSpec}
                    icon={<SpecActionIcon name="cancel" />}
                    label="편집 취소"
                    onClick={handleCancelEditing}
                    tooltipSide="bottom"
                  />
                  <IconActionButton
                    disabled={isSavingSpec}
                    icon={<SpecActionIcon name="save" />}
                    label={
                      isSavingSpec
                        ? '저장 중'
                        : '실질 변경이 있을 때만 새 버전을 저장합니다.'
                    }
                    onClick={() => {
                      void handleSave();
                    }}
                    tone="primary"
                    tooltipSide="bottom"
                  />
                </div>
              </>
            ) : (
              <div className="analysis-document-page__toolbar-action-group">
                <IconActionButton
                  disabled={!canWriteSpecs}
                  icon={<SpecActionIcon name="edit" />}
                  label={canWriteSpecs ? '명세 편집 시작' : '읽기 전용 명세는 편집할 수 없습니다.'}
                  onClick={handleStartEditing}
                  tooltipSide="bottom"
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="analysis-document-page__header">
        <div>
          <h4>{selectedSpec.meta.title}</h4>
          <div className="specs-map__meta">
            <span
              className={`specs-map__meta-chip ${
                selectedSpec.meta.status === 'archived' ? 'specs-map__meta-chip--archived' : ''
              }`}
            >
              {describeSpecStatus(selectedSpec.meta.status)}
            </span>
            <span className="specs-map__meta-chip">{currentVersionLabel}</span>
            {latestVersionLabel ? (
              <span className="specs-map__meta-chip">{latestVersionLabel}</span>
            ) : null}
            {hasConflict ? (
              <span className="specs-map__meta-chip specs-map__meta-chip--alert">충돌</span>
            ) : null}
            {relationCount > 0 ? <span className="specs-map__meta-chip">{relationCountLabel}</span> : null}
            <span className="specs-map__meta-chip">
              수정 {formatSpecDateTimeLabel(selectedSpec.meta.updatedAt)}
            </span>
          </div>
        </div>
        <div className="spec-document-inline-status">
          {copyStatusMessage ? <span>{copyStatusMessage}</span> : null}
        </div>
      </div>
      <div
        className={`analysis-document-page__body ${
          isSidePanelOpen ? 'analysis-document-page__body--with-aside' : ''
        }`}
      >
        <div className="analysis-document-page__scroll">
          <section className="analysis-document-page__content-card">
            <p className="analysis-document-panel__summary">{getSpecSummary(selectedSpec)}</p>
            {panelErrorMessage ? (
              <p className="analysis-document-panel__summary analysis-document-panel__summary--alert">
                {panelErrorMessage}
              </p>
            ) : null}
            {isEditing ? (
              <div
                className={`analysis-document-editor analysis-document-editor--${editorViewMode}`}
              >
                <div className="analysis-document-editor__field analysis-document-editor__field--full">
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
                {editorViewMode !== 'preview' ? (
                  <div className="analysis-document-editor__field">
                    <label
                      className="analysis-document-editor__label"
                      htmlFor="spec-markdown-textarea"
                    >
                      내용
                    </label>
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
                ) : null}
                {editorViewMode !== 'write' ? (
                  <div className="analysis-document-editor__field">
                    <div className="analysis-document-editor__label-row">
                      <span className="analysis-document-editor__label">미리보기</span>
                    </div>
                    <div className="analysis-document-markdown">
                      <MarkdownDocument markdown={previewMarkdown} />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="analysis-document-markdown">
                <MarkdownDocument markdown={selectedSpec.markdown} />
              </div>
            )}
          </section>
        </div>
        {isSidePanelOpen ? (
          <aside
            className={`spec-version-panel ${
              sidePanelSection === 'relations' ? 'spec-version-panel--relations' : ''
            }`}
          >
            {sidePanelSection === 'relations' ? (
              <>
                <div className="spec-version-panel__header">
                  <div>
                    <span className="analysis-empty-panel__eyebrow">메타데이터</span>
                    <h5>연결 명세</h5>
                  </div>
                  <span className="spec-version-panel__count">{`${relationCount}개`}</span>
                </div>
                <div className="spec-version-panel__content">
                  <SpecMetadataPanel
                    canWriteSpecs={canWriteSpecs}
                    isUpdatingSpecMeta={isUpdatingSpecMeta}
                    onSelectSpec={onSelectSpec}
                    onUpdateSpecMeta={onUpdateSpecMeta}
                    selectedSpec={selectedSpec}
                    showHeader={false}
                    specs={specs}
                    variant="aside"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="spec-version-panel__header">
                  <div>
                    <span className="analysis-empty-panel__eyebrow">버전 기록</span>
                    <h5>{versionPanelView === 'history' ? '저장 이력' : '비교 보기'}</h5>
                  </div>
                  <span className="spec-version-panel__count">
                    {versionPanelView === 'history'
                      ? `${versionCount}개`
                      : (compareSummaryLabel ?? '대상 선택')}
                  </span>
                </div>
                <div className="spec-version-panel__tabs" role="tablist" aria-label="버전 패널 보기">
                  {SPEC_VERSION_PANEL_OPTIONS.map((option) => (
                    <IconActionButton
                      aria-selected={versionPanelView === option.view}
                      disabled={option.view === 'diff' && !selectedVersionDiff && !isLoadingDiff}
                      icon={<SpecActionIcon name={option.icon} />}
                      isActive={versionPanelView === option.view}
                      key={option.view}
                      label={option.label}
                      onClick={() => {
                        setVersionPanelView(option.view);
                      }}
                      role="tab"
                      size="small"
                    />
                  ))}
                </div>
                {versionPanelView === 'history' ? (
                  isLoadingHistory ? (
                    <p className="spec-version-panel__hint">불러오는 중</p>
                  ) : versionCount === 0 ? (
                    <p className="spec-version-panel__hint">저장 버전 없음</p>
                  ) : (
                    <div className="spec-version-panel__list">
                      {versionHistory?.map((entry) => (
                        <section
                          className={`spec-version-card ${
                            selectedVersionId === entry.versionId ? 'spec-version-card--selected' : ''
                          }`}
                          key={entry.versionId}
                        >
                          <div className="spec-version-card__header">
                            <strong>{entry.versionId}</strong>
                            <div className="specs-map__meta">
                              {entry.isCurrent ? (
                                <span className="specs-map__meta-chip">현재 기준</span>
                              ) : null}
                              {entry.isLatest ? (
                                <span className="specs-map__meta-chip">최신 저장</span>
                              ) : null}
                            </div>
                          </div>
                          <p className="spec-version-card__summary">{entry.summary ?? '요약 없음'}</p>
                          <span className="spec-version-card__timestamp">
                            {formatSpecDateTimeLabel(entry.createdAt)}
                          </span>
                          <div className="spec-version-card__actions">
                            <IconActionButton
                              disabled={isLoadingDiff}
                              icon={<SpecActionIcon name="compare" />}
                              isActive={selectedVersionId === entry.versionId}
                              label="현재 초안과 비교 보기"
                              onClick={() => {
                                void handleCompareVersion(entry.versionId);
                              }}
                              size="small"
                            />
                            <IconActionButton
                              disabled={!canWriteSpecs || !entry.canApply || isApplyingVersion}
                              icon={<SpecActionIcon name="apply" />}
                              label="선택한 버전을 현재 초안으로 가져오기"
                              onClick={() => {
                                void handleApplyVersion(entry.versionId);
                              }}
                              size="small"
                            />
                            <IconActionButton
                              disabled={!canWriteSpecs || !entry.canDelete || isDeletingVersion}
                              icon={<SpecActionIcon name="delete" />}
                              label="현재 기준/최신 저장 버전은 삭제되지 않습니다."
                              onClick={() => {
                                void handleDeleteVersion(entry);
                              }}
                              size="small"
                              tone="danger"
                            />
                          </div>
                        </section>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="spec-version-panel__diff">
                    <div className="spec-version-panel__diff-header">
                      <h5>현재 초안 비교</h5>
                      <IconActionButton
                        icon={<SpecActionIcon name="list" />}
                        label="다른 버전 선택"
                        onClick={() => {
                          setVersionPanelView('history');
                        }}
                        size="small"
                      />
                    </div>
                    {isLoadingDiff ? (
                      <p className="spec-version-panel__hint">불러오는 중</p>
                    ) : selectedVersionDiff ? (
                      <>
                        <div className="spec-version-panel__diff-meta">
                          <span className="specs-map__meta-chip">
                            현재 {selectedVersionDiff.current.versionId ?? '작업 초안'}
                          </span>
                          <span className="specs-map__meta-chip">
                            비교 {selectedVersionDiff.version.versionId}
                          </span>
                        </div>
                        <div className="spec-version-diff">
                          {selectedVersionDiff.lines.map((line, index) => (
                            <div
                              className={`spec-version-diff__line spec-version-diff__line--${line.type}`}
                              key={`${index}-${line.type}`}
                            >
                              <span className="spec-version-diff__line-number">
                                {line.versionLineNumber ?? ''}
                              </span>
                              <span className="spec-version-diff__line-number">
                                {line.currentLineNumber ?? ''}
                              </span>
                              <code>{line.value || ' '}</code>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="spec-version-panel__hint">
                        저장 이력에서 비교할 버전을 고르면 이 화면에서 diff를 따로 볼 수 있습니다.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </aside>
        ) : null}
      </div>
    </article>
  );
}
