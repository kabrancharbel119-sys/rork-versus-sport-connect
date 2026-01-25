import { supabase } from '@/lib/supabase';
import type { Match, Venue, MatchPlayerStats } from '@/types';

export interface MatchRow {
  id: string;
  sport: string;
  format: string;
  type: string;
  status: string;
  home_team_id: string | null;
  away_team_id: string | null;
  venue_id: string | null;
  venue_data: { id: string; name: string; address: string; city: string } | null;
  date_time: string;
  duration: number;
  level: string;
  ambiance: string;
  max_players: number;
  registered_players: string[];
  score_home: number | null;
  score_away: number | null;
  mvp_id: string | null;
  created_by: string | null;
  entry_fee: number;
  prize: number;
  needs_players: boolean;
  location_lat: number | null;
  location_lng: number | null;
  player_stats: MatchPlayerStats[];
  created_at: string;
}

export const mapMatchRowToMatch = (row: MatchRow): Match => ({
  id: row.id,
  sport: row.sport as Match['sport'],
  format: row.format,
  type: row.type as Match['type'],
  status: row.status as Match['status'],
  homeTeamId: row.home_team_id ?? undefined,
  awayTeamId: row.away_team_id ?? undefined,
  venue: (row.venue_data as Venue) || {
    id: row.venue_id || '',
    name: '',
    address: '',
    city: '',
    sport: [],
    pricePerHour: 0,
    rating: 0,
    amenities: []
  },
  dateTime: new Date(row.date_time),
  duration: row.duration ?? 90,
  level: row.level as Match['level'],
  ambiance: row.ambiance as Match['ambiance'],
  maxPlayers: row.max_players ?? 22,
  registeredPlayers: (row.registered_players as string[]) || [],
  score: row.score_home !== null && row.score_away !== null ? {
    home: row.score_home,
    away: row.score_away
  } : undefined,
  mvpId: row.mvp_id ?? undefined,
  createdBy: row.created_by || '',
  entryFee: row.entry_fee ?? 0,
  prize: row.prize ?? 0,
  needsPlayers: row.needs_players ?? false,
  location: row.location_lat && row.location_lng ? {
    latitude: row.location_lat,
    longitude: row.location_lng,
    city: (row.venue_data as any)?.city || '',
    country: '',
    lastUpdated: new Date()
  } : undefined,
  playerStats: (row.player_stats as MatchPlayerStats[]) || [],
  createdAt: new Date(row.created_at),
});

const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const matchesApi = {
  async getAll() {
    console.log('[MatchesAPI] Getting all matches');
    const { data, error } = await (supabase
      .from('matches')
      .select('*')
      .order('date_time', { ascending: true }) as any);
    
    if (error) throw error;
    return ((data || []) as MatchRow[]).map(row => mapMatchRowToMatch(row));
  },

  async getById(id: string) {
    console.log('[MatchesAPI] Getting match by id:', id);
    const { data, error } = await (supabase
      .from('matches')
      .select('*')
      .eq('id', id)
      .single() as any);
    
    if (error) throw error;
    if (!data) throw new Error('Match non trouvé');
    return mapMatchRowToMatch(data as MatchRow);
  },

  async create(userId: string, matchData: {
    sport: string;
    format: string;
    type: 'friendly' | 'ranked' | 'tournament';
    venueId: string;
    dateTime: string;
    duration: number;
    level: string;
    ambiance: string;
    maxPlayers: number;
    homeTeamId?: string;
    entryFee?: number;
    prize?: number;
    needsPlayers?: boolean;
    lat?: number;
    lng?: number;
  }) {
    console.log('[MatchesAPI] Creating match');
    
    const { data: venue, error: venueError } = await (supabase
      .from('venues')
      .select('*')
      .eq('id', matchData.venueId)
      .single() as any);
    
    if (venueError) throw new Error('Terrain non trouvé');
    const venueRow = venue as { id: string; name: string; address: string; city: string };

    const { data, error } = await (supabase
      .from('matches')
      .insert({
        sport: matchData.sport,
        format: matchData.format,
        type: matchData.type,
        status: 'open',
        venue_id: matchData.venueId,
        venue_data: {
          id: venueRow.id,
          name: venueRow.name,
          address: venueRow.address,
          city: venueRow.city
        },
        date_time: matchData.dateTime,
        duration: matchData.duration,
        level: matchData.level,
        ambiance: matchData.ambiance,
        max_players: matchData.maxPlayers,
        registered_players: [userId],
        created_by: userId,
        home_team_id: matchData.homeTeamId,
        entry_fee: matchData.entryFee ?? 0,
        prize: matchData.prize ?? 0,
        needs_players: matchData.needsPlayers ?? true,
        location_lat: matchData.lat,
        location_lng: matchData.lng,
      } as any)
      .select()
      .single() as any);
    
    if (error) throw error;
    return mapMatchRowToMatch(data as MatchRow);
  },

  async search(params: {
    sport?: string;
    level?: string;
    city?: string;
    needsPlayers?: boolean;
    status?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
  }) {
    console.log('[MatchesAPI] Searching matches:', params);
    let query = supabase.from('matches').select('*') as any;

    if (params.sport) query = query.eq('sport', params.sport);
    if (params.level) query = query.eq('level', params.level);
    if (params.status) query = query.eq('status', params.status);
    if (params.needsPlayers !== undefined) query = query.eq('needs_players', params.needsPlayers);

    const { data, error } = await query;
    if (error) throw error;

    let matches = ((data || []) as MatchRow[]).map(row => mapMatchRowToMatch(row));

    if (params.city) {
      matches = matches.filter(m => m.venue?.city?.toLowerCase() === params.city?.toLowerCase());
    }

    if (params.lat && params.lng && params.radiusKm) {
      matches = matches.filter(m => {
        if (!m.location?.latitude || !m.location?.longitude) return true;
        return getDistance(params.lat!, params.lng!, m.location.latitude, m.location.longitude) <= params.radiusKm!;
      });
    }

    return matches;
  },

  async join(matchId: string, userId: string) {
    console.log('[MatchesAPI] Joining match:', userId, '->', matchId);
    
    const match = await this.getById(matchId);
    
    if (match.registeredPlayers.includes(userId)) {
      throw new Error('Déjà inscrit');
    }
    
    if (match.registeredPlayers.length >= match.maxPlayers) {
      throw new Error('Match complet');
    }

    const registeredPlayers = [...match.registeredPlayers, userId];
    
    const { error } = await ((supabase.from('matches') as any)
      .update({ registered_players: registeredPlayers })
      .eq('id', matchId));
    
    if (error) throw error;

    const { data: user } = await (supabase
      .from('users')
      .select('username')
      .eq('id', userId)
      .single() as any);
    const userRow = user as { username: string } | null;

    await (supabase.from('notifications').insert({
      user_id: match.createdBy,
      type: 'match',
      title: 'Nouveau joueur',
      message: `${userRow?.username || 'Un joueur'} a rejoint votre match`
    } as any) as any);

    return { success: true };
  },

  async leave(matchId: string, userId: string) {
    console.log('[MatchesAPI] Leaving match:', userId, 'from', matchId);
    
    const match = await this.getById(matchId);
    const registeredPlayers = match.registeredPlayers.filter(id => id !== userId);
    
    const { error } = await ((supabase.from('matches') as any)
      .update({ registered_players: registeredPlayers })
      .eq('id', matchId));
    
    if (error) throw error;
    return { success: true };
  },

  async updateScore(matchId: string, homeScore: number, awayScore: number, playerStats?: MatchPlayerStats[]) {
    console.log('[MatchesAPI] Updating score for match:', matchId);
    
    const { error } = await ((supabase.from('matches') as any)
      .update({
        score_home: homeScore,
        score_away: awayScore,
        status: 'completed',
        player_stats: playerStats || []
      })
      .eq('id', matchId));
    
    if (error) throw error;

    if (playerStats) {
      for (const ps of playerStats) {
        const { data: user } = await (supabase
          .from('users')
          .select('stats')
          .eq('id', ps.userId)
          .single() as any);
        
        if (user) {
          const userRow = user as { stats: unknown };
          const stats = (userRow.stats as Record<string, number>) || {
            matchesPlayed: 0, wins: 0, losses: 0, draws: 0,
            goalsScored: 0, assists: 0, mvpAwards: 0,
            fairPlayScore: 5.0, tournamentWins: 0, totalCashPrize: 0
          };
          
          stats.matchesPlayed++;
          stats.goalsScored += ps.goals;
          stats.assists += ps.assists;
          if (ps.mvp) stats.mvpAwards++;
          stats.fairPlayScore = (stats.fairPlayScore * (stats.matchesPlayed - 1) + ps.fairPlay) / stats.matchesPlayed;
          
          await ((supabase.from('users') as any).update({ stats }).eq('id', ps.userId));
        }
      }
    }

    return this.getById(matchId);
  },

  async getUpcoming() {
    console.log('[MatchesAPI] Getting upcoming matches');
    const { data, error } = await (supabase
      .from('matches')
      .select('*')
      .in('status', ['open', 'confirmed'])
      .order('date_time', { ascending: true }) as any);
    
    if (error) throw error;
    return ((data || []) as MatchRow[]).map(row => mapMatchRowToMatch(row));
  },

  async getNeedingPlayers(lat?: number, lng?: number, radiusKm: number = 50) {
    console.log('[MatchesAPI] Getting matches needing players');
    const { data, error } = await (supabase
      .from('matches')
      .select('*')
      .eq('status', 'open')
      .eq('needs_players', true) as any);
    
    if (error) throw error;

    let matches = ((data || []) as MatchRow[]).map(row => mapMatchRowToMatch(row));

    matches = matches.filter(m => m.registeredPlayers.length < m.maxPlayers);

    if (lat && lng) {
      matches = matches.filter(m => {
        if (!m.location?.latitude || !m.location?.longitude) return true;
        return getDistance(lat, lng, m.location.latitude, m.location.longitude) <= radiusKm;
      });
    }

    return matches;
  },
};
