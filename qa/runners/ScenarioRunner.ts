import type { QaExecutionContext, QaScenarioDefinition, QaScenarioResult, QaStepStatus } from '@/qa/types';

const aggregateScenarioStatus = (stepsStatus: QaStepStatus[]): QaStepStatus => {
  if (stepsStatus.includes('failed')) return 'failed';
  if (stepsStatus.includes('warning')) return 'warning';
  if (stepsStatus.every((s) => s === 'skipped')) return 'skipped';
  return 'passed';
};

export class ScenarioRunner {
  async runScenario(def: QaScenarioDefinition, ctx: QaExecutionContext): Promise<QaScenarioResult> {
    const startedAt = new Date();
    ctx.emit({
      type: 'scenario_started',
      runId: ctx.runId,
      scenarioId: def.id,
      scenarioName: def.name,
      domain: def.domain,
      at: startedAt.toISOString(),
    });
    const steps = await def.run(ctx);
    const finishedAt = new Date();

    const status = aggregateScenarioStatus(steps.map((s) => s.status));
    ctx.emit({
      type: 'scenario_finished',
      runId: ctx.runId,
      scenarioId: def.id,
      scenarioName: def.name,
      domain: def.domain,
      status,
      durationMs: Math.max(1, finishedAt.getTime() - startedAt.getTime()),
      at: finishedAt.toISOString(),
    });

    return {
      id: def.id,
      domain: def.domain,
      name: def.name,
      status,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: Math.max(1, finishedAt.getTime() - startedAt.getTime()),
      steps,
    };
  }
}
