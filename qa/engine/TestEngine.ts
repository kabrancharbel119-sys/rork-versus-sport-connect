import { ScenarioRunner } from '@/qa/runners/ScenarioRunner';
import { buildCoreScenarios } from '@/qa/scenarios/coreScenarios';
import { assertQaTestMode, isQaTestModeEnabled } from '@/qa/engine/QaGuards';
import { testLogStore } from '@/qa/logs/TestLogStore';
import { CleanupManager } from '@/qa/cleanup/CleanupManager';
import type { QaDomain, QaExecutionContext, QaRunOptions, QaRunResult, QaRuntimeEvent, QaScenarioDefinition, QaStepStatus } from '@/qa/types';

const uuid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const summarize = (statuses: QaStepStatus[]) => {
  const totalScenarios = statuses.length;
  const passed = statuses.filter((s) => s === 'passed').length;
  const failed = statuses.filter((s) => s === 'failed').length;
  const warnings = statuses.filter((s) => s === 'warning').length;
  const skipped = statuses.filter((s) => s === 'skipped').length;
  return { totalScenarios, passed, failed, warnings, skipped };
};

export class TestEngine {
  private readonly scenarioRunner = new ScenarioRunner();

  private emit(event: QaRuntimeEvent, options?: QaRunOptions) {
    if (!options?.onEvent) return;
    options.onEvent(event);
  }

  private getContext(runId: string, options?: QaRunOptions): QaExecutionContext {
    return {
      runId,
      env: {
        testModeEnabled: isQaTestModeEnabled(),
        supabaseUrlConfigured: !!process.env.EXPO_PUBLIC_SUPABASE_URL,
      },
      testDataPrefix: runId,
      emit: (event) => this.emit(event, options),
    };
  }

  private getScenarios(): QaScenarioDefinition[] {
    return buildCoreScenarios();
  }

  async runAll(options?: QaRunOptions): Promise<QaRunResult> {
    return this.execute('all', this.getScenarios(), options);
  }

  async runByDomain(domain: QaDomain, options?: QaRunOptions): Promise<QaRunResult> {
    const filtered = this.getScenarios().filter((s) => s.domain === domain);
    return this.execute('domain', filtered, options);
  }

  async runScenario(scenarioId: string, options?: QaRunOptions): Promise<QaRunResult> {
    const filtered = this.getScenarios().filter((s) => s.id === scenarioId);
    return this.execute('scenario', filtered, options);
  }

  private async execute(mode: 'all' | 'domain' | 'scenario', scenarios: QaScenarioDefinition[], options?: QaRunOptions): Promise<QaRunResult> {
    assertQaTestMode();

    const runId = `qa-${uuid()}`;
    const context = this.getContext(runId, options);
    const startedAt = new Date();

    this.emit(
      {
        type: 'run_started',
        runId,
        at: startedAt.toISOString(),
        mode,
        totalScenarios: scenarios.length,
      },
      options,
    );

    const scenarioResults = [];
    for (const scenario of scenarios) {
      const result = await this.scenarioRunner.runScenario(scenario, context);
      scenarioResults.push(result);
    }

    const cleanup = new CleanupManager(context.testDataPrefix);
    const cleanupStep = await cleanup.cleanupSyntheticData();
    if (cleanupStep.status !== 'passed') {
      scenarioResults.push({
        id: 'cleanup-summary',
        domain: 'recovery' as const,
        name: 'Cleanup summary',
        status: cleanupStep.status,
        startedAt: new Date(startedAt.getTime()).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: cleanupStep.durationMs,
        steps: [cleanupStep],
      });
    }

    const finishedAt = new Date();
    const baseSummary = summarize(scenarioResults.map((s) => s.status));

    const run: QaRunResult = {
      runId,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      mode,
      scenarios: scenarioResults,
      summary: {
        ...baseSummary,
        durationMs: Math.max(1, finishedAt.getTime() - startedAt.getTime()),
      },
    };

    this.emit(
      {
        type: 'run_finished',
        runId,
        at: finishedAt.toISOString(),
        summary: run.summary,
      },
      options,
    );

    await testLogStore.writeRun(run);
    return run;
  }
}

export const testEngine = new TestEngine();
