import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { AgentCliRuntimePort } from '@/application/app-settings/app-settings.ports';
import type {
  AgentCliConnectionCheck,
} from '@/domain/app-settings/agent-cli-connection-model';
import { findAgentCliConnectionDefinition } from '@/domain/app-settings/agent-cli-connection-model';
import { err, ok } from '@/shared/contracts/result';

import { resolveAgentCliExecutablePath } from '@/infrastructure/agent-cli/resolve-agent-cli-executable-path';

const execFileAsync = promisify(execFile);
const CONNECTION_CHECK_TIMEOUT_MS = 5_000;

export function createNodeAgentCliRuntimeAdapter(): AgentCliRuntimePort {
  return {
    async checkAgentCliConnection(input) {
      const definition = findAgentCliConnectionDefinition(input.agentId);
      if (!definition) {
        return err({
          code: 'UNSUPPORTED_AGENT_CLI',
          message: '아직 지원하지 않는 CLI 에이전트입니다.',
        });
      }

      const requestedExecutablePath = input.executablePath ?? definition.defaultExecutableName;
      const checkedAt = new Date().toISOString();
      const resolvedExecutablePath = await resolveAgentCliExecutablePath({
        executablePath: requestedExecutablePath,
      });

      if (!resolvedExecutablePath) {
        return ok(
          createConnectionCheck({
            agentId: input.agentId,
            status: 'missing',
            message: '실행 파일을 찾지 못했습니다. 경로나 PATH를 확인해 주세요.',
            checkedAt,
            resolvedCommand: requestedExecutablePath,
            version: null,
          }),
        );
      }

      try {
        const { stderr, stdout } = await execFileAsync(
          resolvedExecutablePath,
          definition.connectionCheckArgs,
          {
            timeout: CONNECTION_CHECK_TIMEOUT_MS,
          },
        );
        const version = extractVersion(stdout, stderr);

        return ok(
          createConnectionCheck({
            agentId: input.agentId,
            status: 'ready',
            message: 'CLI 실행을 확인했습니다.',
            checkedAt,
            resolvedCommand: resolvedExecutablePath,
            version,
          }),
        );
      } catch (error) {
        if (isMissingExecutable(error)) {
          return ok(
            createConnectionCheck({
              agentId: input.agentId,
              status: 'missing',
              message: '실행 파일을 찾지 못했습니다. 경로나 PATH를 확인해 주세요.',
              checkedAt,
              resolvedCommand: resolvedExecutablePath,
              version: null,
            }),
          );
        }

        if (isTimeoutError(error)) {
          return ok(
            createConnectionCheck({
              agentId: input.agentId,
              status: 'error',
              message: '연결 확인이 시간 초과되었습니다. CLI 실행 상태를 다시 확인해 주세요.',
              checkedAt,
              resolvedCommand: resolvedExecutablePath,
              version: null,
            }),
          );
        }

        return ok(
          createConnectionCheck({
            agentId: input.agentId,
            status: 'error',
            message: 'CLI를 실행했지만 연결 확인에 실패했습니다.',
            checkedAt,
            resolvedCommand: resolvedExecutablePath,
            version: null,
          }),
        );
      }
    },
  };
}

function createConnectionCheck(input: AgentCliConnectionCheck): AgentCliConnectionCheck {
  return input;
}

function extractVersion(stdout: string, stderr: string): string | null {
  const combinedOutput = `${stdout}\n${stderr}`.trim();
  const firstLine = combinedOutput
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstLine ?? null;
}

function isMissingExecutable(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
      (error as NodeJS.ErrnoException).code === 'EACCES')
  );
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ETIMEDOUT'
  );
}
