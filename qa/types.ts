export type QaDomain =
  | 'auth'
  | 'teams'
  | 'matches'
  | 'tournaments'
  | 'payments'
  | 'chat'
  | 'venues'
  | 'notifications'
  | 'permissions'
  | 'cross_domain'
  | 'integrity'
  | 'stress'
  | 'recovery';

export type QaStepStatus = 'passed' | 'failed' | 'warning' | 'skipped';

export interface QaStepResult {
  id: string;
  name: string;
  status: QaStepStatus;
  durationMs: number;
  details?: string;
  error?: string;
  metrics?: Record<string, number>;
}

export interface QaScenarioResult {
  id: string;
  domain: QaDomain;
  name: string;
  status: QaStepStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  steps: QaStepResult[];
}

export interface QaRunSummary {
  totalScenarios: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  durationMs: number;
}

export interface QaRunResult {
  runId: string;
  startedAt: string;
  finishedAt: string;
  mode: 'all' | 'domain' | 'scenario';
  scenarios: QaScenarioResult[];
  summary: QaRunSummary;
}

export interface QaExecutionContext {
  runId: string;
  env: {
    testModeEnabled: boolean;
    supabaseUrlConfigured: boolean;
  };
  testDataPrefix: string;
  emit: (event: QaRuntimeEvent) => void;
}

export type QaRuntimeEvent =
  | {
      type: 'run_started';
      runId: string;
      at: string;
      mode: 'all' | 'domain' | 'scenario';
      totalScenarios: number;
    }
  | {
      type: 'scenario_started';
      runId: string;
      scenarioId: string;
      scenarioName: string;
      domain: QaDomain;
      at: string;
    }
  | {
      type: 'step_started';
      runId: string;
      scenarioId: string;
      stepName: string;
      at: string;
    }
  | {
      type: 'step_finished';
      runId: string;
      scenarioId: string;
      stepId: string;
      stepName: string;
      status: QaStepStatus;
      durationMs: number;
      at: string;
      details?: string;
      error?: string;
    }
  | {
      type: 'scenario_finished';
      runId: string;
      scenarioId: string;
      scenarioName: string;
      domain: QaDomain;
      status: QaStepStatus;
      durationMs: number;
      at: string;
    }
  | {
      type: 'run_finished';
      runId: string;
      at: string;
      summary: QaRunSummary;
    };

export interface QaRunOptions {
  onEvent?: (event: QaRuntimeEvent) => void;
}

export interface QaScenarioDefinition {
  id: string;
  domain: QaDomain;
  name: string;
  run: (ctx: QaExecutionContext) => Promise<QaStepResult[]>;
}
