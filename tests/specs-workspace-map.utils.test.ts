import test from 'node:test';
import assert from 'node:assert/strict';

import type { ProjectSpecDocument, ProjectSpecRelation } from '@/domain/project/project-spec-model';
import {
  buildSpecBoardNodes,
  buildSpecLinkPaths,
  createViewportToFitNodes,
  type SpecsStageSize,
  type SpecsViewport,
} from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/specs-workspace/specs-workspace-map.utils';
import { buildWorkspaceBoardLinkPaths } from '@/renderer/features/project-bootstrap/project-bootstrap-page/components/workspace-board-map/workspace-board-map.utils';

function createSpecDocument(input: {
  createdAt?: string;
  id: string;
  relations?: ProjectSpecRelation[];
  status?: 'archived' | 'draft';
  title: string;
  updatedAt: string;
}): ProjectSpecDocument {
  return {
    meta: {
      schemaVersion: 3,
      id: input.id,
      slug: input.id,
      title: input.title,
      status: input.status ?? 'draft',
      createdAt: input.createdAt ?? input.updatedAt,
      updatedAt: input.updatedAt,
      revision: 1,
      latestVersion: 'v1',
      currentVersion: 'v1',
      draftMarkdown: `# ${input.title}`,
      summary: `${input.title} 요약`,
      relations: input.relations ?? [],
    },
    markdown: `# ${input.title}`,
  };
}

function toScreenX(x: number, stageSize: SpecsStageSize, viewport: SpecsViewport): number {
  return stageSize.width / 2 + viewport.offsetX + x * viewport.scale;
}

function toScreenY(y: number, stageSize: SpecsStageSize, viewport: SpecsViewport): number {
  return stageSize.height / 2 + viewport.offsetY + y * viewport.scale;
}

function parsePathEndpoints(path: string): {
  endX: number;
  endY: number;
  startX: number;
  startY: number;
} {
  const values = path
    .match(/-?\d+(?:\.\d+)?/g)
    ?.map((value) => Number.parseFloat(value));
  assert.ok(values);
  if (!values || values.length < 8) {
    throw new Error(`Unable to parse bezier path: ${path}`);
  }

  return {
    startX: values[0] ?? 0,
    startY: values[1] ?? 0,
    endX: values[6] ?? 0,
    endY: values[7] ?? 0,
  };
}

void test('createViewportToFitNodes keeps a three-card specs board inside a compact stage', () => {
  const specs = [
    createSpecDocument({
      id: 'spec-01',
      title: '첫 번째 명세',
      status: 'archived',
      updatedAt: '2026-03-26T06:00:00.000Z',
    }),
    createSpecDocument({
      id: 'spec-02',
      title: '두 번째 명세',
      status: 'archived',
      updatedAt: '2026-03-26T06:01:00.000Z',
    }),
    createSpecDocument({
      id: 'spec-03',
      title: '세 번째 명세',
      updatedAt: '2026-03-26T06:02:00.000Z',
    }),
  ];
  const stageSize = { width: 581, height: 391 };
  const nodes = buildSpecBoardNodes(specs, {});
  const viewport = createViewportToFitNodes(nodes, stageSize);
  const minLeft = Math.min(...nodes.map((node) => toScreenX(node.x, stageSize, viewport)));
  const maxRight = Math.max(
    ...nodes.map((node) => toScreenX(node.x + node.width, stageSize, viewport)),
  );
  const minTop = Math.min(...nodes.map((node) => toScreenY(node.y, stageSize, viewport)));
  const maxBottom = Math.max(
    ...nodes.map((node) => toScreenY(node.y + node.height, stageSize, viewport)),
  );

  assert.ok(minLeft >= 0, `expected board left edge to fit, received ${minLeft}`);
  assert.ok(maxRight <= stageSize.width, `expected board right edge to fit, received ${maxRight}`);
  assert.ok(minTop >= 0, `expected board top edge to fit, received ${minTop}`);
  assert.ok(
    maxBottom <= stageSize.height,
    `expected board bottom edge to fit, received ${maxBottom}`,
  );
});

void test('buildSpecBoardNodes keeps a stable relation-focused layout even when updatedAt changes', () => {
  const specs = [
    createSpecDocument({
      id: 'spec-03',
      title: '세 번째 명세',
      createdAt: '2026-03-26T06:02:00.000Z',
      updatedAt: '2026-03-26T06:04:00.000Z',
      relations: [
        {
          targetSpecId: 'spec-02',
          type: 'follow-up-to',
          createdAt: '2026-03-26T06:03:00.000Z',
        },
      ],
    }),
    createSpecDocument({
      id: 'spec-02',
      title: '두 번째 명세',
      createdAt: '2026-03-26T06:01:00.000Z',
      updatedAt: '2026-03-26T06:01:00.000Z',
    }),
    createSpecDocument({
      id: 'spec-01',
      title: '첫 번째 명세',
      createdAt: '2026-03-26T06:00:00.000Z',
      updatedAt: '2026-03-26T06:03:00.000Z',
      relations: [
        {
          targetSpecId: 'spec-02',
          type: 'derived-from',
          createdAt: '2026-03-26T06:03:30.000Z',
        },
      ],
    }),
  ];
  const nodes = buildSpecBoardNodes(specs, {});
  const spec01Node = nodes.find((node) => node.id === 'spec-01');
  const spec02Node = nodes.find((node) => node.id === 'spec-02');
  const spec03Node = nodes.find((node) => node.id === 'spec-03');

  assert.ok(spec01Node);
  assert.ok(spec02Node);
  assert.ok(spec03Node);

  if (!spec01Node || !spec02Node || !spec03Node) {
    return;
  }

  assert.equal(nodes[0]?.id, 'spec-01');
  assert.equal(nodes[1]?.id, 'spec-02');
  assert.equal(nodes[2]?.id, 'spec-03');
  assert.ok(spec01Node.x < spec02Node.x);
  assert.equal(spec01Node.x, spec03Node.x);
  assert.ok(spec02Node.y > spec01Node.y);
  assert.ok(spec02Node.y < spec03Node.y);
});

void test('buildSpecLinkPaths reuses the shared workspace link geometry for spec relations', () => {
  const specs = [
    createSpecDocument({
      id: 'spec-01',
      title: '첫 번째 명세',
      updatedAt: '2026-03-26T06:00:00.000Z',
    }),
    createSpecDocument({
      id: 'spec-02',
      title: '두 번째 명세',
      updatedAt: '2026-03-26T06:01:00.000Z',
    }),
    createSpecDocument({
      id: 'spec-03',
      title: '세 번째 명세',
      updatedAt: '2026-03-26T06:02:00.000Z',
      relations: [
        {
          targetSpecId: 'spec-02',
          type: 'follow-up-to',
          createdAt: '2026-03-26T06:03:00.000Z',
        },
      ],
    }),
  ];
  const stageSize = { width: 581, height: 391 };
  const nodes = buildSpecBoardNodes(specs, {});
  const viewport = createViewportToFitNodes(nodes, stageSize);
  const paths = buildSpecLinkPaths(nodes, specs, stageSize, viewport);
  const spec02Node = nodes.find((node) => node.id === 'spec-02');
  const spec03Node = nodes.find((node) => node.id === 'spec-03');
  const firstPath = paths[0];

  assert.equal(paths.length, 1);
  assert.ok(spec02Node);
  assert.ok(spec03Node);
  assert.ok(firstPath);

  if (!spec02Node || !spec03Node || !firstPath) {
    return;
  }

  const sharedPaths = buildWorkspaceBoardLinkPaths(
    nodes,
    [{ from: 'spec-02', to: 'spec-03', label: '후속 개발' }],
    stageSize,
    viewport,
  );
  const sharedPath = sharedPaths[0];

  assert.ok(sharedPath);
  if (!sharedPath) {
    return;
  }

  assert.equal(firstPath.path, sharedPath.path);
  assert.equal(firstPath.midX, sharedPath.midX);
  assert.equal(firstPath.midY, sharedPath.midY);
});

void test('buildSpecLinkPaths anchors diverging relations to different points on the source card', () => {
  const specs = [
    createSpecDocument({
      id: 'spec-03',
      title: '세 번째 명세',
      createdAt: '2026-03-26T06:02:00.000Z',
      updatedAt: '2026-03-26T06:04:00.000Z',
      relations: [
        {
          targetSpecId: 'spec-02',
          type: 'follow-up-to',
          createdAt: '2026-03-26T06:03:00.000Z',
        },
      ],
    }),
    createSpecDocument({
      id: 'spec-02',
      title: '두 번째 명세',
      createdAt: '2026-03-26T06:01:00.000Z',
      updatedAt: '2026-03-26T06:01:00.000Z',
    }),
    createSpecDocument({
      id: 'spec-01',
      title: '첫 번째 명세',
      createdAt: '2026-03-26T06:00:00.000Z',
      updatedAt: '2026-03-26T06:03:00.000Z',
      relations: [
        {
          targetSpecId: 'spec-02',
          type: 'derived-from',
          createdAt: '2026-03-26T06:03:30.000Z',
        },
      ],
    }),
  ];
  const stageSize = { width: 1240, height: 1121 };
  const nodes = buildSpecBoardNodes(specs, {});
  const viewport = createViewportToFitNodes(nodes, stageSize);
  const paths = buildSpecLinkPaths(nodes, specs, stageSize, viewport);
  const spec01Node = nodes.find((node) => node.id === 'spec-01');
  const spec02Node = nodes.find((node) => node.id === 'spec-02');
  const spec03Node = nodes.find((node) => node.id === 'spec-03');
  const upperPath = paths.find((path) => path.key === 'spec-02-spec-01');
  const lowerPath = paths.find((path) => path.key === 'spec-02-spec-03');

  assert.ok(spec01Node);
  assert.ok(spec02Node);
  assert.ok(spec03Node);
  assert.ok(upperPath);
  assert.ok(lowerPath);

  if (!spec01Node || !spec02Node || !spec03Node || !upperPath || !lowerPath) {
    return;
  }

  const upperEndpoints = parsePathEndpoints(upperPath.path);
  const lowerEndpoints = parsePathEndpoints(lowerPath.path);
  const spec02CenterY = toScreenY(spec02Node.y + spec02Node.height / 2, stageSize, viewport);
  const spec01CenterY = toScreenY(spec01Node.y + spec01Node.height / 2, stageSize, viewport);
  const spec03CenterY = toScreenY(spec03Node.y + spec03Node.height / 2, stageSize, viewport);

  assert.ok(upperEndpoints.startY < spec02CenterY);
  assert.ok(lowerEndpoints.startY > spec02CenterY);
  assert.ok(upperEndpoints.endY > spec01CenterY);
  assert.ok(lowerEndpoints.endY < spec03CenterY);
});
