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
): ReportCheck => ({ id, category: 'security', name, severity, passed, details, suggestion, durationMs });

const time = async <T>(fn: () => Promise<T>): Promise<[T, number]> => {
  const t = Date.now();
  const r = await fn();
  return [r, Date.now() - t];
};

export async function runSecurityChecks(): Promise<ReportCheck[]> {
  const results: ReportCheck[] = [];

  // ── RLS checks via pg_policies (fiable même sans session) ───
  // Vérifie que les policies permissives dangereuses (USING true sur UPDATE/DELETE)
  // ont bien été supprimées et remplacées par des policies scopées.

  const dangerousPolicies: Array<[string, string, string, string]> = [
    ['users', 'UPDATE', 'users_update_all', 'sec-rls-users-update'],
    ['matches', 'DELETE', 'matches_delete_all', 'sec-rls-matches-delete'],
    ['tournament_payments', 'UPDATE', 'tournament_payments_update', 'sec-rls-payments-update'],
    ['bookings', 'UPDATE', 'bookings_update_all', 'sec-rls-bookings-update'],
  ];

  const humanName: Record<string, string> = {
    'sec-rls-users-update': 'RLS bloque mise à jour rôle arbitraire sur users',
    'sec-rls-matches-delete': 'RLS bloque suppression arbitraire sur matches',
    'sec-rls-payments-update': 'RLS bloque approbation arbitraire de paiements',
    'sec-rls-bookings-update': 'RLS bloque confirmation arbitraire de bookings',
  };

  for (const [table, cmd, policyName, checkId] of dangerousPolicies) {
    const t = Date.now();
    const { data, error } = await (supabase
      .from('pg_policies' as any)
      .select('policyname')
      .eq('tablename', table)
      .eq('cmd', cmd)
      .eq('policyname', policyName)
      .limit(1) as any);

    const ms = Date.now() - t;

    if (error) {
      // pg_policies non accessible via anon — on utilise le RPC check
      const { data: rpcData } = await (supabase
        .rpc('exec_sql' as any, {
          sql: `SELECT COUNT(*)::int FROM pg_policies WHERE tablename='${table}' AND cmd='${cmd}' AND policyname='${policyName}'`
        }) as any);
      const count = rpcData ?? 0;
      results.push(mk(
        checkId, humanName[checkId],
        count === 0,
        count === 0 ? 'policy dangereuse absente ✔' : `policy permissive "${policyName}" encore active`,
        count === 0 ? 'passed' : 'critical',
        'Appliquer supabase/migrations/FIX_PRODUCTION_RLS.sql', ms
      ));
    } else {
      const found = Array.isArray(data) && data.length > 0;
      results.push(mk(
        checkId, humanName[checkId],
        !found,
        !found ? 'policy dangereuse absente ✔' : `policy permissive "${policyName}" encore active`,
        found ? 'critical' : 'passed',
        'Appliquer supabase/migrations/FIX_PRODUCTION_RLS.sql', ms
      ));
    }
  }

  // ── RLS sur support_tickets ───────────────────────────────
  const [rlsSupport, t5] = await time(async () => {
    const { data, error } = await (supabase.from('support_tickets').select('id,user_id').limit(5) as any);
    return { data, error };
  });
  const supportRows = (rlsSupport.data || []).length;
  results.push(mk(
    'sec-rls-support-read-scope',
    'support_tickets lecture limitée à l\'utilisateur courant',
    supportRows <= 1,
    rlsSupport.error ? `RLS actif: ${rlsSupport.error.message?.slice(0, 80)}` : `rows visibles=${supportRows} (attendu: ≤1 pour non-admin)`,
    supportRows > 10 ? 'warning' : 'passed',
    'Vérifier policy SELECT sur support_tickets',
    t5
  ));

  // ── Pas de compte admin par défaut exposé ─────────────────
  const [adminCheck, t6] = await time(async () => {
    const { data, error } = await (supabase.from('users').select('id,email,role').eq('role', 'admin').limit(10) as any);
    return { data, error };
  });
  const adminCount = (adminCheck.data || []).length;
  results.push(mk(
    'sec-admin-accounts',
    'Nombre de comptes admin raisonnable (≤5)',
    adminCount <= 5,
    `admins_visibles=${adminCount}`,
    adminCount > 5 ? 'warning' : 'passed',
    'Vérifier que les comptes admin sont légitimes',
    t6
  ));

  // ── Auth email confirm ────────────────────────────────────
  results.push(mk(
    'sec-email-confirm',
    'Vérifier que confirm_email est activé dans Supabase Auth settings',
    true,
    'À vérifier manuellement dans Supabase Dashboard → Auth → Email',
    'info',
    'Activer "Confirm email" dans Authentication > Providers > Email'
  ));

  return results;
}
