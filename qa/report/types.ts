export type ReportSeverity = 'critical' | 'warning' | 'info' | 'passed';

export interface ReportCheck {
  id: string;
  category: ReportCategory;
  name: string;
  severity: ReportSeverity;
  passed: boolean;
  details: string;
  suggestion?: string;
  durationMs: number;
}

export type ReportCategory =
  | 'config'
  | 'security'
  | 'database'
  | 'schema'
  | 'rls'
  | 'storage'
  | 'auth'
  | 'data_integrity'
  | 'performance'
  | 'business_rules'
  | 'migrations'
  | 'app_config'
  | 'deep_code'
  | 'ux_flows'
  | 'realtime';

export interface ReportCategorySummary {
  category: ReportCategory;
  total: number;
  passed: number;
  warnings: number;
  critical: number;
  score: number; // 0-100
}

export interface ProductionReadinessResult {
  generatedAt: string;
  appVersion: string;
  supabaseProject: string;
  overallScore: number; // 0-100
  readyForProduction: boolean;
  blockers: ReportCheck[];     // critical non-passed
  warnings: ReportCheck[];     // warning non-passed
  passed: ReportCheck[];
  categories: ReportCategorySummary[];
  allChecks: ReportCheck[];
  durationMs: number;
}
