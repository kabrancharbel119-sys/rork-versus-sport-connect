import { runConfigChecks } from './checks/configChecks';
import { runSecurityChecks } from './checks/securityChecks';
import { runSchemaChecks } from './checks/schemaChecks';
import { runDataIntegrityChecks } from './checks/dataIntegrityChecks';
import { runPerformanceChecks } from './checks/performanceChecks';
import { runBusinessRulesChecks } from './checks/businessRulesChecks';
import { runDeepCodeChecks } from './checks/deepCodeChecks';
import { runUxFlowChecks } from './checks/uxFlowChecks';
import { runRealtimeChecks } from './checks/realtimeChecks';
import type { ProductionReadinessResult, ReportCheck, ReportCategory, ReportCategorySummary } from './types';

const APP_VERSION = '1.0.0';
const SUPABASE_PROJECT = process.env?.EXPO_PUBLIC_SUPABASE_URL
  ? String(process.env.EXPO_PUBLIC_SUPABASE_URL).replace('https://', '').split('.')[0]
  : 'unknown';

function computeCategorySummary(checks: ReportCheck[], category: ReportCategory): ReportCategorySummary {
  const cats = checks.filter((c) => c.category === category);
  const total = cats.length;
  const passed = cats.filter((c) => c.passed).length;
  const warnings = cats.filter((c) => !c.passed && c.severity === 'warning').length;
  const critical = cats.filter((c) => !c.passed && c.severity === 'critical').length;
  const score = total > 0 ? Math.round(((passed + warnings * 0.5) / total) * 100) : 100;
  return { category, total, passed, warnings, critical, score };
}

function computeOverallScore(checks: ReportCheck[]): number {
  if (!checks.length) return 100;
  const weights: Record<ReportCheck['severity'], number> = { critical: 0, warning: 0.5, info: 1, passed: 1 };
  const totalWeight = checks.reduce((acc, c) => acc + 1, 0);
  const score = checks.reduce((acc, c) => acc + (c.passed ? 1 : weights[c.severity]), 0);
  return Math.round((score / totalWeight) * 100);
}

export class ReportRunner {
  async run(): Promise<ProductionReadinessResult> {
    const startedAt = Date.now();

    const [config, security, schema, dataIntegrity, performance, business, deepCode, uxFlows, realtime] = await Promise.all([
      runConfigChecks(),
      runSecurityChecks(),
      runSchemaChecks(),
      runDataIntegrityChecks(),
      runPerformanceChecks(),
      runBusinessRulesChecks(),
      runDeepCodeChecks(),
      runUxFlowChecks(),
      runRealtimeChecks(),
    ]);

    const allChecks: ReportCheck[] = [
      ...config,
      ...security,
      ...schema,
      ...dataIntegrity,
      ...performance,
      ...business,
      ...deepCode,
      ...uxFlows,
      ...realtime,
    ];

    const blockers = allChecks.filter((c) => !c.passed && c.severity === 'critical');
    const warnings = allChecks.filter((c) => !c.passed && c.severity === 'warning');
    const passed = allChecks.filter((c) => c.passed || c.severity === 'info');

    const categories: ReportCategory[] = ['config', 'security', 'database', 'schema', 'rls', 'storage', 'auth', 'data_integrity', 'performance', 'business_rules', 'migrations', 'app_config'];
    const usedCategories = Array.from(new Set(allChecks.map((c) => c.category)));

    const overallScore = computeOverallScore(allChecks);
    const readyForProduction = blockers.length === 0;

    return {
      generatedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      supabaseProject: SUPABASE_PROJECT,
      overallScore,
      readyForProduction,
      blockers,
      warnings,
      passed,
      categories: usedCategories.map((cat) => computeCategorySummary(allChecks, cat)),
      allChecks,
      durationMs: Date.now() - startedAt,
    };
  }

  formatTextReport(result: ProductionReadinessResult): string {
    const lines: string[] = [];
    const bar = '═'.repeat(60);
    const sep = '─'.repeat(60);

    lines.push(bar);
    lines.push('  RAPPORT PRÉ-PRODUCTION — VERSUS SPORT CONNECT');
    lines.push(bar);
    lines.push(`  Généré le : ${new Date(result.generatedAt).toLocaleString('fr-FR')}`);
    lines.push(`  Version   : ${result.appVersion}`);
    lines.push(`  Supabase  : ${result.supabaseProject}`);
    lines.push(`  Durée     : ${result.durationMs}ms`);
    lines.push(sep);
    lines.push(`  Score global : ${result.overallScore}/100`);
    lines.push(`  État         : ${result.readyForProduction ? '✅ PRÊT POUR LA PRODUCTION' : '🚫 NON PRÊT — BLOQUEURS ACTIFS'}`);
    lines.push(sep);

    if (result.blockers.length > 0) {
      lines.push(`\n🚫 BLOQUEURS (${result.blockers.length})`);
      for (const c of result.blockers) {
        lines.push(`  ✗ [${c.category.toUpperCase()}] ${c.name}`);
        lines.push(`      → ${c.details}`);
        if (c.suggestion) lines.push(`      💡 ${c.suggestion}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push(`\n⚠️  AVERTISSEMENTS (${result.warnings.length})`);
      for (const c of result.warnings) {
        lines.push(`  ~ [${c.category.toUpperCase()}] ${c.name}`);
        lines.push(`      → ${c.details}`);
        if (c.suggestion) lines.push(`      💡 ${c.suggestion}`);
      }
    }

    lines.push(`\n✅ PASSES (${result.passed.length})`);
    for (const c of result.passed) {
      lines.push(`  ✓ [${c.category.toUpperCase()}] ${c.name} — ${c.details}`);
    }

    lines.push(`\n${sep}`);
    lines.push('  SCORES PAR CATÉGORIE');
    lines.push(sep);
    for (const cat of result.categories) {
      const bar2 = '█'.repeat(Math.round(cat.score / 10)) + '░'.repeat(10 - Math.round(cat.score / 10));
      lines.push(`  ${cat.category.padEnd(18)} ${bar2} ${cat.score.toString().padStart(3)}%  (✓${cat.passed} ⚠${cat.warnings} ✗${cat.critical})`);
    }

    lines.push(bar);
    return lines.join('\n');
  }
}

export const reportRunner = new ReportRunner();
