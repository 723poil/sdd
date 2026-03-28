import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { AgentCliSettingsPort } from '@/application/app-settings/app-settings.ports';
import type { ProjectReferenceTagGeneratorPort } from '@/application/project/project.ports';
import {
  describeUnsupportedAgentCliFeature,
  isAgentCliFeatureSupported,
} from '@/domain/app-settings/agent-cli-connection-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err } from '@/shared/contracts/result';

import { executeCliAgentStructuredTask } from '@/infrastructure/cli-agents/execute-cli-agent-structured-task';
import { createStructuredOutputPrompt } from '@/infrastructure/cli-agents/create-structured-output-prompt';
import { resolveCliAgentRuntimeSettings } from '@/infrastructure/cli-agents/resolve-cli-agent-runtime-settings';
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
        if (!isAgentCliFeatureSupported(input.agentId, 'reference-tags')) {
          return err(
            createProjectError(
              'PROJECT_REFERENCE_TAG_GENERATION_FAILED',
              describeUnsupportedAgentCliFeature(input.agentId, 'reference-tags'),
            ),
          );
        }

        const runtimeSettingsResult = await resolveCliAgentRuntimeSettings({
          agentCliSettingsStore: dependencies.agentCliSettingsStore,
          agentId: input.agentId,
        });
        if (!runtimeSettingsResult.ok) {
          return runtimeSettingsResult;
        }

        const agentDisplayName = runtimeSettingsResult.value.definition.displayName;
        const validFilePaths = input.analysis.fileIndex.map((entry) => entry.path);
        tempDirectoryPath = await mkdtemp(
          join(tmpdir(), `sdd-${runtimeSettingsResult.value.definition.agentId}-reference-tags-`),
        );
        const outputSchemaPath = join(tempDirectoryPath, 'reference-tags.schema.json');
        const outputLastMessagePath = join(tempDirectoryPath, 'reference-tags.last-message.json');
        const outputSchema = createProjectReferenceTagGeneratorOutputSchema();

        await writeFile(outputSchemaPath, JSON.stringify(outputSchema, null, 2), 'utf8');

        let rawOutput: string;
        if (input.agentId === 'codex') {
          const executeResult = await executeCodexProjectReferenceTagGeneration({
            executablePath: runtimeSettingsResult.value.executablePath,
            model: runtimeSettingsResult.value.connectionSettings.model,
            modelReasoningEffort:
              runtimeSettingsResult.value.connectionSettings.modelReasoningEffort,
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

          rawOutput = await readFile(outputLastMessagePath, 'utf8');
        } else {
          const executeResult = await executeCliAgentStructuredTask({
            agentId: input.agentId,
            displayName: agentDisplayName,
            executablePath: runtimeSettingsResult.value.executablePath,
            idleTimeoutMs: 15 * 60 * 1000,
            maxDurationMs: 45 * 60 * 1000,
            model: runtimeSettingsResult.value.connectionSettings.model,
            modelReasoningEffort:
              runtimeSettingsResult.value.connectionSettings.modelReasoningEffort,
            prompt: createStructuredOutputPrompt({
              basePrompt: createProjectReferenceTagGeneratorPrompt({
                fileCount: validFilePaths.length,
                projectName: input.projectName,
              }),
              outputSchema,
            }),
            rootPath,
            signal: controller.signal,
            taskLabel: '자동 태그 생성',
          });
          if (!executeResult.ok) {
            return executeResult;
          }

          rawOutput = executeResult.value;
        }
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
