import { supabase } from '@/lib/supabase';
import type { QaRunResult, QaScenarioResult, QaStepResult } from '@/qa/types';

const tableName = 'qa_test_logs';

const sanitizeError = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 4000);
  if (value instanceof Error) return value.message.slice(0, 4000);
  return JSON.stringify(value).slice(0, 4000);
};

export const testLogStore = {
  async writeScenario(runId: string, scenario: QaScenarioResult): Promise<void> {
    const payload = {
      run_id: runId,
      scenario_id: scenario.id,
      scenario_name: scenario.name,
      domain: scenario.domain,
      status: scenario.status,
      started_at: scenario.startedAt,
      finished_at: scenario.finishedAt,
      duration_ms: scenario.durationMs,
      error_trace: sanitizeError(scenario.steps.find((s) => s.status === 'failed')?.error),
      details: {
        steps: scenario.steps,
      },
    };

    const { error } = await (supabase.from(tableName).insert(payload) as any);
    if (error && error.code !== '42P01') {
      console.warn('[QA] Failed to write scenario log:', error.message);
    }
  },

  async writeRun(run: QaRunResult): Promise<void> {
    for (const scenario of run.scenarios) {
      await this.writeScenario(run.runId, scenario);
    }
  },

  async getRecent(limit = 100): Promise<any[]> {
    const { data, error } = await (supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit) as any);

    if (error) {
      if (error.code === '42P01') return [];
      throw error;
    }

    return data || [];
  },

  async clearAll(): Promise<void> {
    const { error } = await (supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000') as any);
    if (error && error.code !== '42P01') {
      throw error;
    }
  },

  summarizeStep(step: QaStepResult): string {
    return `${step.status.toUpperCase()} ${step.name} (${step.durationMs}ms)`;
  },
};
