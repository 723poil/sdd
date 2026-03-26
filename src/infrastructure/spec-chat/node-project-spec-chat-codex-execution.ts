import { spawn } from 'node:child_process';

import type { AgentCliConnectionSettings } from '@/domain/app-settings/agent-cli-connection-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

const CODEX_SPEC_CHAT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const CODEX_SPEC_CHAT_MAX_DURATION_MS = 45 * 60 * 1000;
const OUTPUT_TAIL_MAX_LENGTH = 4_000;

export async function executeCodexProjectSpecChat(input: {
  executablePath: string;
  model: string;
  modelReasoningEffort: AgentCliConnectionSettings['modelReasoningEffort'];
  outputLastMessagePath: string;
  outputSchemaPath: string;
  prompt: string;
  rootPath: string;
  signal: AbortSignal;
}): Promise<Result<void>> {
  if (input.signal.aborted) {
    return err(
      createProjectError('PROJECT_SESSION_MESSAGE_CANCELLED', '채팅 요청을 취소했습니다.'),
    );
  }

  return new Promise((resolvePromise) => {
    const commandArgs = [
      '-a',
      'never',
      'exec',
      '--model',
      input.model,
      '-c',
      `model_reasoning_effort="${input.modelReasoningEffort}"`,
      '--sandbox',
      'read-only',
      '--skip-git-repo-check',
      '--json',
      '--output-schema',
      input.outputSchemaPath,
      '--output-last-message',
      input.outputLastMessagePath,
      '-C',
      input.rootPath,
      '-',
    ];

    const childProcess = spawn(input.executablePath, commandArgs, {
      cwd: input.rootPath,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let didIdleTimeout = false;
    let didMaxDurationTimeout = false;
    let didAbort = false;
    let didResolve = false;
    let idleTimeout: NodeJS.Timeout | null = null;
    let stderrTail = '';
    let stdoutTail = '';

    const handleAbort = () => {
      didAbort = true;
      childProcess.kill('SIGTERM');
    };

    const refreshIdleTimeout = () => {
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }

      idleTimeout = setTimeout(() => {
        didIdleTimeout = true;
        childProcess.kill('SIGTERM');
      }, CODEX_SPEC_CHAT_IDLE_TIMEOUT_MS);
    };

    refreshIdleTimeout();

    const maxDurationTimeout = setTimeout(() => {
      didMaxDurationTimeout = true;
      childProcess.kill('SIGTERM');
    }, CODEX_SPEC_CHAT_MAX_DURATION_MS);

    const resolveOnce = (result: Result<void>) => {
      if (didResolve) {
        return;
      }

      didResolve = true;
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }
      clearTimeout(maxDurationTimeout);
      input.signal.removeEventListener('abort', handleAbort);
      resolvePromise(result);
    };

    input.signal.addEventListener('abort', handleAbort, { once: true });

    childProcess.stdout.on('data', (chunk: Buffer | string) => {
      stdoutTail = appendOutputTail(stdoutTail, chunk.toString());
      refreshIdleTimeout();
    });

    childProcess.stderr.on('data', (chunk: Buffer | string) => {
      stderrTail = appendOutputTail(stderrTail, chunk.toString());
      refreshIdleTimeout();
    });

    childProcess.on('error', (error) => {
      const errorCode =
        error instanceof Error && 'code' in error ? (error as NodeJS.ErrnoException).code : null;
      if (errorCode === 'ENOENT' || errorCode === 'EACCES') {
        resolveOnce(
          err(
            createProjectError(
              'AGENT_CLI_NOT_AVAILABLE',
              '선택한 Codex CLI 실행 파일을 찾지 못했습니다. 앱 설정에서 경로나 PATH를 확인해 주세요.',
              input.executablePath,
            ),
          ),
        );
        return;
      }

      resolveOnce(
        err(
          createProjectError(
            'PROJECT_SPEC_CHAT_FAILED',
            'Codex CLI로 명세 채팅 응답을 실행하지 못했습니다.',
            error instanceof Error ? error.message : undefined,
          ),
        ),
      );
    });

    childProcess.on('close', (code) => {
      if (didAbort || input.signal.aborted) {
        resolveOnce(
          err(createProjectError('PROJECT_SESSION_MESSAGE_CANCELLED', '채팅 요청을 취소했습니다.')),
        );
        return;
      }

      if (didIdleTimeout) {
        resolveOnce(
          err(
            createProjectError(
              'PROJECT_SPEC_CHAT_FAILED',
              '명세 채팅 응답이 오랫동안 진행되지 않아 중단되었습니다.',
            ),
          ),
        );
        return;
      }

      if (didMaxDurationTimeout) {
        resolveOnce(
          err(
            createProjectError(
              'PROJECT_SPEC_CHAT_FAILED',
              '명세 채팅 응답이 최대 실행 시간을 넘어 중단되었습니다.',
            ),
          ),
        );
        return;
      }

      if (code !== 0) {
        resolveOnce(
          err(
            createProjectError(
              'PROJECT_SPEC_CHAT_FAILED',
              'Codex CLI가 명세 채팅 응답 중 비정상 종료되었습니다.',
              buildCodexFailureDetails({
                code,
                stderrTail,
                stdoutTail,
              }),
            ),
          ),
        );
        return;
      }

      resolveOnce(ok(undefined));
    });

    childProcess.stdin.write(input.prompt);
    childProcess.stdin.end();
  });
}

function appendOutputTail(current: string, nextChunk: string): string {
  return `${current}${nextChunk}`.slice(-OUTPUT_TAIL_MAX_LENGTH);
}

function buildCodexFailureDetails(input: {
  code: number | null;
  stderrTail: string;
  stdoutTail: string;
}): string {
  const details = [
    input.code !== null ? `exitCode=${input.code}` : null,
    input.stderrTail.trim().length > 0 ? `stderr=${input.stderrTail.trim()}` : null,
    input.stdoutTail.trim().length > 0 ? `stdout=${input.stdoutTail.trim()}` : null,
  ].filter((value): value is string => value !== null);

  return details.join('\n');
}
