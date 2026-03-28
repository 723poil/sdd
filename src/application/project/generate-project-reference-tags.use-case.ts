import {
  createEmptyProjectReferenceTagDocument,
  type ProjectReferenceTagDocument,
} from '@/domain/project/project-reference-tag-model';
import type { AgentCliId } from '@/domain/app-settings/agent-cli-connection-model';
import { createProjectError } from '@/domain/project/project-errors';
import type { Result } from '@/shared/contracts/result';
import { err } from '@/shared/contracts/result';

import { ensureProjectStorageReady } from '@/application/project/ensure-project-storage-ready';
import type {
  ProjectInspectorPort,
  ProjectReferenceTagGeneratorPort,
  ProjectStoragePort,
} from '@/application/project/project.ports';

export interface GenerateProjectReferenceTagsUseCase {
  execute(input: {
    agentId: AgentCliId;
    rootPath: string;
  }): Promise<Result<ProjectReferenceTagDocument>>;
}

export function createGenerateProjectReferenceTagsUseCase(dependencies: {
  projectInspector: ProjectInspectorPort;
  projectReferenceTagGenerator: ProjectReferenceTagGeneratorPort;
  projectStorage: ProjectStoragePort;
}): GenerateProjectReferenceTagsUseCase {
  return {
    async execute(input) {
      const storageResult = await ensureProjectStorageReady(dependencies, {
        notWritableMessage: '자동 태그를 저장하려면 프로젝트 경로에 쓰기 권한이 필요합니다.',
        rootPath: input.rootPath,
      });
      if (!storageResult.ok) {
        return storageResult;
      }

      const analysisResult = await dependencies.projectStorage.readProjectAnalysis({
        rootPath: storageResult.value.projectMeta.rootPath,
      });
      if (!analysisResult.ok) {
        return analysisResult;
      }

      if (!analysisResult.value || analysisResult.value.fileIndex.length === 0) {
        return err(
          createProjectError(
            'PROJECT_REFERENCE_TAG_GENERATION_FAILED',
            '자동 태그를 만들 분석 결과가 없습니다. 먼저 참조 분석을 실행해 주세요.',
          ),
        );
      }

      const generatedReferenceTagsResult =
        await dependencies.projectReferenceTagGenerator.generateReferenceTags({
          agentId: input.agentId,
          analysis: analysisResult.value,
          projectName: storageResult.value.projectMeta.projectName,
          rootPath: storageResult.value.projectMeta.rootPath,
        });
      if (!generatedReferenceTagsResult.ok) {
        return generatedReferenceTagsResult;
      }

      const existingReferenceTags =
        analysisResult.value.referenceTags ?? createEmptyProjectReferenceTagDocument({ revision: 0 });

      return dependencies.projectStorage.saveProjectReferenceTags({
        rootPath: storageResult.value.projectMeta.rootPath,
        referenceTags: {
          ...generatedReferenceTagsResult.value,
          revision: existingReferenceTags.revision,
          updatedAt: existingReferenceTags.updatedAt,
        },
      });
    },
  };
}
