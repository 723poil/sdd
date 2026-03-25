import { spawn } from 'node:child_process';

import type { ProjectAnalysisRunStatusPort } from '@/application/project/project.ports';
import type { AgentCliConnectionSettings } from '@/domain/app-settings/agent-cli-connection-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, type Result } from '@/shared/contracts/result';

const CODEX_ANALYSIS_IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const CODEX_ANALYSIS_MAX_DURATION_MS = 60 * 60 * 1000;
const OUTPUT_TAIL_MAX_LENGTH = 4_000;

export async function executeCodexProjectAnalysis(input: {
  analysisRunStatusStore: ProjectAnalysisRunStatusPort;
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
      resolvePromise(
        createCancelledAnalysisResult({
          analysisRunStatusStore: input.analysisRunStatusStore,
          rootPath: input.rootPath,
          stageMessage: '분석 취소됨',
        }),
      );
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

    let stdoutTail = '';
    let stdoutBuffer = '';
    let stderrTail = '';
    let didIdleTimeout = false;
    let didMaxDurationTimeout = false;
    let didAbort = false;
    let idleTimeout: NodeJS.Timeout | null = null;
    let didResolve = false;

    input.analysisRunStatusStore.updateAnalysisRunStatus({
      rootPath: input.rootPath,
      stageMessage: 'Codex 보강 분석 실행 중',
      progressMessage: '구조 설명과 문서 요약을 보강하고 있습니다.',
      stepIndex: 3,
    });

    const refreshIdleTimeout = () => {
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }

      idleTimeout = setTimeout(() => {
        didIdleTimeout = true;
        childProcess.kill('SIGTERM');
      }, CODEX_ANALYSIS_IDLE_TIMEOUT_MS);
    };

    refreshIdleTimeout();

    const maxDurationTimeout = setTimeout(() => {
      didMaxDurationTimeout = true;
      childProcess.kill('SIGTERM');
    }, CODEX_ANALYSIS_MAX_DURATION_MS);

    const resolveOnce = (result: Result<void>) => {
      if (didResolve) {
        return;
      }

      didResolve = true;
      input.signal.removeEventListener('abort', handleAbort);
      resolvePromise(result);
    };

    const handleAbort = () => {
      didAbort = true;
      childProcess.kill('SIGTERM');
    };

    input.signal.addEventListener('abort', handleAbort, { once: true });

    childProcess.stdout.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString();
      stdoutTail = appendOutputTail(stdoutTail, text);
      refreshIdleTimeout();
      stdoutBuffer = processCodexProgressLines({
        analysisRunStatusStore: input.analysisRunStatusStore,
        currentBuffer: stdoutBuffer,
        rootPath: input.rootPath,
        text,
      });
    });

    childProcess.stderr.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString();
      stderrTail = appendOutputTail(stderrTail, text);
      refreshIdleTimeout();
    });

    childProcess.on('error', (error) => {
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }
      clearTimeout(maxDurationTimeout);

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
            'PROJECT_ANALYSIS_FAILED',
            'Codex CLI 실행 중 오류가 발생했습니다.',
            error instanceof Error ? error.message : undefined,
          ),
        ),
      );
    });

    childProcess.on('close', (code) => {
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }
      clearTimeout(maxDurationTimeout);

      if (didAbort || input.signal.aborted) {
        resolveOnce(
          createCancelledAnalysisResult({
            analysisRunStatusStore: input.analysisRunStatusStore,
            rootPath: input.rootPath,
            stageMessage: '분석 취소됨',
          }),
        );
        return;
      }

      if (didIdleTimeout) {
        resolveOnce(
          err(
            createProjectError(
              'PROJECT_ANALYSIS_FAILED',
              '분석이 오랫동안 진행 이벤트를 보내지 않아 중단되었습니다.',
            ),
          ),
        );
        return;
      }

      if (didMaxDurationTimeout) {
        resolveOnce(
          err(
            createProjectError(
              'PROJECT_ANALYSIS_FAILED',
              '분석이 최대 실행 시간을 넘어 중단되었습니다.',
            ),
          ),
        );
        return;
      }

      if (code !== 0) {
        resolveOnce(
          err(
            createProjectError(
              'PROJECT_ANALYSIS_FAILED',
              'Codex CLI가 분석 중 비정상 종료되었습니다.',
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

function createCancelledAnalysisResult(input: {
  analysisRunStatusStore: ProjectAnalysisRunStatusPort;
  rootPath: string;
  stageMessage: string;
}): Result<never> {
  input.analysisRunStatusStore.updateAnalysisRunStatus({
    rootPath: input.rootPath,
    status: 'cancelled',
    stageMessage: input.stageMessage,
    progressMessage: null,
    completedAt: new Date().toISOString(),
    lastError: null,
  });

  return err(createProjectError('PROJECT_ANALYSIS_CANCELLED', '분석이 취소되었습니다.'));
}

function processCodexProgressLines(input: {
  analysisRunStatusStore: ProjectAnalysisRunStatusPort;
  currentBuffer: string;
  rootPath: string;
  text: string;
}): string {
  const nextBuffer = `${input.currentBuffer}${input.text}`;
  const lines = nextBuffer.split('\n');
  const incompleteLine = lines.pop() ?? '';

  for (const line of lines) {
    const progressMessage = describeCodexProgressLine(line);
    if (!progressMessage) {
      continue;
    }

    input.analysisRunStatusStore.updateAnalysisRunStatus({
      rootPath: input.rootPath,
      stageMessage: 'Codex 보강 분석 실행 중',
      progressMessage,
      stepIndex: 3,
    });
  }

  return incompleteLine;
}

function describeCodexProgressLine(line: string): string | null {
  const trimmedLine = line.trim();
  if (trimmedLine.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmedLine) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return truncateProgressMessage(trimmedLine);
    }

    const candidate = parsed as Record<string, unknown>;
    const directMessage = findFirstHumanReadableString(
      candidate.message,
      candidate.summary,
      candidate.phase,
    );
    if (directMessage) {
      return sanitizeCodexProgressMessage(directMessage);
    }

    if (candidate.delta && typeof candidate.delta === 'object') {
      const delta = candidate.delta as Record<string, unknown>;
      const deltaMessage = findFirstHumanReadableString(delta.message, delta.summary, delta.text);
      if (deltaMessage) {
        return sanitizeCodexProgressMessage(deltaMessage);
      }
    }

    const statusMessage = describeCodexProgressToken(
      candidate.phase,
      candidate.status,
      candidate.event,
      candidate.type,
    );
    if (statusMessage) {
      return statusMessage;
    }

    return null;
  } catch {
    return sanitizeCodexProgressMessage(trimmedLine);
  }
}

function findFirstHumanReadableString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const trimmedValue = value.trim();
    if (
      trimmedValue.length === 0 ||
      isMachineProgressToken(trimmedValue) ||
      looksLikeInternalCodexDiagnostic(trimmedValue)
    ) {
      continue;
    }

    return trimmedValue;
  }

  return null;
}

function findFirstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function isMachineProgressToken(value: string): boolean {
  return /^[a-z0-9_.-]+$/.test(value) && value === value.toLowerCase();
}

function describeCodexProgressToken(...values: unknown[]): string | null {
  const token = findFirstNonEmptyString(...values);
  if (!token) {
    return null;
  }

  const normalizedToken = token.toLowerCase();
  if (normalizedToken.includes('completed')) {
    return '분석 단계를 정리하고 있습니다.';
  }

  if (normalizedToken.includes('created') || normalizedToken.includes('started')) {
    return '다음 분석 단계를 시작했습니다.';
  }

  if (normalizedToken.includes('failed') || normalizedToken.includes('error')) {
    return '분석 단계 처리 중 오류를 확인하고 있습니다.';
  }

  return null;
}

function truncateProgressMessage(value: string): string {
  return value.length > 240 ? `${value.slice(0, 237)}...` : value;
}

function sanitizeCodexProgressMessage(value: string): string | null {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0 || looksLikeInternalCodexDiagnostic(trimmedValue)) {
    return null;
  }

  return truncateProgressMessage(trimmedValue);
}

function looksLikeInternalCodexDiagnostic(value: string): boolean {
  const normalizedValue = value.toLowerCase();

  return (
    /\b(trace|debug|info|warn|warning|error)\b/.test(normalizedValue) &&
    (normalizedValue.includes('codex_core::') ||
      normalizedValue.includes('exec_command_failed') ||
      normalizedValue.includes("for '/bin/"))
  );
}
