import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { AgentCliSettingsPort } from '@/application/app-settings/app-settings.ports';
import type { ProjectReferenceTagGeneratorPort } from '@/application/project/project.ports';
import { createProjectError } from '@/domain/project/project-errors';
import { err } from '@/shared/contracts/result';

import { resolveCodexRuntimeSettings } from '@/infrastructure/analysis/node-project-analyzer-codex-settings';
import { executeCodexProjectReferenceTagGeneration } from '@/infrastructure/reference-tags/node-project-reference-tag-generator-codex-execution';
import {
  createProjectReferenceTagGeneratorOutputSchema,
  createProjectReferenceTagGeneratorPrompt,
} from '@/infrastructure/reference-tags/project-reference-tag-generator-codex-prompt';
import { parseProjectReferenceTagGenerationResult } from '@/infrastructure/reference-tags/project-reference-tag-generator-codex-result';

export function createNodeProjectReferenceTagGeneratorAdapter(dependencies: {
  agentCliSettingsStore: AgentCliSettingsPort;
}): ProjectReferenceTagGeneratorPort {
  const controllerMap = new Map<string, AbortController>();

  return {
    async generateReferenceTags(input) {
      const rootPath = resolve(input.rootPath);
      if (controllerMap.has(rootPath)) {
        return err(
          createProjectError(
            'PROJECT_REFERENCE_TAG_GENERATION_FAILED',
            '이 프로젝트의 자동 태그 생성이 이미 실행 중입니다.',
          ),
        );
      }

      const controller = new AbortController();
      controllerMap.set(rootPath, controller);
      let tempDirectoryPath: string | null = null;

      try {
        const codexRuntimeSettingsResult = await resolveCodexRuntimeSettings({
          agentCliSettingsStore: dependencies.agentCliSettingsStore,
        });
        if (!codexRuntimeSettingsResult.ok) {
          return codexRuntimeSettingsResult;
        }

        const validFilePaths = input.analysis.fileIndex.map((entry) => entry.path);
        tempDirectoryPath = await mkdtemp(join(tmpdir(), 'sdd-reference-tags-'));
        const outputSchemaPath = join(tempDirectoryPath, 'reference-tags.schema.json');
        const outputLastMessagePath = join(tempDirectoryPath, 'reference-tags.last-message.json');

        await writeFile(
          outputSchemaPath,
          JSON.stringify(createProjectReferenceTagGeneratorOutputSchema(), null, 2),
          'utf8',
        );

        const executeResult = await executeCodexProjectReferenceTagGeneration({
          executablePath: codexRuntimeSettingsResult.value.executablePath,
          model: codexRuntimeSettingsResult.value.connectionSettings.model,
          modelReasoningEffort:
            codexRuntimeSettingsResult.value.connectionSettings.modelReasoningEffort,
          outputLastMessagePath,
          outputSchemaPath,
          prompt: createProjectReferenceTagGeneratorPrompt({
            fileCount: validFilePaths.length,
            projectName: input.projectName,
          }),
          rootPath,
          signal: controller.signal,
        });
        if (!executeResult.ok) {
          return executeResult;
        }

        const rawOutput = await readFile(outputLastMessagePath, 'utf8');
        return parseProjectReferenceTagGenerationResult({
          raw: rawOutput,
          validFilePaths,
        });
      } catch (error) {
        return err(
          createProjectError(
            'PROJECT_REFERENCE_TAG_GENERATION_FAILED',
            '에이전트로 자동 태그를 생성하는 중 오류가 발생했습니다.',
            error instanceof Error ? error.message : String(error),
          ),
        );
      } finally {
        controllerMap.delete(rootPath);
        if (tempDirectoryPath) {
          await rm(tempDirectoryPath, { recursive: true, force: true });
        }
      }
    },

    cancelReferenceTagGeneration(input) {
      controllerMap.get(resolve(input.rootPath))?.abort();
      return { ok: true, value: undefined };
    },
  };
}
