import { supabase } from '@/lib/supabase';
import { matchesApi } from '@/lib/api/matches';
import type { Tournament, TournamentPrize, Venue, Sport, SkillLevel } from '@/types';
import type { Match } from '@/types';

export interface TournamentRow {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  format: string;
  type: string;
  status: string;
  level: string;
  max_teams: number;
  registered_teams: string[];
  entry_fee: number;
  prize_pool: number;
  prizes: unknown;
  venue_data: { id: string; name: string; address: string; city: string } | null;
  start_date: string;
  end_date: string;
  match_ids: string[];
  winner_id: string | null;
  sponsor_name: string | null;
  sponsor_logo: string | null;
  managers: string[] | null;
  created_by: string | null;
  created_at: string;
}

const defaultVenue: Venue = {
  id: '',
  name: '',
  address: '',
  city: '',
  sport: [],
  pricePerHour: 0,
  rating: 0,
  amenities: [],
};

export function mapTournamentRowToTournament(row: TournamentRow): Tournament {
  const v = row.venue_data;
  const venue: Venue = v
    ? {
        id: v.id,
        name: v.name,
        address: v.address || '',
        city: v.city,
        sport: [],
        pricePerHour: 0,
        rating: 0,
        amenities: [],
      }
    : defaultVenue;

  const prizes = (row.prizes as TournamentPrize[] | null) || [];

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    sport: row.sport as Sport,
    format: row.format,
    type: row.type as Tournament['type'],
    status: row.status as Tournament['status'],
    level: row.level as SkillLevel,
    maxTeams: row.max_teams ?? 16,
    registeredTeams: (row.registered_teams as string[]) || [],
    entryFee: row.entry_fee ?? 0,
    prizePool: row.prize_pool ?? 0,
    prizes,
    venue,
    startDate: new Date(row.start_date),
    endDate: new Date(row.end_date),
    matches: [],
    winnerId: row.winner_id ?? undefined,
    sponsorName: row.sponsor_name ?? undefined,
    sponsorLogo: row.sponsor_logo ?? undefined,
    managers: (row.managers as string[]) || [],
    createdBy: row.created_by ?? '',
    createdAt: new Date(row.created_at),
  };
}

export const tournamentsApi = {
  async getAll() {
    console.log('[TournamentsAPI] Getting all tournaments');
    const { data, error } = await (supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false }) as any);

    if (error) throw error;
    return ((data || []) as TournamentRow[]).map(mapTournamentRowToTournament);
  },

  async getById(id: string) {
    console.log('[TournamentsAPI] Getting tournament by id:', id);
    const { data, error } = await (supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single() as any);

    if (error) throw error;
    if (!data) throw new Error('Tournoi non trouvé');
    return mapTournamentRowToTournament(data as TournamentRow);
  },

  async create(userId: string, data: {
    name: string;
    description: string;
    sport: string;
    format: string;
    type: 'knockout' | 'league' | 'group_knockout';
    level: string;
    maxTeams: number;
    entryFee: number;
    prizePool: number;
    prizes: TournamentPrize[];
    venue: Venue;
    startDate: string;
    endDate: string;
    sponsorName?: string;
    sponsorLogo?: string;
  }) {
    console.log('[TournamentsAPI] Creating tournament:', data.name);
    const { data: row, error } = await (supabase
      .from('tournaments')
      .insert({
        name: data.name,
        description: data.description || null,
        sport: data.sport,
        format: data.format,
        type: data.type,
        status: 'registration',
        level: data.level,
        max_teams: data.maxTeams,
        registered_teams: [],
        entry_fee: data.entryFee,
        prize_pool: data.prizePool,
        prizes: data.prizes,
        venue_data: data.venue
          ? {
              id: data.venue.id,
              name: data.venue.name,
              address: data.venue.address,
              city: data.venue.city,
            }
          : null,
        start_date: data.startDate,
        end_date: data.endDate,
        match_ids: [],
        created_by: userId,
        sponsor_name: data.sponsorName ?? null,
        sponsor_logo: data.sponsorLogo ?? null,
      } as any)
      .select()
      .single() as any);

    if (error) throw error;
    return mapTournamentRowToTournament(row as TournamentRow);
  },

  async update(id: string, data: {
    name?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    entryFee?: number;
    prizePool?: number;
    prizes?: TournamentPrize[];
    status?: 'registration' | 'in_progress' | 'completed';
    sponsorName?: string;
    sponsorLogo?: string;
    matchIds?: string[];
    winnerId?: string | null;
    managers?: string[];
  }) {
    console.log('[TournamentsAPI] Updating tournament:', id);
    const payload: Record<string, unknown> = {};
    if (data.name != null) payload.name = data.name;
    if (data.description != null) payload.description = data.description;
    if (data.startDate != null) payload.start_date = data.startDate;
    if (data.endDate != null) payload.end_date = data.endDate;
    if (data.entryFee != null) payload.entry_fee = data.entryFee;
    if (data.prizePool != null) payload.prize_pool = data.prizePool;
    if (data.prizes != null) payload.prizes = data.prizes;
    if (data.status != null) payload.status = data.status;
    if (data.sponsorName != null) payload.sponsor_name = data.sponsorName;
    if (data.sponsorLogo != null) payload.sponsor_logo = data.sponsorLogo;
    if (data.matchIds != null) payload.match_ids = data.matchIds;
    if (data.winnerId !== undefined) payload.winner_id = data.winnerId;
    if (data.managers != null) payload.managers = data.managers;
    const { data: row, error } = await (supabase
      .from('tournaments')
      .update(payload)
      .eq('id', id)
      .select()
      .single() as any);
    if (error) throw error;
    return mapTournamentRowToTournament(row as TournamentRow);
  },

  async delete(id: string) {
    console.log('[TournamentsAPI] Deleting tournament:', id);
    const { error } = await (supabase.from('tournaments').delete().eq('id', id) as any);
    if (error) throw error;
    return { success: true };
  },

  async registerTeam(tournamentId: string, teamId: string) {
    if (!tournamentId?.trim() || !teamId?.trim()) throw new Error('Données invalides');
    const { data: row, error } = await (supabase
      .from('tournaments')
      .select('registered_teams, max_teams, status')
      .eq('id', tournamentId)
      .single() as any);
    if (error || !row) throw new Error('Tournoi non trouvé');
    const status = (row as { status?: string }).status;
    if (status && status !== 'registration') throw new Error('Inscriptions fermées');
    const current = (row.registered_teams as string[]) || [];
    if (current.includes(teamId)) throw new Error('Équipe déjà inscrite');
    const maxTeams = (row as { max_teams?: number }).max_teams ?? 16;
    if (current.length >= maxTeams) throw new Error('Tournoi complet');
    const updated = [...current, teamId];
    const { error: updateError } = await (supabase
      .from('tournaments')
      .update({ registered_teams: updated })
      .eq('id', tournamentId) as any);
    if (updateError) throw updateError;
    return { success: true };
  },

  async unregisterTeam(tournamentId: string, teamId: string) {
    if (!tournamentId?.trim() || !teamId?.trim()) throw new Error('Données invalides');
    const { data: row, error } = await (supabase
      .from('tournaments')
      .select('registered_teams, status')
      .eq('id', tournamentId)
      .single() as any);
    if (error || !row) throw new Error('Tournoi non trouvé');
    const status = (row as { status?: string }).status;
    if (status && status !== 'registration') throw new Error('Impossible de se désinscrire : inscriptions fermées');
    const current = (row.registered_teams as string[]) || [];
    const updated = current.filter((id) => id !== teamId);
    if (updated.length === current.length) throw new Error('Équipe non inscrite');
    const { error: updateError } = await (supabase
      .from('tournaments')
      .update({ registered_teams: updated })
      .eq('id', tournamentId) as any);
    if (updateError) throw updateError;
    return { success: true };
  },

  async getMatches(tournamentId: string): Promise<Match[]> {
    const { data: row, error } = await (supabase
      .from('tournaments')
      .select('match_ids')
      .eq('id', tournamentId)
      .single() as any);
    if (error || !row) return [];
    const matchIds = (row.match_ids as string[]) || [];
    if (matchIds.length === 0) return [];
    return matchesApi.getByIds(matchIds);
  },

  async addMatchToTournament(tournamentId: string, matchId: string) {
    const { data: row, error } = await (supabase
      .from('tournaments')
      .select('match_ids')
      .eq('id', tournamentId)
      .single() as any);
    if (error || !row) throw new Error('Tournoi non trouvé');
    const current = (row.match_ids as string[]) || [];
    if (current.includes(matchId)) return { success: true };
    const updated = [...current, matchId];
    const { error: updateError } = await (supabase
      .from('tournaments')
      .update({ match_ids: updated })
      .eq('id', tournamentId) as any);
    if (updateError) throw updateError;
    return { success: true };
  },

  async setWinner(tournamentId: string, winnerTeamId: string) {
    const { error } = await (supabase
      .from('tournaments')
      .update({ winner_id: winnerTeamId, status: 'completed' })
      .eq('id', tournamentId) as any);
    if (error) throw error;
    return { success: true };
  },

  async removeMatchFromTournament(tournamentId: string, matchId: string) {
    const { data: row, error } = await (supabase
      .from('tournaments')
      .select('match_ids')
      .eq('id', tournamentId)
      .single() as any);
    if (error || !row) throw new Error('Tournoi non trouvé');
    const current = (row.match_ids as string[]) || [];
    const updated = current.filter((id) => id !== matchId);
    if (updated.length === current.length) throw new Error('Match non lié à ce tournoi');
    const { error: updateError } = await (supabase
      .from('tournaments')
      .update({ match_ids: updated })
      .eq('id', tournamentId) as any);
    if (updateError) throw updateError;
    return { success: true };
  },
};
