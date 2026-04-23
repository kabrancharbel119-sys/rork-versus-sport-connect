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
): ReportCheck => ({ id, category: 'business_rules', name, severity, passed, details, suggestion, durationMs });

export async function runBusinessRulesChecks(): Promise<ReportCheck[]> {
  const results: ReportCheck[] = [];

  // ── Auth guard: session Supabase opérationnelle ───────────
  const t0 = Date.now();
  const { error: sessionErr } = await supabase.auth.getSession();
  results.push(mk('br-auth-session', 'Auth session Supabase opérationnelle', !sessionErr, sessionErr ? sessionErr.message : 'ok', sessionErr ? 'critical' : 'passed', undefined, Date.now() - t0));

  // ── Matches: registered_players ne dépasse pas max_players ─
  const t1 = Date.now();
  const { data: matchData } = await (supabase.from('matches').select('id,max_players,registered_players').limit(500) as any);
  const overFull = (matchData || []).filter((m: any) => {
    const max = Number(m.max_players || 0);
    const reg = Array.isArray(m.registered_players) ? m.registered_players.length : 0;
    return max > 0 && reg > max;
  }).length;
  results.push(mk('br-match-capacity', 'Matchs non surchargés (registered ≤ max_players)', overFull === 0, `surchargés=${overFull}`, overFull > 0 ? 'critical' : 'passed', 'Vérifier le guard de capacité lors de l\'inscription aux matchs', Date.now() - t1));

  // ── Bookings: pas de chevauchement sur même venue ─────────
  const t2 = Date.now();
  const { data: bookData } = await (supabase.from('bookings').select('id,venue_id,date,start_time,end_time,status').in('status', ['pending', 'confirmed']).limit(500) as any);
  const bookings = bookData || [];
  let overlapCount = 0;
  const byVenueDate = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const key = `${b.venue_id}|${b.date}`;
    if (!byVenueDate.has(key)) byVenueDate.set(key, []);
    byVenueDate.get(key)!.push(b);
  }
  for (const [, group] of byVenueDate) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        if (a.start_time < b.end_time && b.start_time < a.end_time) overlapCount++;
      }
    }
  }
  results.push(mk('br-booking-overlap', 'Pas de chevauchements de bookings sur même venue/date', overlapCount === 0, `chevauchements=${overlapCount}`, overlapCount > 0 ? 'critical' : 'passed', 'Ajouter une contrainte d\'exclusion ou un trigger de validation', Date.now() - t2));

  // ── Paiements approuvés ont un tournament_id et team_id ───
  const t3 = Date.now();
  const { data: paidData } = await (supabase.from('tournament_payments').select('id,status,tournament_id,team_id').eq('status', 'approved').limit(200) as any);
  const invalidPaid = (paidData || []).filter((p: any) => !p.tournament_id || !p.team_id).length;
  results.push(mk('br-payment-refs', 'Paiements approuvés ont tournament_id et team_id', invalidPaid === 0, `sans_refs=${invalidPaid}`, invalidPaid > 0 ? 'critical' : 'passed', undefined, Date.now() - t3));

  // ── Notifications: pas d'explosion de non-lues ────────────
  const t4 = Date.now();
  const { count: unreadCount } = await (supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false) as any);
  const unread = Number(unreadCount ?? 0);
  results.push(mk('br-notifications-unread', 'Notifications non lues < 10 000', unread < 10000, `non_lues=${unread.toLocaleString()}`, unread >= 10000 ? 'warning' : 'passed', 'Mettre en place une politique de purge des notifications anciennes', Date.now() - t4));

  // ── Tournois: pas de match sans home/away teams ────────────
  const t5 = Date.now();
  const { data: mData } = await (supabase.from('matches').select('id,home_team_id,away_team_id,tournament_id').not('tournament_id', 'is', null).limit(300) as any);
  const tourMatches = (mData || []);
  const missingTeams = tourMatches.filter((m: any) => !m.home_team_id || !m.away_team_id).length;
  results.push(mk('br-tournament-matches-teams', 'Matchs de tournoi ont home_team et away_team', missingTeams === 0, `sans_equipes=${missingTeams}`, missingTeams > 0 ? 'warning' : 'passed', undefined, Date.now() - t5));

  // ── Chat rooms liées à entité valide ──────────────────────
  const t6 = Date.now();
  const { data: roomData } = await (supabase.from('chat_rooms').select('id,type,match_id,team_id,tournament_id').limit(300) as any);
  const orphanRooms = (roomData || []).filter((r: any) => {
    if (r.type === 'match' && !r.match_id) return true;
    if (r.type === 'team' && !r.team_id) return true;
    if (r.type === 'tournament' && !r.tournament_id) return true;
    return false;
  }).length;
  results.push(mk('br-chat-rooms-refs', 'Rooms de chat liées à une entité valide', orphanRooms === 0, `orphelines=${orphanRooms}`, orphanRooms > 0 ? 'warning' : 'passed', undefined, Date.now() - t6));

  // ── Venues: tous ont un nom non vide ──────────────────────
  const t7 = Date.now();
  const { data: vData } = await (supabase.from('venues').select('id,name').limit(200) as any);
  const noName = (vData || []).filter((v: any) => !v.name || String(v.name).trim() === '').length;
  results.push(mk('br-venues-name', 'Tous les venues ont un nom', noName === 0, `sans_nom=${noName}`, noName > 0 ? 'warning' : 'passed', undefined, Date.now() - t7));

  // ── Vérification: users bannés ne peuvent pas se connecter ─
  results.push(mk(
    'br-banned-users-manual',
    'Users bannis bloqués à la connexion (vérification manuelle)',
    true,
    'Confirmer que AuthContext vérifie is_banned après signIn',
    'info',
    'Dans AuthContext.signIn, vérifier user.is_banned === true et lancer signOut'
  ));

  // ── ELO initial cohérent ──────────────────────────────────
  const t8 = Date.now();
  const { data: rankData } = await (supabase.from('player_rankings').select('user_id,elo_rating').limit(300) as any);
  const badElo = (rankData || []).filter((r: any) => Number(r.elo_rating) < 0 || Number(r.elo_rating) > 5000).length;
  results.push(mk('br-elo-range', 'ELO ratings dans plage valide [0, 5000]', badElo === 0, `invalides=${badElo}`, badElo > 0 ? 'warning' : 'passed', undefined, Date.now() - t8));

  return results;
}
