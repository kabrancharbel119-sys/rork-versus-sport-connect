import { supabase } from '@/lib/supabase';
import type { ReportCheck } from '../types';

const mk = (
  id: string,
  name: string,
  passed: boolean,
  details: string,
  severity: ReportCheck['severity'],
  suggestion?: string,
  durationMs = 0,
): ReportCheck => ({ id, category: 'performance', name, severity, passed, details, suggestion, durationMs });

export async function runPerformanceChecks(): Promise<ReportCheck[]> {
  const results: ReportCheck[] = [];

  // ── Latence des tables critiques ──────────────────────────
  const latencyTests: Array<[string, string, number]> = [
    ['users', 'id', 500],
    ['matches', 'id,status', 300],
    ['tournaments', 'id,status', 300],
    ['chat_messages', 'id', 500],
    ['notifications', 'id', 300],
    ['player_rankings', 'user_id,elo_rating', 400],
    ['bookings', 'id,status', 300],
  ];

  for (const [table, cols, maxMs] of latencyTests) {
    const t = Date.now();
    const { error } = await (supabase.from(table).select(cols).limit(10) as any);
    const ms = Date.now() - t;
    const passed = !error && ms <= maxMs;
    results.push(mk(
      `perf-latency-${table}`,
      `Latence "${table}" ≤ ${maxMs}ms`,
      passed,
      error ? `erreur: ${error.message?.slice(0, 60)}` : `${ms}ms`,
      error ? 'warning' : ms > maxMs ? 'warning' : 'passed',
      ms > maxMs ? `Ajouter des index sur ${table} ou vérifier les connexions Supabase` : undefined,
      ms
    ));
  }

  // ── Storage buckets accessibles ───────────────────────────
  const buckets = ['team-logos', 'avatars', 'venue-images'];
  for (const bucket of buckets) {
    const t = Date.now();
    const { error } = await (supabase.storage.from(bucket).list('', { limit: 1 }) as any);
    const ms = Date.now() - t;
    results.push(mk(
      `perf-storage-${bucket}`,
      `Storage bucket "${bucket}" accessible`,
      !error,
      error ? `inaccessible: ${error.message?.slice(0, 80)}` : `${ms}ms`,
      error ? 'critical' : 'passed',
      error ? `Vérifier que le bucket "${bucket}" est créé dans Supabase Storage` : undefined,
      ms
    ));
  }

  // ── Burst concurrence ─────────────────────────────────────
  const burstStart = Date.now();
  const burstResults = await Promise.all(
    Array.from({ length: 20 }).map(() => supabase.from('users').select('id').limit(1).then(({ error }) => !error))
  );
  const burstMs = Date.now() - burstStart;
  const burstFailed = burstResults.filter((r) => !r).length;
  results.push(mk(
    'perf-burst-20',
    'Burst 20 requêtes parallèles sur users (≤5 échecs)',
    burstFailed <= 1,
    `failed=${burstFailed}/20, total_ms=${burstMs}`,
    burstFailed > 5 ? 'critical' : burstFailed > 1 ? 'warning' : 'passed',
    'Vérifier les limites de connexion Supabase (pooler)',
    burstMs
  ));

  // ── Taille des tables (volumétrie) ────────────────────────
  const volumeTests: Array<[string, number]> = [
    ['chat_messages', 100000],
    ['notifications', 50000],
    ['match_events', 50000],
    ['qa_test_logs', 10000],
  ];

  for (const [table, maxRows] of volumeTests) {
    const t = Date.now();
    const { count, error } = await (supabase.from(table).select('id', { count: 'exact', head: true }) as any);
    const ms = Date.now() - t;
    if (error) {
      results.push(mk(`perf-volume-${table}`, `Volumétrie "${table}"`, false, `erreur: ${error.message?.slice(0, 60)}`, 'warning', undefined, ms));
      continue;
    }
    const n = Number(count ?? 0);
    results.push(mk(
      `perf-volume-${table}`,
      `"${table}" volumétrie raisonnable (< ${maxRows.toLocaleString()})`,
      n < maxRows,
      `rows≈${n.toLocaleString()}`,
      n >= maxRows ? 'warning' : 'passed',
      n >= maxRows ? `Envisager une politique de purge/archivage pour ${table}` : undefined,
      ms
    ));
  }

  return results;
}
