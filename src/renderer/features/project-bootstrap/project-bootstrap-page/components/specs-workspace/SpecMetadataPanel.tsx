import { useEffect, useMemo, useState } from 'react';

import type {
  ProjectSpecDocument,
  ProjectSpecMetaUpdateResult,
  ProjectSpecRelation,
  ProjectSpecRelationType,
} from '@/domain/project/project-spec-model';
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
  specs: ProjectSpecDocument[];
}

type MetadataFeedbackTone = 'alert' | 'default';

export function SpecMetadataPanel(props: SpecMetadataPanelProps) {
  const { canWriteSpecs, isUpdatingSpecMeta, onSelectSpec, onUpdateSpecMeta, selectedSpec, specs } =
    props;
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

  const handleToggleArchived = async () => {
    const nextStatus = selectedSpec.meta.status === 'archived' ? 'draft' : 'archived';
    const result = await onUpdateSpecMeta({
      specId: selectedSpec.meta.id,
      revision: selectedSpec.meta.revision,
      status: nextStatus,
      relations: selectedSpec.meta.relations,
    });

    if (!result) {
      updateFeedback('메타데이터를 저장하지 못했습니다.', 'alert');
      return;
    }

    if (result.kind === 'conflict') {
      updateFeedback('다른 변경이 먼저 저장되어 다시 확인이 필요합니다.', 'alert');
      return;
    }

    if (result.kind === 'no-op') {
      updateFeedback('변경된 메타데이터가 없습니다.', 'default');
      return;
    }

    updateFeedback(
      nextStatus === 'archived' ? '명세를 보관했습니다.' : '명세를 초안으로 되돌렸습니다.',
      'default',
    );
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
    <section className="spec-metadata-panel">
      <div className="spec-metadata-panel__header">
        <div>
          <span className="analysis-empty-panel__eyebrow">메타데이터</span>
          <h5>연결 명세</h5>
        </div>
        <button
          className="secondary-button"
          disabled={!canWriteSpecs || isUpdatingSpecMeta}
          onClick={() => {
            void handleToggleArchived();
          }}
          title={
            selectedSpec.meta.status === 'archived'
              ? '보관된 명세를 다시 초안 상태로 전환'
              : '현재 명세를 보관 상태로 전환'
          }
          type="button"
        >
          {isUpdatingSpecMeta
            ? '저장 중'
            : selectedSpec.meta.status === 'archived'
              ? '보관 해제'
              : '보관'}
        </button>
      </div>

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
        <button
          className="secondary-button"
          disabled={
            !canWriteSpecs ||
            isUpdatingSpecMeta ||
            !draftTargetSpecId ||
            relationTargetOptions.length === 0 ||
            hasMatchingRelation
          }
          onClick={() => {
            void handleAddRelation();
          }}
          title={hasMatchingRelation ? '이미 같은 연결이 있습니다.' : '현재 명세에 연결 추가'}
          type="button"
        >
          추가
        </button>
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
                  <button
                    className="secondary-button"
                    disabled={!targetSpec}
                    onClick={() => {
                      if (!targetSpec) {
                        return;
                      }

                      onSelectSpec(targetSpec.meta.id);
                    }}
                    type="button"
                  >
                    이동
                  </button>
                  <button
                    className="secondary-button secondary-button--danger"
                    disabled={!canWriteSpecs || isUpdatingSpecMeta}
                    onClick={() => {
                      void handleRemoveRelation(relation);
                    }}
                    type="button"
                  >
                    제거
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
