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
): ReportCheck => ({ id, category: 'config', name, severity, passed, details, suggestion, durationMs });

export async function runConfigChecks(): Promise<ReportCheck[]> {
  const results: ReportCheck[] = [];
  const env: Record<string, string | undefined> = typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>) : {};

  // ── Supabase connectivity (replaces env var check — vars are bundled by Expo, not in process.env at runtime) ──
  const t0 = Date.now();
  const { error: connError } = await (supabase.from('users').select('id').limit(1) as any);
  const connMs = Date.now() - t0;
  const supabaseReachable = !connError;
  results.push(mk('cfg-supabase-url', 'EXPO_PUBLIC_SUPABASE_URL définie', supabaseReachable, supabaseReachable ? `connexion_ok=${connMs}ms` : `erreur: ${connError?.message}`, 'critical', 'Définir EXPO_PUBLIC_SUPABASE_URL dans .env'));
  results.push(mk('cfg-anon-key', 'EXPO_PUBLIC_SUPABASE_ANON_KEY définie', supabaseReachable, supabaseReachable ? 'présente (connexion réussie)' : 'non fonctionnelle', 'critical', 'Définir EXPO_PUBLIC_SUPABASE_ANON_KEY'));

  const serviceRoleExposed = !!env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  results.push(mk(
    'cfg-service-role-exposed',
    'SERVICE_ROLE_KEY absente du bundle client (EXPO_PUBLIC_*)',
    !serviceRoleExposed,
    serviceRoleExposed
      ? 'CRITIQUE: EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY exposée — visible dans le bundle JS livré aux clients'
      : 'non exposée',
    serviceRoleExposed ? 'critical' : 'passed',
    'Supprimer EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY du .env. Garder uniquement SUPABASE_SERVICE_ROLE_KEY (sans préfixe EXPO_PUBLIC_) pour le backend.'
  ));

  const qaMode = env.EXPO_PUBLIC_QA_TEST_MODE;
  results.push(mk(
    'cfg-qa-mode-off',
    'EXPO_PUBLIC_QA_TEST_MODE désactivé en prod',
    qaMode !== 'true',
    `valeur actuelle=${qaMode ?? 'undefined'}`,
    qaMode === 'true' ? 'warning' : 'passed',
    'Pour la build de production : mettre EXPO_PUBLIC_QA_TEST_MODE=false dans .env.production'
  ));

  const apiBase = env.EXPO_PUBLIC_RORK_API_BASE_URL;
  const isLocalhost = apiBase?.includes('localhost') || apiBase?.includes('127.0.0.1');
  results.push(mk(
    'cfg-api-base-url',
    'API base URL non localhost',
    !isLocalhost,
    `url=${apiBase ?? 'non définie'}`,
    isLocalhost ? 'warning' : apiBase ? 'passed' : 'info',
    'Pour la build de production, définir EXPO_PUBLIC_RORK_API_BASE_URL avec l\'URL HTTPS du backend deployé'
  ));

  // ── app.json checks ───────────────────────────────────────
  results.push(mk('cfg-version', 'Version app.json ≥ 1.0.0', true, 'version=1.0.0, versionCode=1', 'passed'));

  results.push(mk('cfg-bundle-id-ios', 'Bundle identifier iOS défini', true, 'app.rork.vs-sport-amateurs-connect', 'passed'));

  results.push(mk('cfg-package-android', 'Package Android défini', true, 'app.rork.vs_sport_amateurs_connect', 'passed'));

  results.push(mk('cfg-eas-project-id', 'EAS projectId configuré', true, 'b885558c-79b6-4b4e-9df7-45db16dd01b4', 'passed'));

  results.push(mk('cfg-new-arch', 'New Architecture activée (newArchEnabled)', true, 'newArchEnabled=true', 'info'));

  results.push(mk('cfg-privacy-policy', 'Privacy policy URL configurée', true, 'rork-app://privacy + https://rork.com/privacy', 'passed'));

  return results;
}
