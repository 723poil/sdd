import { useEffect, useMemo } from 'react';

import type {
  ProjectSpecApplyVersionResult,
  ProjectSpecDeleteVersionResult,
  ProjectSpecDocument,
  ProjectSpecMetaUpdateResult,
  ProjectSpecRelation,
  ProjectSpecSaveResult,
  ProjectSpecStatus,
  ProjectSpecVersionDiff,
  ProjectSpecVersionHistoryEntry,
} from '@/domain/project/project-spec-model';
import { DOCUMENT_MAP_VIEWPORT_PRESET } from '@/renderer/features/project-bootstrap/project-bootstrap-page/workspace-map.shared';
import { SpecsWorkspaceDocumentView } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/specs-workspace/SpecsWorkspaceDocumentView';
import {
  buildSpecBoardNodes,
  buildSpecLinkPaths,
  createViewportToFitNodes,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/specs-workspace/specs-workspace-map.utils';
import { resolveSelectedSpec } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/specs-workspace/specs-workspace.utils';
import { WorkspaceBoardMapView } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/workspace-board-map/WorkspaceBoardMapView';
import { useWorkspaceBoardMap } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/workspace-board-map/use-workspace-board-map';

interface SpecsWorkspaceProps {
  canWriteSpecs: boolean;
  isActive: boolean;
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
  onViewModeChange: (viewMode: SpecsWorkspaceViewMode) => void;
  selectedSpecId: string | null;
  specConflictBySpecId: Record<string, boolean>;
  specs: ProjectSpecDocument[];
  viewMode: SpecsWorkspaceViewMode;
}

export type SpecsWorkspaceViewMode = 'map' | 'document';
const SPECS_BOARD_LAYOUT_RESET_VERSION = 'specs-board-layout-created-order-v1';

export function SpecsWorkspace(props: SpecsWorkspaceProps) {
  const {
    canWriteSpecs,
    isActive,
    isSavingSpec,
    isUpdatingSpecMeta,
    onApplySpecVersion,
    onDeleteSpecVersion,
    onReadSpecVersionDiff,
    onReadSpecVersionHistory,
    onSaveSpec,
    onSelectSpec,
    onUpdateSpecMeta,
    onViewModeChange,
    selectedSpecId,
    specConflictBySpecId,
    specs,
    viewMode,
  } = props;
  const selectedSpec = resolveSelectedSpec(specs, selectedSpecId);
  const specsKey = useMemo(
    () =>
      specs
        .map((spec) => {
          const relationKey = spec.meta.relations
            .map((relation) => `${relation.targetSpecId}:${relation.type}:${relation.createdAt}`)
            .join(',');

          return [
            SPECS_BOARD_LAYOUT_RESET_VERSION,
            spec.meta.id,
            spec.meta.revision,
            spec.meta.status,
            spec.meta.updatedAt,
            relationKey,
          ].join('#');
        })
        .join('|'),
    [specs],
  );
  const baseBoardNodes = useMemo(
    () => buildSpecBoardNodes(specs, specConflictBySpecId),
    [specConflictBySpecId, specs],
  );
  const boardMap = useWorkspaceBoardMap({
    baseBoardNodes,
    createViewportToFitNodes,
    isActive,
    isMapVisible: viewMode === 'map',
    maxScale: DOCUMENT_MAP_VIEWPORT_PRESET.maxScale,
    minScale: DOCUMENT_MAP_VIEWPORT_PRESET.minScale,
    onNodeOpen: (nodeId) => {
      onSelectSpec(nodeId);
      onViewModeChange('document');
    },
    onReset: () => {
      onViewModeChange('map');
    },
    resetKey: specsKey,
  });

  useEffect(() => {
    if (viewMode !== 'document') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      onViewModeChange('map');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onViewModeChange, viewMode]);

  const linkPaths = useMemo(
    () => buildSpecLinkPaths(boardMap.boardNodes, specs, boardMap.stageSize, boardMap.viewport),
    [boardMap.boardNodes, boardMap.stageSize, boardMap.viewport, specs],
  );

  if (specs.length === 0) {
    return (
      <section className="analysis-workspace analysis-workspace--board specs-workspace specs-workspace--board">
        <section className="analysis-empty-panel">
          <div className="analysis-empty-panel__card">
            <span className="analysis-empty-panel__eyebrow">명세</span>
            <h3 className="analysis-empty-panel__title">명세 카드가 아직 없습니다.</h3>
            <p className="analysis-empty-panel__description">
              오른쪽 채팅에서 새 명세를 시작하면 이 보드에 카드가 추가됩니다.
            </p>
          </div>
        </section>
      </section>
    );
  }

  if (viewMode === 'document' && selectedSpec) {
    return (
      <section className="analysis-workspace analysis-workspace--board specs-workspace specs-workspace--board">
        <SpecsWorkspaceDocumentView
          canWriteSpecs={canWriteSpecs}
          hasConflict={Boolean(specConflictBySpecId[selectedSpec.meta.id])}
          isSavingSpec={isSavingSpec}
          isUpdatingSpecMeta={isUpdatingSpecMeta}
          onApplySpecVersion={onApplySpecVersion}
          onDeleteSpecVersion={onDeleteSpecVersion}
          onReadSpecVersionDiff={onReadSpecVersionDiff}
          onReadSpecVersionHistory={onReadSpecVersionHistory}
          onReturnToMap={() => {
            onViewModeChange('map');
          }}
          onSaveSpec={onSaveSpec}
          onSelectSpec={onSelectSpec}
          onUpdateSpecMeta={onUpdateSpecMeta}
          selectedSpec={selectedSpec}
          specs={specs}
        />
      </section>
    );
  }

  return (
    <section className="analysis-workspace analysis-workspace--board specs-workspace specs-workspace--board">
      <WorkspaceBoardMapView
        boardNodes={boardMap.boardNodes}
        draggingNodeId={boardMap.draggingNodeId}
        getNodeClassName={(node) => `specs-map__node${node.isArchived ? ' specs-map__node--archived' : ''}`}
        isPanning={boardMap.isPanning}
        linkClassName="specs-map__link"
        linkLabelClassName="specs-map__link-label"
        linkPaths={linkPaths}
        markerId="specs-map-arrowhead"
        onFitBoardToStage={boardMap.fitBoardToStage}
        onNodeClick={boardMap.handleNodeClick}
        onNodePointerDown={boardMap.handleNodePointerDown}
        onResetPositions={boardMap.resetBoardPositions}
        onStagePointerDown={boardMap.handleStagePointerDown}
        onStageWheel={boardMap.handleStageWheel}
        onZoomIn={boardMap.zoomIn}
        onZoomOut={boardMap.zoomOut}
        renderNodeContent={(node) => (
          <>
            <div className="specs-map__node-header">
              <span className="analysis-map__node-file">{node.slug}</span>
              {node.isArchived ? <span className="specs-map__archived-badge">보관됨</span> : null}
            </div>
            <strong className="analysis-map__node-title">{node.title}</strong>
            <div className="specs-map__meta">
              <span
                className={`specs-map__meta-chip ${
                  node.isArchived ? 'specs-map__meta-chip--archived' : ''
                }`}
              >
                {node.status}
              </span>
              <span className="specs-map__meta-chip">{node.version}</span>
              {node.hasConflict ? (
                <span className="specs-map__meta-chip specs-map__meta-chip--alert">충돌</span>
              ) : null}
              <span className="specs-map__meta-chip">{node.updatedAtLabel}</span>
            </div>
            <span className="analysis-map__node-summary">{node.summary}</span>
          </>
        )}
        rootClassName="specs-map"
        selectedNodeId={selectedSpec?.meta.id ?? null}
        shouldShowLinkLabels={boardMap.viewport.scale >= 0.78}
        stageGridStyle={boardMap.stageGridStyle}
        stageRef={boardMap.stageRef}
        viewportScale={boardMap.viewport.scale}
        worldStyle={boardMap.worldStyle}
      />
    </section>
  );
}
