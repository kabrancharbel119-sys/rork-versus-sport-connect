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
): ReportCheck => ({ id, category: 'schema', name, severity, passed, details, suggestion, durationMs });

const tableExists = async (table: string): Promise<[boolean, string, number]> => {
  const t = Date.now();
  const { error } = await (supabase.from(table).select('id').limit(1) as any);
  const ms = Date.now() - t;
  const exists = !error || !error.message.includes('does not exist');
  return [exists, error?.message ?? 'ok', ms];
};

const columnExists = async (table: string, cols: string): Promise<[boolean, string, number]> => {
  const t = Date.now();
  const { error } = await (supabase.from(table).select(cols).limit(1) as any);
  const ms = Date.now() - t;
  return [!error, error?.message ?? 'ok', ms];
};

export async function runSchemaChecks(): Promise<ReportCheck[]> {
  const results: ReportCheck[] = [];

  // ── Tables critiques ──────────────────────────────────────
  const coreTables: Array<[string, ReportCheck['severity']]> = [
    ['users', 'critical'],
    ['teams', 'critical'],
    ['matches', 'critical'],
    ['tournaments', 'critical'],
    ['tournament_teams', 'critical'],
    ['tournament_payments', 'critical'],
    ['tournament_payout_requests', 'critical'],
    ['chat_rooms', 'critical'],
    ['chat_messages', 'critical'],
    ['venues', 'critical'],
    ['bookings', 'critical'],
    ['venue_reviews', 'warning'],
    ['notifications', 'critical'],
    ['push_tokens', 'warning'],
    ['support_tickets', 'critical'],
    ['verification_requests', 'warning'],
    ['player_rankings', 'warning'],
    ['team_rankings', 'warning'],
    ['ranking_history', 'warning'],
    ['user_trophies', 'warning'],
    ['referrals', 'warning'],
    ['match_events', 'critical'],
    ['live_match_stats', 'critical'],
    ['qa_test_logs', 'info'],
  ];

  // Tables with non-id primary keys need a different probe column
  const pkOverride: Record<string, string> = {
    live_match_stats: 'match_id,home_score,away_score',
    player_rankings: 'user_id,elo_rating',
    team_rankings: 'team_id,elo_rating',
  };

  for (const [table, severity] of coreTables) {
    const probe = pkOverride[table] ?? 'id';
    const t = Date.now();
    const { error } = await (supabase.from(table).select(probe).limit(1) as any);
    const ms = Date.now() - t;
    const exists = !error || !error.message.includes('does not exist');
    results.push(mk(
      `schema-table-${table}`,
      `Table "${table}" existe`,
      exists,
      exists ? 'présente' : `absente: ${error?.message ?? 'erreur'}`,
      exists ? 'passed' : severity,
      exists ? undefined : `Appliquer la migration de création pour ${table}`,
      ms
    ));
  }

  // ── Colonnes critiques post-migrations ────────────────────
  const criticalCols: Array<[string, string, string]> = [
    ['support_tickets', 'id,responses,status,category', 'ADD_RESPONSES_COLUMN'],
    ['users', 'id,is_banned,ban_reason,banned_until', 'add_users_ban_metadata'],
    ['users', 'id,is_profile_visible', '20260322_add_user_profile_visibility'],
    ['teams', 'id,co_captain_ids', 'add_co_captain_ids_to_teams'],
    ['users', 'id,can_create_ranked_matches', 'add_can_create_ranked_matches'],
    ['verification_requests', 'id,created_at,status,type', 'FIX_VERIFICATION_CREATED_AT'],
    ['venues', 'id,cancellation_hours', 'add_cancellation_hours'],
    ['venues', 'id,max_advance_days', 'add_venue_max_advance_days'],
    ['bookings', 'id,tournament_id', 'add_tournament_id_to_bookings'],
    ['chat_rooms', 'id,participants', '20260317_add_participants_to_chat_rooms'],
    ['chat_messages', 'id,read_by', '20260317_add_read_by_to_chat_messages'],
    ['tournaments', 'id,venue_id', '20260317_add_venue_id_to_tournaments'],
    ['matches', 'id,tournament_id,round_label', 'add_missing_matches_columns'],
  ];

  for (const [table, cols, migration] of criticalCols) {
    const [ok, msg, ms] = await columnExists(table, cols);
    results.push(mk(
      `schema-col-${table}-${cols.split(',')[1] ?? cols}`,
      `"${table}" a les colonnes [${cols.split(',').slice(1).join(', ')}]`,
      ok,
      ok ? 'présentes' : `manquantes: ${msg?.slice(0, 80)}`,
      ok ? 'passed' : 'critical',
      ok ? undefined : `Appliquer la migration: ${migration}`,
      ms
    ));
  }

  // ── Migration qa_test_logs ────────────────────────────────
  const [qaLogs, , msQa] = await tableExists('qa_test_logs');
  results.push(mk(
    'schema-migration-qa-logs',
    'Migration CREATE_QA_TEST_LOGS appliquée',
    qaLogs,
    qaLogs ? 'table qa_test_logs présente' : 'table qa_test_logs manquante',
    qaLogs ? 'passed' : 'warning',
    'Appliquer supabase/migrations/CREATE_QA_TEST_LOGS.sql',
    msQa
  ));

  return results;
}
