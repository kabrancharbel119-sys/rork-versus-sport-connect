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
): ReportCheck => ({ id, category: 'data_integrity', name, severity, passed, details, suggestion, durationMs });

const q = async <T = any>(fn: () => Promise<{ data: T | null; error: any }>): Promise<[T | null, any, number]> => {
  const t = Date.now();
  const { data, error } = await fn();
  return [data, error, Date.now() - t];
};

export async function runDataIntegrityChecks(): Promise<ReportCheck[]> {
  const results: ReportCheck[] = [];

  // ── Users ─────────────────────────────────────────────────
  const [usersData, , t1] = await q(() => (supabase.from('users').select('id,email,role,wallet_balance,reputation,is_banned').limit(500) as any));
  const users = usersData || [];

  const dupEmails = (() => {
    const seen = new Set<string>(); let dup = 0;
    for (const u of users) { if (seen.has(u.email)) dup++; seen.add(u.email); }
    return dup;
  })();
  results.push(mk('di-users-email-unique', 'Pas d\'emails dupliqués (users)', dupEmails === 0, `duplicates=${dupEmails}`, dupEmails > 0 ? 'critical' : 'passed', 'Ajouter une contrainte UNIQUE sur users.email', t1));

  const invalidRoles = users.filter((u: any) => !['user', 'admin', 'venue_manager', 'player', 'coach', 'referee'].includes(u.role)).length;
  results.push(mk('di-users-roles', 'Rôles users valides', invalidRoles === 0, `invalid_roles=${invalidRoles}`, invalidRoles > 0 ? 'warning' : 'passed', undefined, t1));

  const negWallet = users.filter((u: any) => u.wallet_balance !== null && Number(u.wallet_balance) < 0).length;
  results.push(mk('di-users-wallet', 'wallet_balance ≥ 0', negWallet === 0, `negatifs=${negWallet}`, negWallet > 0 ? 'warning' : 'passed', 'Vérifier la logique de débit du wallet', t1));

  // ── Matches ───────────────────────────────────────────────
  const [matchData, , t2] = await q(() => (supabase.from('matches').select('id,status,home_score,away_score,date_time,max_players,entry_fee,prize').limit(500) as any));
  const matches = matchData || [];

  const validMatchStatus = new Set(['pending', 'upcoming', 'in_progress', 'completed', 'cancelled']);
  const badMatchStatus = matches.filter((m: any) => m.status && !validMatchStatus.has(m.status)).length;
  results.push(mk('di-matches-status', 'Statuts matches valides', badMatchStatus === 0, `invalides=${badMatchStatus}`, badMatchStatus > 0 ? 'critical' : 'passed', undefined, t2));

  const negFee = matches.filter((m: any) => m.entry_fee !== null && Number(m.entry_fee) < 0).length;
  results.push(mk('di-matches-entry-fee', 'entry_fee ≥ 0', negFee === 0, `negatifs=${negFee}`, negFee > 0 ? 'warning' : 'passed', undefined, t2));

  const negPrize = matches.filter((m: any) => m.prize !== null && Number(m.prize) < 0).length;
  results.push(mk('di-matches-prize', 'prize ≥ 0', negPrize === 0, `negatifs=${negPrize}`, negPrize > 0 ? 'warning' : 'passed', undefined, t2));

  // ── Tournaments ───────────────────────────────────────────
  const [tourData, , t3] = await q(() => (supabase.from('tournaments').select('id,status,max_teams,registered_teams,entry_fee,prize_pool,start_date,end_date').limit(300) as any));
  const tours = tourData || [];

  const validTourStatus = new Set(['draft', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled']);
  const badTourStatus = tours.filter((t: any) => t.status && !validTourStatus.has(t.status)).length;
  results.push(mk('di-tournaments-status', 'Statuts tournois valides', badTourStatus === 0, `invalides=${badTourStatus}`, badTourStatus > 0 ? 'critical' : 'passed', undefined, t3));

  const overCapacity = tours.filter((t: any) => {
    const max = Number(t.max_teams || 0);
    const reg = Array.isArray(t.registered_teams) ? t.registered_teams.length : 0;
    return max > 0 && reg > max;
  }).length;
  results.push(mk('di-tournaments-capacity', 'Tournois non surchargés (registered ≤ max_teams)', overCapacity === 0, `surchargés=${overCapacity}`, overCapacity > 0 ? 'critical' : 'passed', 'Vérifier le guard de capacité lors de l\'inscription', t3));

  const tourDatesBad = tours.filter((t: any) => t.start_date && t.end_date && new Date(t.end_date) < new Date(t.start_date)).length;
  results.push(mk('di-tournaments-dates', 'end_date ≥ start_date dans les tournois', tourDatesBad === 0, `incohérents=${tourDatesBad}`, tourDatesBad > 0 ? 'warning' : 'passed', undefined, t3));

  // ── Payments ──────────────────────────────────────────────
  const [payData, , t4] = await q(() => (supabase.from('tournament_payments').select('id,status,amount,tournament_id,team_id').limit(500) as any));
  const payments = payData || [];

  const validPayStatus = new Set(['pending', 'submitted', 'approved', 'rejected']);
  const badPayStatus = payments.filter((p: any) => p.status && !validPayStatus.has(p.status)).length;
  results.push(mk('di-payments-status', 'Statuts paiements valides', badPayStatus === 0, `invalides=${badPayStatus}`, badPayStatus > 0 ? 'critical' : 'passed', undefined, t4));

  const nonPositivePay = payments.filter((p: any) => p.amount !== null && Number(p.amount) <= 0).length;
  results.push(mk('di-payments-amount', 'Montants paiements > 0', nonPositivePay === 0, `invalides=${nonPositivePay}`, nonPositivePay > 0 ? 'warning' : 'passed', undefined, t4));

  // ── Venues ────────────────────────────────────────────────
  const [venueData, , t5] = await q(() => (supabase.from('venues').select('id,name,price_per_hour,owner_id').limit(300) as any));
  const venues = venueData || [];

  const venueNoOwner = venues.filter((v: any) => !v.owner_id).length;
  results.push(mk('di-venues-owner', 'Tous les venues ont un owner_id', venueNoOwner === 0, `sans_owner=${venueNoOwner}`, venueNoOwner > 0 ? 'warning' : 'passed', undefined, t5));

  const negPrice = venues.filter((v: any) => v.price_per_hour !== null && Number(v.price_per_hour) < 0).length;
  results.push(mk('di-venues-price', 'price_per_hour ≥ 0', negPrice === 0, `negatifs=${negPrice}`, negPrice > 0 ? 'warning' : 'passed', undefined, t5));

  // ── Teams ─────────────────────────────────────────────────
  const [teamData, , t6] = await q(() => (supabase.from('teams').select('id,captain_id,member_ids,co_captain_ids').limit(300) as any));
  const teams = teamData || [];

  const captainNotMember = teams.filter((t: any) => {
    const members = Array.isArray(t.member_ids) ? t.member_ids : [];
    return t.captain_id && !members.includes(t.captain_id);
  }).length;
  results.push(mk('di-teams-captain', 'captain_id appartient à member_ids', captainNotMember === 0, `violations=${captainNotMember}`, captainNotMember > 0 ? 'critical' : 'passed', 'Vérifier la logique de création/transfert de capitaine', t6));

  const coCaptainNotMember = teams.reduce((acc: number, t: any) => {
    const members = Array.isArray(t.member_ids) ? t.member_ids : [];
    const coCaps = Array.isArray(t.co_captain_ids) ? t.co_captain_ids : [];
    return acc + coCaps.filter((c: string) => !members.includes(c)).length;
  }, 0);
  results.push(mk('di-teams-co-captain', 'co_captain_ids appartiennent à member_ids', coCaptainNotMember === 0, `violations=${coCaptainNotMember}`, coCaptainNotMember > 0 ? 'warning' : 'passed', undefined, t6));

  // ── Trophies ──────────────────────────────────────────────
  const [trophyData, , t7] = await q(() => (supabase.from('user_trophies').select('id,progress,unlocked_at').limit(300) as any));
  const trophies = trophyData || [];

  const unlockedIncomplete = trophies.filter((t: any) => t.unlocked_at && Number(t.progress) < 100).length;
  results.push(mk('di-trophies-coherence', 'unlocked_at seulement quand progress=100', unlockedIncomplete === 0, `incohérents=${unlockedIncomplete}`, unlockedIncomplete > 0 ? 'warning' : 'passed', undefined, t7));

  // ── Referrals ─────────────────────────────────────────────
  const [refData, , t8] = await q(() => (supabase.from('referrals').select('id,referrer_id,referred_id').limit(300) as any));
  const refs = refData || [];
  const selfRefs = refs.filter((r: any) => r.referrer_id && r.referred_id && r.referrer_id === r.referred_id).length;
  results.push(mk('di-referrals-self', 'Pas d\'auto-parrainage', selfRefs === 0, `self_referrals=${selfRefs}`, selfRefs > 0 ? 'critical' : 'passed', 'Ajouter une contrainte CHECK referrer_id <> referred_id', t8));

  return results;
}
