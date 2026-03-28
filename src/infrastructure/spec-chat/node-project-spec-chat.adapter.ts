import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { AgentCliSettingsPort } from '@/application/app-settings/app-settings.ports';
import type { ProjectSpecChatPort } from '@/application/project/project.ports';
import {
  describeUnsupportedAgentCliFeature,
  isAgentCliFeatureSupported,
} from '@/domain/app-settings/agent-cli-connection-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok } from '@/shared/contracts/result';

import { executeCliAgentStructuredTask } from '@/infrastructure/cli-agents/execute-cli-agent-structured-task';
import { createStructuredOutputPrompt } from '@/infrastructure/cli-agents/create-structured-output-prompt';
import { resolveCliAgentRuntimeSettings } from '@/infrastructure/cli-agents/resolve-cli-agent-runtime-settings';
import { executeCodexProjectSpecChat } from '@/infrastructure/spec-chat/node-project-spec-chat-codex-execution';
import {
  createProjectSpecChatOutputSchema,
  createProjectSpecChatPrompt,
} from '@/infrastructure/spec-chat/project-spec-chat-codex-prompt';
import { parseProjectSpecChatCodexResult } from '@/infrastructure/spec-chat/project-spec-chat-codex-result';

export function createNodeProjectSpecChatAdapter(dependencies: {
  agentCliSettingsStore: AgentCliSettingsPort;
}): ProjectSpecChatPort {
  return {
    async generateReply(input) {
      if (input.signal.aborted) {
        return err(
          createProjectError('PROJECT_SESSION_MESSAGE_CANCELLED', '채팅 요청을 취소했습니다.'),
        );
      }

      const rootPath = resolve(input.rootPath);
      if (!isAgentCliFeatureSupported(input.agentId, 'spec-chat')) {
        return err(
          createProjectError(
            'PROJECT_SPEC_CHAT_FAILED',
            describeUnsupportedAgentCliFeature(input.agentId, 'spec-chat'),
          ),
        );
      }

      const runtimeSettingsResult = await resolveCliAgentRuntimeSettings({
        agentCliSettingsStore: dependencies.agentCliSettingsStore,
        agentId: input.agentId,
        overrides: {
          model: input.model,
          modelReasoningEffort: input.modelReasoningEffort,
        },
      });
      if (!runtimeSettingsResult.ok) {
        return runtimeSettingsResult;
      }

      const tempDirectoryPath = await mkdtemp(
        join(tmpdir(), `sdd-${runtimeSettingsResult.value.definition.agentId}-spec-chat-`),
      );
      const outputSchemaPath = join(tempDirectoryPath, 'spec-chat.schema.json');
      const outputLastMessagePath = join(tempDirectoryPath, 'spec-chat.last-message.json');
      const outputSchema = createProjectSpecChatOutputSchema();

      try {
        try {
          await writeFile(outputSchemaPath, JSON.stringify(outputSchema, null, 2), 'utf8');
          const prompt = await createProjectSpecChatPrompt({
            projectName: input.projectName,
            rootPath,
            sessionMessages: input.sessionMessages,
            spec: input.spec,
          });

          let rawOutput: string;
          if (input.agentId === 'codex') {
            const executeResult = await executeCodexProjectSpecChat({
              executablePath: runtimeSettingsResult.value.executablePath,
              model: runtimeSettingsResult.value.connectionSettings.model,
              modelReasoningEffort:
                runtimeSettingsResult.value.connectionSettings.modelReasoningEffort,
              outputLastMessagePath,
              outputSchemaPath,
              prompt,
              rootPath,
              signal: input.signal,
            });
            if (!executeResult.ok) {
              return executeResult;
            }

            rawOutput = await readFile(outputLastMessagePath, 'utf8');
          } else {
            const executeResult = await executeCliAgentStructuredTask({
              agentId: input.agentId,
              displayName: runtimeSettingsResult.value.definition.displayName,
              executablePath: runtimeSettingsResult.value.executablePath,
              idleTimeoutMs: 15 * 60 * 1000,
              maxDurationMs: 45 * 60 * 1000,
              model: runtimeSettingsResult.value.connectionSettings.model,
              modelReasoningEffort:
                runtimeSettingsResult.value.connectionSettings.modelReasoningEffort,
              prompt: createStructuredOutputPrompt({
                basePrompt: prompt,
                outputSchema,
              }),
              rootPath,
              signal: input.signal,
              taskLabel: '명세 채팅 응답',
            });
            if (!executeResult.ok) {
              return executeResult;
            }

            rawOutput = executeResult.value;
          }
          const parsedResult = parseProjectSpecChatCodexResult(rawOutput);
          if (!parsedResult.ok) {
            return parsedResult;
          }

          const reply = parsedResult.value.reply.trim();
          const title = parsedResult.value.title.trim();
          const markdown = parsedResult.value.markdown.trim();
          if (reply.length === 0) {
            return err(
              createProjectError(
                'PROJECT_SPEC_CHAT_FAILED',
                '에이전트 응답이 비어 있어 채팅 메시지로 사용할 수 없습니다.',
              ),
            );
          }

          if (title.length === 0 || markdown.length === 0) {
            return err(
              createProjectError(
                'PROJECT_SPEC_CHAT_FAILED',
                '에이전트 응답에 저장할 명세 제목 또는 본문이 비어 있습니다.',
              ),
            );
          }

          return ok({
            markdown,
            reply,
            summary: parsedResult.value.summary,
            title,
          });
        } catch (error) {
          return err(
            createProjectError(
              'PROJECT_SPEC_CHAT_FAILED',
              '명세 채팅 응답을 처리하지 못했습니다.',
              error instanceof Error ? error.message : undefined,
            ),
          );
        }
      } finally {
        await rm(tempDirectoryPath, { recursive: true, force: true });
      }
    },
  };
}
