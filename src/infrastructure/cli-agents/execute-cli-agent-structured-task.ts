import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import type {
  AgentCliConnectionSettings,
  AgentCliId,
} from '@/domain/app-settings/agent-cli-connection-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

interface ExecuteCliAgentStructuredTaskInput {
  agentId: AgentCliId;
  displayName: string;
  executablePath: string;
  model: string;
  modelReasoningEffort: AgentCliConnectionSettings['modelReasoningEffort'];
  outputLastMessagePath?: string;
  outputSchemaPath?: string;
  prompt: string;
  rootPath: string;
  signal: AbortSignal;
  taskLabel: string;
  idleTimeoutMs: number;
  maxDurationMs: number;
  onStdoutChunk?: (text: string) => void;
}

export async function executeCliAgentStructuredTask(
  input: ExecuteCliAgentStructuredTaskInput,
): Promise<Result<string>> {
  return new Promise((resolvePromise) => {
    if (input.signal.aborted) {
      resolvePromise(createCancelledTaskResult(input.taskLabel));
      return;
    }

    const command = buildAgentCliCommand(input);
    const childProcess = spawn(input.executablePath, command.args, {
      cwd: input.rootPath,
      stdio: command.promptViaStdin ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    });
    const stdout = childProcess.stdout;
    const stderr = childProcess.stderr;
    const stdin = childProcess.stdin;

    if (!stdout || !stderr || (command.promptViaStdin && !stdin)) {
      resolvePromise(
        err(
          createProjectError(
            resolveTaskErrorCode(input.agentId, input.taskLabel),
            `${input.displayName} 실행 스트림을 준비하지 못했습니다.`,
          ),
        ),
      );
      return;
    }

    let stdoutTail = '';
    let stdoutBuffer = '';
    let stderrTail = '';
    let didIdleTimeout = false;
    let didMaxDurationTimeout = false;
    let didAbort = false;
    let didResolve = false;
    let idleTimeout: NodeJS.Timeout | null = null;

    const refreshIdleTimeout = () => {
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }

      idleTimeout = setTimeout(() => {
        didIdleTimeout = true;
        childProcess.kill('SIGTERM');
      }, input.idleTimeoutMs);
    };

    refreshIdleTimeout();

    const maxDurationTimeout = setTimeout(() => {
      didMaxDurationTimeout = true;
      childProcess.kill('SIGTERM');
    }, input.maxDurationMs);

    const resolveOnce = (result: Result<string>) => {
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

    const handleAbort = () => {
      didAbort = true;
      childProcess.kill('SIGTERM');
    };

    input.signal.addEventListener('abort', handleAbort, { once: true });

    stdout.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString();
      stdoutTail = appendOutputTail(stdoutTail, text);
      stdoutBuffer = `${stdoutBuffer}${text}`;
      refreshIdleTimeout();
      input.onStdoutChunk?.(text);
    });

    stderr.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString();
      stderrTail = appendOutputTail(stderrTail, text);
      refreshIdleTimeout();
    });

    childProcess.on('error', (error) => {
      const errorCode =
        error instanceof Error && 'code' in error ? (error as NodeJS.ErrnoException).code : null;
      if (errorCode === 'ENOENT' || errorCode === 'EACCES') {
        void resolveOnce(
          err(
            createProjectError(
              'AGENT_CLI_NOT_AVAILABLE',
              `${input.displayName} 실행 파일을 찾지 못했습니다. 앱 설정에서 경로나 PATH를 확인해 주세요.`,
              input.executablePath,
            ),
          ),
        );
        return;
      }

      void resolveOnce(
        err(
          createProjectError(
            resolveTaskErrorCode(input.agentId, input.taskLabel),
            `${input.displayName} 실행 중 오류가 발생했습니다.`,
            error instanceof Error ? error.message : undefined,
          ),
        ),
      );
    });

    childProcess.on('close', async (code) => {
      if (didAbort || input.signal.aborted) {
        resolveOnce(createCancelledTaskResult(input.taskLabel));
        return;
      }

      if (didIdleTimeout) {
        resolveOnce(
          err(
            createProjectError(
              resolveTaskErrorCode(input.agentId, input.taskLabel),
              `${input.displayName} ${input.taskLabel}가 오랫동안 진행되지 않아 중단되었습니다.`,
            ),
          ),
        );
        return;
      }

      if (didMaxDurationTimeout) {
        resolveOnce(
          err(
            createProjectError(
              resolveTaskErrorCode(input.agentId, input.taskLabel),
              `${input.displayName} ${input.taskLabel}가 최대 실행 시간을 넘어 중단되었습니다.`,
            ),
          ),
        );
        return;
      }

      if (code !== 0) {
        resolveOnce(
          err(
            createProjectError(
              resolveTaskErrorCode(input.agentId, input.taskLabel),
              `${input.displayName}가 ${input.taskLabel} 중 비정상 종료되었습니다.`,
              buildFailureDetails({
                code,
                stderrTail,
                stdoutTail,
              }),
            ),
          ),
        );
        return;
      }

      const rawOutputResult = await readStructuredOutput({
        agentId: input.agentId,
        outputLastMessagePath: input.outputLastMessagePath,
        stdoutBuffer,
      });
      resolveOnce(rawOutputResult);
    });

    if (command.promptViaStdin) {
      if (!stdin) {
        void resolveOnce(
          err(
            createProjectError(
              resolveTaskErrorCode(input.agentId, input.taskLabel),
              `${input.displayName} 입력 스트림을 준비하지 못했습니다.`,
            ),
          ),
        );
        return;
      }

      stdin.write(input.prompt);
      stdin.end();
    }
  });
}

function buildAgentCliCommand(input: ExecuteCliAgentStructuredTaskInput): {
  args: string[];
  promptViaStdin: boolean;
} {
  switch (input.agentId) {
    case 'codex':
      return {
        args: [
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
          input.outputSchemaPath ?? '',
          '--output-last-message',
          input.outputLastMessagePath ?? '',
          '-C',
          input.rootPath,
          '-',
        ],
        promptViaStdin: true,
      };
    case 'claude-code':
      return {
        args: [
          '-p',
          '--output-format',
          'json',
          '--permission-mode',
          'plan',
          '--model',
          input.model,
          '--cwd',
          input.rootPath,
        ],
        promptViaStdin: true,
      };
    case 'gemini-cli':
      return {
        args: [
          '-p',
          input.prompt,
          '--output-format',
          'json',
          '-m',
          input.model,
        ],
        promptViaStdin: false,
      };
  }
}

async function readStructuredOutput(input: {
  agentId: AgentCliId;
  outputLastMessagePath: string | undefined;
  stdoutBuffer: string;
}): Promise<Result<string>> {
  if (input.agentId === 'codex') {
    if (!input.outputLastMessagePath) {
      return err(
        createProjectError('PROJECT_ANALYSIS_FAILED', 'Codex 최종 출력 경로가 비어 있습니다.'),
      );
    }

    try {
      return ok(await readFile(input.outputLastMessagePath, 'utf8'));
    } catch (error) {
      return err(
        createProjectError(
          'PROJECT_ANALYSIS_FAILED',
          'Codex 최종 출력을 읽지 못했습니다.',
          error instanceof Error ? error.message : undefined,
        ),
      );
    }
  }

  const normalizedStdout = input.stdoutBuffer.trim();
  if (normalizedStdout.length === 0) {
    return err(
      createProjectError(resolveTaskErrorCode(input.agentId, '응답 생성'), '에이전트 응답이 비어 있습니다.'),
    );
  }

  return ok(extractEnvelopePayload(normalizedStdout));
}

function extractEnvelopePayload(rawOutput: string): string {
  try {
    const parsed = JSON.parse(rawOutput) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return rawOutput;
    }

    const candidate = parsed as Record<string, unknown>;
    const textPayload = [candidate.result, candidate.response, candidate.text].find(
      (value): value is string => typeof value === 'string',
    );

    return textPayload ? unwrapJsonCodeFence(textPayload) : rawOutput;
  } catch {
    return unwrapJsonCodeFence(rawOutput);
  }
}

function unwrapJsonCodeFence(value: string): string {
  const trimmed = value.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return fencedMatch?.[1]?.trim() ?? trimmed;
}

function appendOutputTail(current: string, nextChunk: string): string {
  return `${current}${nextChunk}`.slice(-4_000);
}

function buildFailureDetails(input: {
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

function createCancelledTaskResult(taskLabel: string): Result<never> {
  if (taskLabel === '자동 태그 생성') {
    return err(
      createProjectError(
        'PROJECT_REFERENCE_TAG_GENERATION_CANCELLED',
        '자동 태그 생성 요청을 취소했습니다.',
      ),
    );
  }

  return err(
    createProjectError(
      taskLabel === '명세 채팅 응답' ? 'PROJECT_SESSION_MESSAGE_CANCELLED' : 'PROJECT_ANALYSIS_CANCELLED',
      `${taskLabel} 요청을 취소했습니다.`,
    ),
  );
}

function resolveTaskErrorCode(
  agentId: AgentCliId,
  taskLabel: string,
): 'PROJECT_ANALYSIS_FAILED' | 'PROJECT_REFERENCE_TAG_GENERATION_FAILED' | 'PROJECT_SPEC_CHAT_FAILED' {
  if (taskLabel === '자동 태그 생성') {
    return 'PROJECT_REFERENCE_TAG_GENERATION_FAILED';
  }

  if (taskLabel === '명세 채팅 응답') {
    return 'PROJECT_SPEC_CHAT_FAILED';
  }

  return agentId === 'gemini-cli' ? 'PROJECT_SPEC_CHAT_FAILED' : 'PROJECT_ANALYSIS_FAILED';
}
