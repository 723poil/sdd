import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { AgentCliSettingsPort } from '@/application/app-settings/app-settings.ports';
import type {
  ProjectAnalysisRunStatusPort,
  ProjectAnalyzerPort,
} from '@/application/project/project.ports';
import {
  createDefaultAgentCliConnectionSettings,
  findAgentCliConnectionDefinition,
  type AgentCliConnectionSettings,
} from '@/domain/app-settings/agent-cli-connection-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, type Result } from '@/shared/contracts/result';

import {
  createProjectAnalysisPrompt,
  createProjectAnalysisOutputSchema,
} from '@/infrastructure/analysis/project-analysis-codex-prompt';
import { parseProjectAnalysisCodexResult } from '@/infrastructure/analysis/project-analysis-codex-result';

const CODEX_ANALYSIS_IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const CODEX_ANALYSIS_MAX_DURATION_MS = 60 * 60 * 1000;
const OUTPUT_TAIL_MAX_LENGTH = 4_000;

export function createNodeProjectAnalyzerAdapter(dependencies: {
  agentCliSettingsStore: AgentCliSettingsPort;
  analysisRunStatusStore: ProjectAnalysisRunStatusPort;
}): ProjectAnalyzerPort {
  return {
    async analyzeProject(input) {
      const rootPath = resolve(input.rootPath);
      const startedAt = new Date().toISOString();
      const beginRunResult = dependencies.analysisRunStatusStore.beginAnalysisRun({
        rootPath,
        stageMessage: 'Codex CLI 실행 준비 중',
        progressMessage: '분석 실행 환경을 확인하고 있습니다.',
        startedAt,
        stepIndex: 1,
        stepTotal: 4,
      });
      if (!beginRunResult.ok) {
        return beginRunResult;
      }
      const runControl = beginRunResult.value;

      const codexRuntimeSettingsResult = await resolveCodexRuntimeSettings({
        agentCliSettingsStore: dependencies.agentCliSettingsStore,
      });
      if (runControl.signal.aborted) {
        return createCancelledAnalysisResult({
          analysisRunStatusStore: dependencies.analysisRunStatusStore,
          rootPath,
          stageMessage: '에이전트 분석 취소됨',
        });
      }
      if (!codexRuntimeSettingsResult.ok) {
        markAnalysisRunAsFailed({
          analysisRunStatusStore: dependencies.analysisRunStatusStore,
          error: codexRuntimeSettingsResult.error.message,
          rootPath,
          stageMessage: 'Codex CLI 설정 확인 실패',
          stepIndex: 1,
        });
        return codexRuntimeSettingsResult;
      }

      const tempDirectoryPath = await mkdtemp(join(tmpdir(), 'sdd-codex-analysis-'));
      const outputSchemaPath = join(tempDirectoryPath, 'project-analysis.schema.json');
      const outputLastMessagePath = join(tempDirectoryPath, 'project-analysis.last-message.json');

      try {
        await writeFile(
          outputSchemaPath,
          JSON.stringify(createProjectAnalysisOutputSchema(), null, 2),
          'utf8',
        );
        if (runControl.signal.aborted) {
          return createCancelledAnalysisResult({
            analysisRunStatusStore: dependencies.analysisRunStatusStore,
            rootPath,
            stageMessage: '에이전트 분석 취소됨',
          });
        }

        const executeResult = await executeCodexProjectAnalysis({
          analysisRunStatusStore: dependencies.analysisRunStatusStore,
          executablePath: codexRuntimeSettingsResult.value.executablePath,
          model: codexRuntimeSettingsResult.value.connectionSettings.model,
          modelReasoningEffort:
            codexRuntimeSettingsResult.value.connectionSettings.modelReasoningEffort,
          outputLastMessagePath,
          outputSchemaPath,
          prompt: createProjectAnalysisPrompt({
            projectName: input.projectName,
          }),
          rootPath,
          signal: runControl.signal,
        });
        if (!executeResult.ok) {
          return executeResult;
        }

        dependencies.analysisRunStatusStore.updateAnalysisRunStatus({
          rootPath,
          stageMessage: 'Codex 응답 정리 중',
          progressMessage: '구조화 결과를 읽고 검증하고 있습니다.',
          stepIndex: 3,
        });

        const rawOutput = await readFile(outputLastMessagePath, 'utf8');
        const parsedResult = parseProjectAnalysisCodexResult(rawOutput);
        if (!parsedResult.ok) {
          markAnalysisRunAsFailed({
            analysisRunStatusStore: dependencies.analysisRunStatusStore,
            error: parsedResult.error.message,
            rootPath,
            stageMessage: 'Codex 응답 검증 실패',
            stepIndex: 3,
          });
        }

        return parsedResult;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : '프로젝트 분석 중 알 수 없는 오류가 발생했습니다.';

        markAnalysisRunAsFailed({
          analysisRunStatusStore: dependencies.analysisRunStatusStore,
          error: message,
          rootPath,
          stageMessage: '에이전트 분석 실패',
          stepIndex: 3,
        });

        return err(
          createProjectError(
            'PROJECT_ANALYSIS_FAILED',
            '연결된 에이전트로 프로젝트 분석에 실패했습니다.',
            message,
          ),
        );
      } finally {
        await rm(tempDirectoryPath, { recursive: true, force: true });
      }
    },
  };
}

async function resolveCodexRuntimeSettings(input: {
  agentCliSettingsStore: AgentCliSettingsPort;
}): Promise<
  Result<{
    connectionSettings: AgentCliConnectionSettings;
    executablePath: string;
  }>
> {
  const definition = findAgentCliConnectionDefinition('codex');
  if (!definition) {
    return err(createProjectError('AGENT_CLI_NOT_CONFIGURED', 'Codex CLI 정의를 찾지 못했습니다.'));
  }

  const connectionSettingsResult = await input.agentCliSettingsStore.listAgentCliConnections();
  if (!connectionSettingsResult.ok) {
    return err(
      createProjectError(
        'AGENT_CLI_NOT_CONFIGURED',
        '앱 전역 CLI 설정을 읽지 못했습니다.',
        connectionSettingsResult.error.message,
      ),
    );
  }

  const codexSettings =
    connectionSettingsResult.value.find((connection) => connection.agentId === 'codex') ??
    createDefaultAgentCliConnectionSettings('codex');

  if (codexSettings.commandMode === 'custom') {
    if (!codexSettings.executablePath) {
      return err(
        createProjectError(
          'AGENT_CLI_NOT_CONFIGURED',
          '직접 지정된 Codex 실행 경로가 비어 있습니다. 앱 설정에서 Codex CLI를 다시 확인해 주세요.',
        ),
      );
    }

    return {
      ok: true,
      value: {
        connectionSettings: codexSettings,
        executablePath: codexSettings.executablePath,
      },
    };
  }

  return {
    ok: true,
    value: {
      connectionSettings: codexSettings,
      executablePath: definition.defaultExecutableName,
    },
  };
}

async function executeCodexProjectAnalysis(input: {
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
          stageMessage: '에이전트 분석 취소됨',
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
      stageMessage: 'Codex 에이전트 분석 실행 중',
      progressMessage: '저장소 구조를 읽고 있습니다.',
      stepIndex: 2,
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
      const stderrMessage = text.trim();
      if (stderrMessage.length > 0) {
        input.analysisRunStatusStore.updateAnalysisRunStatus({
          rootPath: input.rootPath,
          progressMessage: truncateProgressMessage(stderrMessage),
          stepIndex: 2,
        });
      }
    });
    childProcess.on('error', (error) => {
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }
      clearTimeout(maxDurationTimeout);

      const errorCode =
        error instanceof Error && 'code' in error ? (error as NodeJS.ErrnoException).code : null;
      if (errorCode === 'ENOENT' || errorCode === 'EACCES') {
        markAnalysisRunAsFailed({
          analysisRunStatusStore: input.analysisRunStatusStore,
          error: input.executablePath,
          rootPath: input.rootPath,
          stageMessage: 'Codex CLI 실행 파일을 찾지 못했습니다.',
          stepIndex: 1,
        });
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

      markAnalysisRunAsFailed({
        analysisRunStatusStore: input.analysisRunStatusStore,
        error: error instanceof Error ? error.message : 'Codex CLI 실행 오류',
        rootPath: input.rootPath,
        stageMessage: 'Codex CLI 실행 오류',
        stepIndex: 2,
      });

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
            stageMessage: '에이전트 분석 취소됨',
          }),
        );
        return;
      }

      if (didIdleTimeout) {
        markAnalysisRunAsFailed({
          analysisRunStatusStore: input.analysisRunStatusStore,
          error: '진행 이벤트 없음',
          rootPath: input.rootPath,
          stageMessage: '에이전트 분석 응답 대기 시간 초과',
          stepIndex: 2,
        });
        resolveOnce(
          err(
            createProjectError(
              'PROJECT_ANALYSIS_FAILED',
              '에이전트 분석이 오랫동안 진행 이벤트를 보내지 않아 중단되었습니다.',
            ),
          ),
        );
        return;
      }

      if (didMaxDurationTimeout) {
        markAnalysisRunAsFailed({
          analysisRunStatusStore: input.analysisRunStatusStore,
          error: '최대 실행 시간 초과',
          rootPath: input.rootPath,
          stageMessage: '에이전트 분석 최대 실행 시간 초과',
          stepIndex: 2,
        });
        resolveOnce(
          err(
            createProjectError(
              'PROJECT_ANALYSIS_FAILED',
              '에이전트 분석이 최대 실행 시간을 넘어 중단되었습니다.',
            ),
          ),
        );
        return;
      }

      if (code !== 0) {
        markAnalysisRunAsFailed({
          analysisRunStatusStore: input.analysisRunStatusStore,
          error: buildCodexFailureDetails({
            code,
            stderrTail,
            stdoutTail,
          }),
          rootPath: input.rootPath,
          stageMessage: 'Codex CLI 비정상 종료',
          stepIndex: 2,
        });
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

function markAnalysisRunAsFailed(input: {
  analysisRunStatusStore: ProjectAnalysisRunStatusPort;
  error: string;
  rootPath: string;
  stageMessage: string;
  stepIndex: number;
}): void {
  input.analysisRunStatusStore.updateAnalysisRunStatus({
    rootPath: input.rootPath,
    status: 'failed',
    stageMessage: input.stageMessage,
    progressMessage: null,
    stepIndex: input.stepIndex,
    completedAt: new Date().toISOString(),
    lastError: input.error,
  });
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

  return err(
    createProjectError('PROJECT_ANALYSIS_CANCELLED', '에이전트 분석이 취소되었습니다.'),
  );
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
      stageMessage: 'Codex 에이전트 분석 실행 중',
      progressMessage,
      stepIndex: 2,
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
      return truncateProgressMessage(directMessage);
    }

    if (candidate.delta && typeof candidate.delta === 'object') {
      const delta = candidate.delta as Record<string, unknown>;
      const deltaMessage = findFirstHumanReadableString(
        delta.message,
        delta.summary,
        delta.text,
      );
      if (deltaMessage) {
        return truncateProgressMessage(deltaMessage);
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
    return truncateProgressMessage(trimmedLine);
  }
}

function findFirstHumanReadableString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const trimmedValue = value.trim();
    if (trimmedValue.length === 0 || isMachineProgressToken(trimmedValue)) {
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
