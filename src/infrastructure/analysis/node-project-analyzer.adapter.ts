import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { AgentCliSettingsPort } from '@/application/app-settings/app-settings.ports';
import type {
  ProjectAnalysisRunStatusPort,
  ProjectAnalyzerPort,
} from '@/application/project/project.ports';
import {
  describeUnsupportedAgentCliFeature,
  isAgentCliFeatureSupported,
} from '@/domain/app-settings/agent-cli-connection-model';
import type { ProjectAnalysisDraft } from '@/domain/project/project-analysis-model';
import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

import {
  createProjectAnalysisOutputSchema,
  createProjectAnalysisPrompt,
} from '@/infrastructure/analysis/project-analysis-codex-prompt';
import { parseProjectAnalysisCodexResult } from '@/infrastructure/analysis/project-analysis-codex-result';
import {
  createLocalProjectAnalysisDraft,
  mergeProjectAnalysisWithLocalDraft,
} from '@/infrastructure/analysis/project-analysis-local-draft';
import { executeCliAgentStructuredTask } from '@/infrastructure/cli-agents/execute-cli-agent-structured-task';
import { createStructuredOutputPrompt } from '@/infrastructure/cli-agents/create-structured-output-prompt';
import { resolveCliAgentRuntimeSettings } from '@/infrastructure/cli-agents/resolve-cli-agent-runtime-settings';
import { executeCodexProjectAnalysis } from '@/infrastructure/analysis/node-project-analyzer-codex-execution';

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
        stageMessage: input.mode === 'references' ? '참조 분석 준비 중' : '전체 분석 준비 중',
        progressMessage:
          input.mode === 'references'
            ? '저장소 구조와 참조 관계를 스캔할 준비를 하고 있습니다.'
            : '저장소 구조와 분석 문서를 준비하고 있습니다.',
        startedAt,
        stepIndex: 1,
        stepTotal: input.mode === 'references' ? 3 : 4,
      });
      if (!beginRunResult.ok) {
        return beginRunResult;
      }
      const runControl = beginRunResult.value;

      dependencies.analysisRunStatusStore.updateAnalysisRunStatus({
        rootPath,
        stageMessage: '로컬 정적 참조 분석 중',
        progressMessage: 'TS/JS/Kotlin/PHP/Java 파일의 정적 참조를 스캔하고 있습니다.',
        stepIndex: 1,
      });

      let localDraft: ProjectAnalysisDraft;
      try {
        localDraft = await createLocalProjectAnalysisDraft({
          projectName: input.projectName,
          rootPath,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : '로컬 정적 분석 중 알 수 없는 오류가 발생했습니다.';

        markAnalysisRunAsFailed({
          analysisRunStatusStore: dependencies.analysisRunStatusStore,
          error: message,
          rootPath,
          stageMessage: '로컬 정적 분석 실패',
          stepIndex: 1,
        });

        return err(
          createProjectError(
            'PROJECT_ANALYSIS_FAILED',
            '로컬 정적 분석으로 참조 데이터를 만들지 못했습니다.',
            message,
          ),
        );
      }

      dependencies.analysisRunStatusStore.updateAnalysisRunStatus({
        rootPath,
        stageMessage: '로컬 분석 결과 정리 중',
        progressMessage: '정적 참조 결과를 저장 가능한 초안으로 정리하고 있습니다.',
        stepIndex: 2,
      });

      if (input.mode === 'references') {
        return ok(localDraft);
      }

      if (!isAgentCliFeatureSupported(input.agentId, 'project-analysis')) {
        return err(
          createProjectError(
            'PROJECT_ANALYSIS_FAILED',
            describeUnsupportedAgentCliFeature(input.agentId, 'project-analysis'),
          ),
        );
      }

      const runtimeSettingsResult = await resolveCliAgentRuntimeSettings({
        agentCliSettingsStore: dependencies.agentCliSettingsStore,
        agentId: input.agentId,
      });
      if (runControl.signal.aborted) {
        return createCancelledAnalysisResult({
          analysisRunStatusStore: dependencies.analysisRunStatusStore,
          rootPath,
          stageMessage: '분석 취소됨',
        });
      }
      if (!runtimeSettingsResult.ok) {
        return createLocalAnalysisFallbackResult({
          analysis: localDraft,
          analysisRunStatusStore: dependencies.analysisRunStatusStore,
          progressMessage: `${runtimeSettingsResult.error.message} 로컬 정적 분석 결과만 사용합니다.`,
          rootPath,
          stageMessage: '로컬 정적 분석 완료',
        });
      }

      const agentDisplayName = runtimeSettingsResult.value.definition.displayName;
      const tempDirectoryPath = await mkdtemp(
        join(tmpdir(), `sdd-${runtimeSettingsResult.value.definition.agentId}-analysis-`),
      );
      const outputSchemaPath = join(tempDirectoryPath, 'project-analysis.schema.json');
      const outputLastMessagePath = join(tempDirectoryPath, 'project-analysis.last-message.json');
      const outputSchema = createProjectAnalysisOutputSchema();

      try {
        await writeFile(outputSchemaPath, JSON.stringify(outputSchema, null, 2), 'utf8');
        if (runControl.signal.aborted) {
          return createCancelledAnalysisResult({
            analysisRunStatusStore: dependencies.analysisRunStatusStore,
            rootPath,
            stageMessage: '분석 취소됨',
          });
        }

        let rawOutput: string;
        if (input.agentId === 'codex') {
          const executeResult = await executeCodexProjectAnalysis({
            analysisRunStatusStore: dependencies.analysisRunStatusStore,
            executablePath: runtimeSettingsResult.value.executablePath,
            model: runtimeSettingsResult.value.connectionSettings.model,
            modelReasoningEffort:
              runtimeSettingsResult.value.connectionSettings.modelReasoningEffort,
            outputLastMessagePath,
            outputSchemaPath,
            prompt: createProjectAnalysisPrompt({
              projectName: input.projectName,
            }),
            rootPath,
            signal: runControl.signal,
          });
          if (!executeResult.ok) {
            if (executeResult.error.code === 'PROJECT_ANALYSIS_CANCELLED') {
              return executeResult;
            }

            return createLocalAnalysisFallbackResult({
              analysis: localDraft,
              analysisRunStatusStore: dependencies.analysisRunStatusStore,
              progressMessage: `${agentDisplayName} 보강 분석에 실패해 로컬 정적 분석 결과만 사용합니다.`,
              rootPath,
              stageMessage: `${agentDisplayName} 보강 없이 로컬 분석 사용`,
            });
          }

          rawOutput = await readFile(outputLastMessagePath, 'utf8');
        } else {
          const executeResult = await executeCliAgentStructuredTask({
            agentId: input.agentId,
            displayName: agentDisplayName,
            executablePath: runtimeSettingsResult.value.executablePath,
            idleTimeoutMs: 20 * 60 * 1000,
            maxDurationMs: 60 * 60 * 1000,
            model: runtimeSettingsResult.value.connectionSettings.model,
            modelReasoningEffort:
              runtimeSettingsResult.value.connectionSettings.modelReasoningEffort,
            prompt: createStructuredOutputPrompt({
              basePrompt: createProjectAnalysisPrompt({
                projectName: input.projectName,
              }),
              outputSchema,
            }),
            rootPath,
            signal: runControl.signal,
            taskLabel: '분석',
          });
          if (!executeResult.ok) {
            if (executeResult.error.code === 'PROJECT_ANALYSIS_CANCELLED') {
              return executeResult;
            }

            return createLocalAnalysisFallbackResult({
              analysis: localDraft,
              analysisRunStatusStore: dependencies.analysisRunStatusStore,
              progressMessage: `${agentDisplayName} 보강 분석에 실패해 로컬 정적 분석 결과만 사용합니다.`,
              rootPath,
              stageMessage: `${agentDisplayName} 보강 없이 로컬 분석 사용`,
            });
          }

          rawOutput = executeResult.value;
        }

        dependencies.analysisRunStatusStore.updateAnalysisRunStatus({
          rootPath,
          stageMessage: `${agentDisplayName} 응답 정리 중`,
          progressMessage: `${agentDisplayName} 서술 결과와 로컬 참조 데이터를 합치고 있습니다.`,
          stepIndex: 3,
        });

        const parsedResult = parseProjectAnalysisCodexResult(rawOutput);
        if (!parsedResult.ok) {
          return createLocalAnalysisFallbackResult({
            analysis: localDraft,
            analysisRunStatusStore: dependencies.analysisRunStatusStore,
            progressMessage: `${agentDisplayName} 응답 검증에 실패해 로컬 정적 분석 결과만 사용합니다.`,
            rootPath,
            stageMessage: `${agentDisplayName} 응답 대신 로컬 분석 사용`,
          });
        }

        return ok(
          mergeProjectAnalysisWithLocalDraft({
            codexDraft: parsedResult.value,
            localDraft,
          }),
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : '프로젝트 분석 중 알 수 없는 오류가 발생했습니다.';

        return createLocalAnalysisFallbackResult({
          analysis: localDraft,
          analysisRunStatusStore: dependencies.analysisRunStatusStore,
          progressMessage: `${agentDisplayName} 보강 분석 중 오류가 발생해 로컬 정적 분석 결과만 사용합니다. (${message})`,
          rootPath,
          stageMessage: `${agentDisplayName} 오류로 로컬 분석 사용`,
        });
      } finally {
        await rm(tempDirectoryPath, { recursive: true, force: true });
      }
    },
  };
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

  return err(createProjectError('PROJECT_ANALYSIS_CANCELLED', '분석이 취소되었습니다.'));
}

function createLocalAnalysisFallbackResult(input: {
  analysis: ProjectAnalysisDraft;
  analysisRunStatusStore: ProjectAnalysisRunStatusPort;
  progressMessage: string;
  rootPath: string;
  stageMessage: string;
}): Result<ProjectAnalysisDraft> {
  input.analysisRunStatusStore.updateAnalysisRunStatus({
    rootPath: input.rootPath,
    status: 'running',
    stageMessage: input.stageMessage,
    progressMessage: input.progressMessage,
    stepIndex: 3,
    completedAt: null,
    lastError: null,
  });

  return ok(input.analysis);
}
