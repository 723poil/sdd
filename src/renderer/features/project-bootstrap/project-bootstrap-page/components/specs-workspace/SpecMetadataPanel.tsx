import { useEffect, useMemo, useState } from 'react';

import type {
  ProjectSpecDocument,
  ProjectSpecMetaUpdateResult,
  ProjectSpecRelation,
  ProjectSpecRelationType,
} from '@/domain/project/project-spec-model';
import { IconActionButton } from '@/renderer/components/IconActionButton';
import { SpecActionIcon } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/specs-workspace/SpecActionIcon';
import {
  describeSpecRelationType,
  describeSpecStatus,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/specs-workspace/specs-workspace.utils';

interface SpecMetadataPanelProps {
  canWriteSpecs: boolean;
  isUpdatingSpecMeta: boolean;
  onSelectSpec: (specId: string) => void;
  onUpdateSpecMeta: (input: {
    specId: string;
    revision: number;
    status: ProjectSpecDocument['meta']['status'];
    relations: ProjectSpecRelation[];
  }) => Promise<ProjectSpecMetaUpdateResult | null>;
  selectedSpec: ProjectSpecDocument;
  showHeader?: boolean;
  specs: ProjectSpecDocument[];
  variant?: 'aside' | 'card';
}

type MetadataFeedbackTone = 'alert' | 'default';

export function SpecMetadataPanel(props: SpecMetadataPanelProps) {
  const {
    canWriteSpecs,
    isUpdatingSpecMeta,
    onSelectSpec,
    onUpdateSpecMeta,
    selectedSpec,
    showHeader = true,
    specs,
    variant = 'card',
  } = props;
  const [draftRelationType, setDraftRelationType] =
    useState<ProjectSpecRelationType>('derived-from');
  const [draftTargetSpecId, setDraftTargetSpecId] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<MetadataFeedbackTone>('default');
  const specById = useMemo(
    () => new Map(specs.map((spec) => [spec.meta.id, spec] as const)),
    [specs],
  );
  const relationTargetOptions = useMemo(
    () => specs.filter((spec) => spec.meta.id !== selectedSpec.meta.id),
    [selectedSpec.meta.id, specs],
  );
  const relationKeySet = useMemo(
    () =>
      new Set(
        selectedSpec.meta.relations.map((relation) => `${relation.targetSpecId}::${relation.type}`),
      ),
    [selectedSpec.meta.relations],
  );
  const hasMatchingRelation = draftTargetSpecId
    ? relationKeySet.has(`${draftTargetSpecId}::${draftRelationType}`)
    : false;
  const relationCountLabel = `${selectedSpec.meta.relations.length}개`;

  useEffect(() => {
    setDraftTargetSpecId('');
    setDraftRelationType('derived-from');
    setFeedbackMessage(null);
    setFeedbackTone('default');
  }, [selectedSpec.meta.id]);

  useEffect(() => {
    if (!feedbackMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedbackMessage(null);
      setFeedbackTone('default');
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [feedbackMessage]);

  const updateFeedback = (message: string, tone: MetadataFeedbackTone) => {
    setFeedbackMessage(message);
    setFeedbackTone(tone);
  };

  const handleAddRelation = async () => {
    if (!draftTargetSpecId || hasMatchingRelation) {
      return;
    }

    const result = await onUpdateSpecMeta({
      specId: selectedSpec.meta.id,
      revision: selectedSpec.meta.revision,
      status: selectedSpec.meta.status,
      relations: [
        ...selectedSpec.meta.relations,
        {
          targetSpecId: draftTargetSpecId,
          type: draftRelationType,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    if (!result) {
      updateFeedback('연결 명세를 저장하지 못했습니다.', 'alert');
      return;
    }

    if (result.kind === 'conflict') {
      updateFeedback('다른 변경이 먼저 저장되어 다시 불러온 뒤 정리해야 합니다.', 'alert');
      return;
    }

    if (result.kind === 'no-op') {
      updateFeedback('이미 같은 연결이 있습니다.', 'default');
      return;
    }

    setDraftTargetSpecId('');
    updateFeedback('연결 명세를 저장했습니다.', 'default');
  };

  const handleRemoveRelation = async (relation: ProjectSpecRelation) => {
    const result = await onUpdateSpecMeta({
      specId: selectedSpec.meta.id,
      revision: selectedSpec.meta.revision,
      status: selectedSpec.meta.status,
      relations: selectedSpec.meta.relations.filter(
        (candidate) =>
          !(
            candidate.targetSpecId === relation.targetSpecId &&
            candidate.type === relation.type &&
            candidate.createdAt === relation.createdAt
          ),
      ),
    });

    if (!result) {
      updateFeedback('연결 명세를 정리하지 못했습니다.', 'alert');
      return;
    }

    if (result.kind === 'conflict') {
      updateFeedback('다른 변경이 먼저 저장되어 다시 불러온 뒤 정리해야 합니다.', 'alert');
      return;
    }

    updateFeedback('연결 명세를 정리했습니다.', 'default');
  };

  return (
    <section
      className={`spec-metadata-panel ${
        variant === 'aside' ? 'spec-metadata-panel--aside' : ''
      }`}
    >
      {showHeader ? (
        <div className="spec-metadata-panel__header">
          <div className="spec-metadata-panel__title">
            <span className="analysis-empty-panel__eyebrow">메타데이터</span>
            <div className="spec-metadata-panel__title-row">
              <h5>연결 명세</h5>
              <span className="analysis-document-panel__id">{relationCountLabel}</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="spec-metadata-panel__editor">
        <select
          aria-label="관계 타입"
          className="spec-metadata-panel__select"
          disabled={!canWriteSpecs || isUpdatingSpecMeta || relationTargetOptions.length === 0}
          onChange={(event) => {
            setDraftRelationType(event.target.value as ProjectSpecRelationType);
          }}
          value={draftRelationType}
        >
          <option value="derived-from">파생</option>
          <option value="follow-up-to">후속 개발</option>
        </select>
        <select
          aria-label="대상 명세"
          className="spec-metadata-panel__select"
          disabled={!canWriteSpecs || isUpdatingSpecMeta || relationTargetOptions.length === 0}
          onChange={(event) => {
            setDraftTargetSpecId(event.target.value);
          }}
          value={draftTargetSpecId}
        >
          <option value="">
            {relationTargetOptions.length === 0 ? '연결할 명세 없음' : '대상 명세 선택'}
          </option>
          {relationTargetOptions.map((spec) => (
            <option key={spec.meta.id} value={spec.meta.id}>
              {spec.meta.title}
              {spec.meta.status === 'archived' ? ' · 보관' : ''}
            </option>
          ))}
        </select>
        <IconActionButton
          className="spec-metadata-panel__editor-action"
          disabled={
            !canWriteSpecs ||
            isUpdatingSpecMeta ||
            !draftTargetSpecId ||
            relationTargetOptions.length === 0 ||
            hasMatchingRelation
          }
          icon={<SpecActionIcon name="add" />}
          label={
            relationTargetOptions.length === 0
              ? '연결할 다른 명세가 없습니다.'
              : hasMatchingRelation
                ? '이미 같은 연결이 있습니다.'
                : '현재 명세에 연결 추가'
          }
          onClick={() => {
            void handleAddRelation();
          }}
        />
      </div>

      {feedbackMessage ? (
        <p
          className={`analysis-document-panel__summary ${
            feedbackTone === 'alert' ? 'analysis-document-panel__summary--alert' : ''
          }`}
        >
          {feedbackMessage}
        </p>
      ) : null}

      {selectedSpec.meta.relations.length === 0 ? (
        <p className="analysis-document-panel__summary">연결된 명세가 없습니다.</p>
      ) : (
        <div className="spec-metadata-panel__list">
          {selectedSpec.meta.relations.map((relation) => {
            const targetSpec = specById.get(relation.targetSpecId) ?? null;

            return (
              <article
                className="spec-metadata-relation-card"
                key={relation.createdAt + relation.targetSpecId + relation.type}
              >
                <div className="spec-metadata-relation-card__summary">
                  <div className="specs-map__meta">
                    <span className="specs-map__meta-chip">
                      {describeSpecRelationType(relation.type)}
                    </span>
                    {targetSpec ? (
                      <span className="specs-map__meta-chip">
                        {describeSpecStatus(targetSpec.meta.status)}
                      </span>
                    ) : (
                      <span className="specs-map__meta-chip specs-map__meta-chip--alert">
                        누락됨
                      </span>
                    )}
                  </div>
                  <strong>
                    {targetSpec?.meta.title ?? `누락된 명세 (${relation.targetSpecId})`}
                  </strong>
                  <span className="analysis-document-panel__id">
                    {targetSpec?.meta.slug ?? relation.targetSpecId}
                  </span>
                </div>
                <div className="spec-metadata-relation-card__actions">
                  <IconActionButton
                    disabled={!targetSpec}
                    icon={<SpecActionIcon name="open" />}
                    label={
                      targetSpec ? `${targetSpec.meta.title} 명세로 이동` : '누락된 명세는 열 수 없습니다.'
                    }
                    onClick={() => {
                      if (!targetSpec) {
                        return;
                      }

                      onSelectSpec(targetSpec.meta.id);
                    }}
                    size="small"
                  />
                  <IconActionButton
                    disabled={!canWriteSpecs || isUpdatingSpecMeta}
                    icon={<SpecActionIcon name="delete" />}
                    label="현재 연결 제거"
                    onClick={() => {
                      void handleRemoveRelation(relation);
                    }}
                    size="small"
                    tone="danger"
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
