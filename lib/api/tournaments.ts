import { supabase } from '@/lib/supabase';
import type { Tournament, TournamentPrize, Venue, Sport, SkillLevel } from '@/types';

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
};
