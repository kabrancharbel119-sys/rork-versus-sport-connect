import { supabase } from '@/lib/supabase';
import type { QaStepResult } from '@/qa/types';

const nowMs = () => Date.now();

const mkResult = (name: string, start: number, status: QaStepResult['status'], details?: string, error?: string): QaStepResult => ({
  id: `${name}-${start}`,
  name,
  status,
  durationMs: Math.max(1, nowMs() - start),
  details,
  error,
});

export class IntegrityValidator {
  async validateNoOrphanTournamentTeams(): Promise<QaStepResult> {
    const start = nowMs();
    try {
      const { data, error } = await supabase
        .from('tournament_teams')
        .select('id,tournament_id,team_id')
        .limit(200);

      if (error) throw error;

      const rows = data || [];
      const tournamentIds = Array.from(new Set(rows.map((r: any) => r.tournament_id).filter(Boolean)));
      const teamIds = Array.from(new Set(rows.map((r: any) => r.team_id).filter(Boolean)));

      const [{ data: tournaments }, { data: teams }] = await Promise.all([
        supabase.from('tournaments').select('id').in('id', tournamentIds),
        supabase.from('teams').select('id').in('id', teamIds),
      ]);

      const knownTournaments = new Set((tournaments || []).map((r: any) => r.id));
      const knownTeams = new Set((teams || []).map((r: any) => r.id));

      const orphanCount = rows.filter((r: any) => !knownTournaments.has(r.tournament_id) || !knownTeams.has(r.team_id)).length;
      return mkResult(
        'No orphan tournament_teams',
        start,
        orphanCount === 0 ? 'passed' : 'failed',
        `rows=${rows.length}, orphan=${orphanCount}`,
      );
    } catch (e) {
      return mkResult('No orphan tournament_teams', start, 'warning', undefined, (e as Error).message);
    }
  }

  async validateUniquePaymentByTeamTournament(): Promise<QaStepResult> {
    const start = nowMs();
    try {
      const { data, error } = await supabase
        .from('tournament_payments')
        .select('id,tournament_id,team_id')
        .limit(500);
      if (error) throw error;

      const seen = new Set<string>();
      let duplicate = 0;
      for (const row of data || []) {
        const key = `${(row as any).tournament_id}:${(row as any).team_id}`;
        if (seen.has(key)) duplicate += 1;
        seen.add(key);
      }

      return mkResult(
        'Unique payment per team/tournament',
        start,
        duplicate === 0 ? 'passed' : 'warning',
        `rows=${(data || []).length}, duplicates=${duplicate}`,
      );
    } catch (e) {
      return mkResult('Unique payment per team/tournament', start, 'warning', undefined, (e as Error).message);
    }
  }

  async validateLiveMatchStats(): Promise<QaStepResult> {
    const start = nowMs();
    try {
      const { data, error } = await supabase
        .from('live_match_stats')
        .select('match_id,home_score,away_score,is_live')
        .limit(200);
      if (error) throw error;
      let bad = 0;
      for (const row of data || []) {
        if ((row as any).home_score < 0 || (row as any).away_score < 0) bad += 1;
      }
      return mkResult('live_match_stats scores non-negative', start, bad === 0 ? 'passed' : 'warning', `rows=${(data || []).length}, negative_scores=${bad}`);
    } catch (e) {
      return mkResult('live_match_stats scores non-negative', start, 'warning', undefined, (e as Error).message);
    }
  }

  async validateMatchEventsOrphans(): Promise<QaStepResult> {
    const start = nowMs();
    try {
      const { data, error } = await supabase
        .from('match_events')
        .select('id,match_id')
        .limit(300);
      if (error) throw error;
      const matchIds = Array.from(new Set((data || []).map((r: any) => r.match_id).filter(Boolean)));
      if (!matchIds.length) return mkResult('No orphan match_events', start, 'passed', 'no events');
      const { data: matches } = await supabase.from('matches').select('id').in('id', matchIds);
      const known = new Set((matches || []).map((r: any) => r.id));
      const orphan = (data || []).filter((r: any) => !known.has(r.match_id)).length;
      return mkResult('No orphan match_events', start, orphan === 0 ? 'passed' : 'warning', `rows=${(data || []).length}, orphan=${orphan}`);
    } catch (e) {
      return mkResult('No orphan match_events', start, 'warning', undefined, (e as Error).message);
    }
  }

  async validateTeamRankingsOrphans(): Promise<QaStepResult> {
    const start = nowMs();
    try {
      const { data, error } = await supabase
        .from('team_rankings')
        .select('team_id')
        .limit(200);
      if (error) throw error;
      const teamIds = Array.from(new Set((data || []).map((r: any) => r.team_id).filter(Boolean)));
      if (!teamIds.length) return mkResult('No orphan team_rankings', start, 'passed', 'no team rankings');
      const { data: teams } = await supabase.from('teams').select('id').in('id', teamIds);
      const known = new Set((teams || []).map((r: any) => r.id));
      const orphan = (data || []).filter((r: any) => !known.has(r.team_id)).length;
      return mkResult('No orphan team_rankings', start, orphan === 0 ? 'passed' : 'warning', `rows=${(data || []).length}, orphan=${orphan}`);
    } catch (e) {
      return mkResult('No orphan team_rankings', start, 'warning', undefined, (e as Error).message);
    }
  }

  async validateRankingHistoryOrphans(): Promise<QaStepResult> {
    const start = nowMs();
    try {
      const { data, error } = await supabase
        .from('ranking_history')
        .select('id,user_id')
        .limit(300);
      if (error) throw error;
      const uIds = Array.from(new Set((data || []).map((r: any) => r.user_id).filter(Boolean)));
      if (!uIds.length) return mkResult('No orphan ranking_history', start, 'passed', 'no history');
      const { data: users } = await supabase.from('users').select('id').in('id', uIds);
      const known = new Set((users || []).map((r: any) => r.id));
      const orphan = (data || []).filter((r: any) => !known.has(r.user_id)).length;
      return mkResult('No orphan ranking_history', start, orphan === 0 ? 'passed' : 'warning', `rows=${(data || []).length}, orphan=${orphan}`);
    } catch (e) {
      return mkResult('No orphan ranking_history', start, 'warning', undefined, (e as Error).message);
    }
  }

  async validateSupportTicketResponsesShape(): Promise<QaStepResult> {
    const start = nowMs();
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id,responses')
        .limit(200);
      if (error) throw error;

      let invalid = 0;
      for (const row of data || []) {
        const responses = (row as any).responses;
        if (!Array.isArray(responses)) {
          invalid += 1;
          continue;
        }
        const hasInvalidElement = responses.some((r: any) => typeof r?.message !== 'string' || typeof r?.isAdmin !== 'boolean');
        if (hasInvalidElement) invalid += 1;
      }

      return mkResult(
        'Support responses JSON shape',
        start,
        invalid === 0 ? 'passed' : 'warning',
        `rows=${(data || []).length}, invalid=${invalid}`,
      );
    } catch (e) {
      return mkResult('Support responses JSON shape', start, 'warning', undefined, (e as Error).message);
    }
  }
}
