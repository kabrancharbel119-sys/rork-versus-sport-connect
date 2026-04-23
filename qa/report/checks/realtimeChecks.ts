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
): ReportCheck => ({ id, category: 'realtime', name, severity, passed, details, suggestion, durationMs });

const time = async <T>(fn: () => Promise<T>): Promise<[T, number]> => {
  const t = Date.now();
  const r = await fn();
  return [r, Date.now() - t];
};

export async function runRealtimeChecks(): Promise<ReportCheck[]> {
  const results: ReportCheck[] = [];

  // ── 1. Realtime channel: connexion et subscription OK ────────
  const [realtimeData, t1] = await time(async () => {
    return new Promise<{ ok: boolean; error: string | null }>((resolve) => {
      const timeout = setTimeout(() => resolve({ ok: false, error: 'timeout 3s' }), 3000);
      const channel = supabase
        .channel('rt-health-check')
        .on('system', { event: 'connected' }, () => {
          clearTimeout(timeout);
          supabase.removeChannel(channel);
          resolve({ ok: true, error: null });
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timeout);
            supabase.removeChannel(channel);
            resolve({ ok: true, error: null });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timeout);
            supabase.removeChannel(channel);
            resolve({ ok: false, error: `status=${status}` });
          }
        });
    });
  });
  results.push(mk(
    'rt-channel-connect',
    'Realtime channel Supabase opérationnel',
    realtimeData.ok,
    realtimeData.error ? `erreur: ${realtimeData.error}` : 'connexion réussie ✔',
    !realtimeData.ok ? 'warning' : 'passed',
    'Vérifier que Realtime est activé dans Supabase Dashboard → Database → Replication',
    t1
  ));

  // ── 2. Chat rooms: rooms sans participants (orphelines) ──────
  const [orphanRooms, t2] = await time(async () => {
    const { data, error } = await (supabase
      .from('chat_rooms')
      .select('id, participants, type')
      .limit(200) as any);
    if (error) return { count: 0, error: error.message };
    const rows = (data || []) as Array<{ participants: string[] | null; type: string }>;
    const orphans = rows.filter(r => !r.participants || r.participants.length === 0).length;
    return { count: orphans, error: null };
  });
  results.push(mk(
    'rt-chat-orphan-rooms',
    'Rooms de chat sans participants',
    orphanRooms.count === 0,
    orphanRooms.error ? `erreur: ${orphanRooms.error}` : `rooms orphelines=${orphanRooms.count}`,
    orphanRooms.count > 5 ? 'warning' : 'passed',
    'Nettoyer les rooms orphelines ou ajouter une cascade sur suppression d\'équipe/match',
    t2
  ));

  // ── 3. Messages non lus en excès (>500 par room) ─────────────
  const [unreadExcess, t3] = await time(async () => {
    const { data, error } = await (supabase
      .from('chat_messages')
      .select('room_id, read_by')
      .limit(1000) as any);
    if (error) return { rooms: 0, error: error.message };
    const rows = (data || []) as Array<{ room_id: string; read_by: string[] | null }>;
    const byRoom: Record<string, number> = {};
    for (const row of rows) {
      const unreadByAll = !row.read_by || row.read_by.length === 0;
      if (unreadByAll) {
        byRoom[row.room_id] = (byRoom[row.room_id] ?? 0) + 1;
      }
    }
    const heavyRooms = Object.values(byRoom).filter(count => count > 500).length;
    return { rooms: heavyRooms, error: null };
  });
  results.push(mk(
    'rt-chat-unread-excess',
    'Rooms avec >500 messages non lus (perf realtime)',
    unreadExcess.rooms === 0,
    unreadExcess.error ? `erreur: ${unreadExcess.error}` : `rooms surchargées=${unreadExcess.rooms}`,
    unreadExcess.rooms > 0 ? 'warning' : 'passed',
    'Implémenter une pagination ou un marquage automatique des anciens messages comme lus',
    t3
  ));

  // ── 4. Push tokens dupliqués (même user, même device) ────────
  const [dupTokens, t4] = await time(async () => {
    const { data, error } = await (supabase
      .from('push_tokens')
      .select('user_id, token')
      .limit(500) as any);
    if (error) return { dups: 0, error: error.message };
    const rows = (data || []) as Array<{ user_id: string; token: string }>;
    const seen = new Set<string>();
    let dups = 0;
    for (const row of rows) {
      const key = `${row.user_id}::${row.token}`;
      if (seen.has(key)) dups++;
      else seen.add(key);
    }
    return { dups, error: null };
  });
  results.push(mk(
    'rt-push-token-duplicates',
    'Push tokens dupliqués (même user + token)',
    dupTokens.dups === 0,
    dupTokens.error ? `erreur: ${dupTokens.error}` : `doublons=${dupTokens.dups}`,
    dupTokens.dups > 0 ? 'warning' : 'passed',
    'Utiliser UPSERT sur push_tokens avec une contrainte UNIQUE(user_id, token)',
    t4
  ));

  // ── 5. Push tokens sans user_id valide ───────────────────────
  const [nullUserTokens, t5] = await time(async () => {
    const { data, error } = await (supabase
      .from('push_tokens')
      .select('id')
      .is('user_id', null)
      .limit(10) as any);
    if (error) return { count: 0, error: error.message };
    return { count: (data || []).length, error: null };
  });
  results.push(mk(
    'rt-push-token-null-user',
    'Push tokens sans user_id (orphelins)',
    nullUserTokens.count === 0,
    nullUserTokens.error ? `erreur: ${nullUserTokens.error}` : `tokens orphelins=${nullUserTokens.count}`,
    nullUserTokens.count > 0 ? 'warning' : 'passed',
    'Nettoyer les push_tokens où user_id est null',
    t5
  ));

  // ── 6. Live match stats: matchs in_progress sans stats ───────
  const [liveNoStats, t6] = await time(async () => {
    const { data, error } = await (supabase
      .from('matches')
      .select('id')
      .eq('status', 'in_progress')
      .limit(20) as any);
    if (error) return { count: 0, error: error.message };
    const matches = (data || []) as Array<{ id: string }>;
    let noStats = 0;
    for (const m of matches) {
      const { count } = await (supabase
        .from('live_match_stats')
        .select('match_id', { count: 'exact', head: true })
        .eq('match_id', m.id) as any);
      if ((count ?? 0) === 0) noStats++;
    }
    return { count: noStats, error: null };
  });
  results.push(mk(
    'rt-live-match-no-stats',
    'Matchs en cours sans live_match_stats',
    liveNoStats.count === 0,
    liveNoStats.error ? `erreur: ${liveNoStats.error}` : `matchs sans stats live=${liveNoStats.count}`,
    liveNoStats.count > 0 ? 'warning' : 'passed',
    'Le flow live scoring doit initialiser live_match_stats au démarrage du match',
    t6
  ));

  // ── 7. Notifications: volumétrie (anti-spam check) ───────────
  const [notifVolume, t7] = await time(async () => {
    const { data, error } = await (supabase
      .from('notifications')
      .select('user_id')
      .eq('is_read', false)
      .limit(1000) as any);
    if (error) return { maxPerUser: 0, error: error.message };
    const rows = (data || []) as Array<{ user_id: string }>;
    const byUser: Record<string, number> = {};
    for (const row of rows) {
      byUser[row.user_id] = (byUser[row.user_id] ?? 0) + 1;
    }
    const maxPerUser = Math.max(0, ...Object.values(byUser));
    const usersOverloaded = Object.values(byUser).filter(c => c > 100).length;
    return { maxPerUser, usersOverloaded, error: null };
  });
  results.push(mk(
    'rt-notifications-spam',
    'Pas d\'utilisateur avec >100 notifications non lues',
    (notifVolume as any).usersOverloaded === 0,
    notifVolume.error
      ? `erreur: ${notifVolume.error}`
      : `max non lues par user=${notifVolume.maxPerUser}, users surchargés=${(notifVolume as any).usersOverloaded ?? 0}`,
    (notifVolume as any).usersOverloaded > 0 ? 'warning' : 'passed',
    'Implémenter un nettoyage automatique des vieilles notifications',
    t7
  ));

  // ── 8. Chat messages: access control (messages lisibles) ─────
  const [chatAccess, t8] = await time(async () => {
    const { data, error } = await (supabase
      .from('chat_messages')
      .select('id, room_id')
      .limit(5) as any);
    if (error) return { ok: false, error: error.message };
    return { ok: true, count: (data || []).length, error: null };
  });
  results.push(mk(
    'rt-chat-messages-accessible',
    'Messages de chat accessibles (lecture RLS OK)',
    chatAccess.ok,
    chatAccess.error ? `bloqué: ${chatAccess.error}` : `messages lisibles=${(chatAccess as any).count ?? 0}`,
    !chatAccess.ok ? 'warning' : 'passed',
    'Vérifier la policy SELECT sur chat_messages',
    t8
  ));

  return results;
}
