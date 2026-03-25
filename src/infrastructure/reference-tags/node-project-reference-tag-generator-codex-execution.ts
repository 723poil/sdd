import { spawn } from 'node:child_process';

import type { AgentCliConnectionSettings } from '@/domain/app-settings/agent-cli-connection-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, type Result } from '@/shared/contracts/result';

const CODEX_REFERENCE_TAG_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const CODEX_REFERENCE_TAG_MAX_DURATION_MS = 45 * 60 * 1000;
const OUTPUT_TAIL_MAX_LENGTH = 4_000;

export async function executeCodexProjectReferenceTagGeneration(input: {
  executablePath: string;
  model: string;
  modelReasoningEffort: AgentCliConnectionSettings['modelReasoningEffort'];
  outputLastMessagePath: string;
  outputSchemaPath: string;
  prompt: string;
  rootPath: string;
  signal: AbortSignal;
}): Promise<Result<void>> {
  return new Promise((resolvePromise) => {
    if (input.signal.aborted) {
      resolvePromise(createCancelledReferenceTagGenerationResult());
      return;
    }

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

    const refreshIdleTimeout = () => {
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }

      idleTimeout = setTimeout(() => {
        didIdleTimeout = true;
        childProcess.kill('SIGTERM');
      }, CODEX_REFERENCE_TAG_IDLE_TIMEOUT_MS);
    };

    refreshIdleTimeout();

    const maxDurationTimeout = setTimeout(() => {
      didMaxDurationTimeout = true;
      childProcess.kill('SIGTERM');
    }, CODEX_REFERENCE_TAG_MAX_DURATION_MS);

    const resolveOnce = (result: Result<void>) => {
      if (didResolve) {
        return;
      }

      didResolve = true;
      input.signal.removeEventListener('abort', handleAbort);
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }
      clearTimeout(maxDurationTimeout);
      resolvePromise(result);
    };

    const handleAbort = () => {
      didAbort = true;
      childProcess.kill('SIGTERM');
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
              'Codex CLI 실행 파일을 찾지 못했습니다. 앱 설정에서 경로나 PATH를 확인해 주세요.',
              input.executablePath,
            ),
          ),
        );
        return;
      }

      resolveOnce(
        err(
          createProjectError(
            'PROJECT_REFERENCE_TAG_GENERATION_FAILED',
            'Codex CLI로 자동 태그를 실행하지 못했습니다.',
            error instanceof Error ? error.message : undefined,
          ),
        ),
      );
    });

    childProcess.on('close', (code) => {
      if (didAbort || input.signal.aborted) {
        resolveOnce(createCancelledReferenceTagGenerationResult());
        return;
      }

      if (didIdleTimeout) {
        resolveOnce(
          err(
            createProjectError(
              'PROJECT_REFERENCE_TAG_GENERATION_FAILED',
              '자동 태그 생성이 오랫동안 진행되지 않아 중단되었습니다.',
            ),
          ),
        );
        return;
      }

      if (didMaxDurationTimeout) {
        resolveOnce(
          err(
            createProjectError(
              'PROJECT_REFERENCE_TAG_GENERATION_FAILED',
              '자동 태그 생성이 최대 실행 시간을 넘어 중단되었습니다.',
            ),
          ),
        );
        return;
      }

      if (code !== 0) {
        resolveOnce(
          err(
            createProjectError(
              'PROJECT_REFERENCE_TAG_GENERATION_FAILED',
              'Codex CLI가 자동 태그 생성 중 비정상 종료되었습니다.',
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

      resolveOnce({ ok: true, value: undefined });
    });

    childProcess.stdin.write(input.prompt);
    childProcess.stdin.end();
  });
}

function createCancelledReferenceTagGenerationResult(): Result<never> {
  return err(
    createProjectError(
      'PROJECT_REFERENCE_TAG_GENERATION_CANCELLED',
      '자동 태그 생성이 취소되었습니다.',
    ),
  );
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
