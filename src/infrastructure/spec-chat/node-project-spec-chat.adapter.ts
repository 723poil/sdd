import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { AgentCliSettingsPort } from '@/application/app-settings/app-settings.ports';
import type { ProjectSpecChatPort } from '@/application/project/project.ports';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok } from '@/shared/contracts/result';

import { resolveCodexRuntimeSettings } from '@/infrastructure/analysis/node-project-analyzer-codex-settings';
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
      const runtimeSettingsResult = await resolveCodexRuntimeSettings({
        agentCliSettingsStore: dependencies.agentCliSettingsStore,
        overrides: {
          model: input.model,
          modelReasoningEffort: input.modelReasoningEffort,
        },
      });
      if (!runtimeSettingsResult.ok) {
        return runtimeSettingsResult;
      }

      const tempDirectoryPath = await mkdtemp(join(tmpdir(), 'sdd-codex-spec-chat-'));
      const outputSchemaPath = join(tempDirectoryPath, 'spec-chat.schema.json');
      const outputLastMessagePath = join(tempDirectoryPath, 'spec-chat.last-message.json');

      try {
        try {
          await writeFile(
            outputSchemaPath,
            JSON.stringify(createProjectSpecChatOutputSchema(), null, 2),
            'utf8',
          );

          const executeResult = await executeCodexProjectSpecChat({
            executablePath: runtimeSettingsResult.value.executablePath,
            model: runtimeSettingsResult.value.connectionSettings.model,
            modelReasoningEffort:
              runtimeSettingsResult.value.connectionSettings.modelReasoningEffort,
            outputLastMessagePath,
            outputSchemaPath,
            prompt: await createProjectSpecChatPrompt({
              projectName: input.projectName,
              rootPath,
              sessionMessages: input.sessionMessages,
              spec: input.spec,
            }),
            rootPath,
            signal: input.signal,
          });
          if (!executeResult.ok) {
            return executeResult;
          }

          const rawOutput = await readFile(outputLastMessagePath, 'utf8');
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
