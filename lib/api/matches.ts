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
  tournament_id?: string | null;
  round_label?: string | null;
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
  tournamentId: row.tournament_id ?? undefined,
  roundLabel: row.round_label ?? undefined,
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

  async getByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const { data, error } = await (supabase
      .from('matches')
      .select('*')
      .in('id', ids)
      .order('date_time', { ascending: true }) as any);
    if (error) throw error;
    return ((data || []) as MatchRow[]).map(row => mapMatchRowToMatch(row));
  },

  async create(matchData: {
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
    awayTeamId?: string;
    tournamentId?: string;
    roundLabel?: string;
    entryFee?: number;
    prize?: number;
    needsPlayers?: boolean;
    lat?: number;
    lng?: number;
  }, userId: string) {
    console.log('[MatchesAPI] Creating match:', matchData);
    
    // Validation des champs
    if (matchData.entryFee !== undefined && matchData.entryFee < 0) {
      throw new Error('VALIDATION: entry_fee cannot be negative');
    }
    if (matchData.maxPlayers !== undefined && matchData.maxPlayers < 2) {
      throw new Error('VALIDATION: max_players must be at least 2');
    }
    if (matchData.prize !== undefined && matchData.prize < 0) {
      throw new Error('VALIDATION: prize cannot be negative');
    }
    
    // Validation UUID pour venueId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(matchData.venueId)) {
      throw new Error('VALIDATION: venueId must be a valid UUID');
    }
    if (userId && !uuidRegex.test(userId)) {
      throw new Error('VALIDATION: userId must be a valid UUID');
    }
    
    const { data: venue, error: venueError } = await (supabase
      .from('venues')
      .select('*')
      .eq('id', matchData.venueId)
      .single() as any);
    
    if (venueError) throw new Error('Terrain non trouvé');
    const venueRow = venue as { id: string; name: string; address: string; city: string };

    // Générer un titre par défaut basé sur le sport et le format
    const sportLabels: Record<string, string> = {
      football: 'Football',
      basketball: 'Basketball',
      volleyball: 'Volleyball',
      tennis: 'Tennis',
      padel: 'Padel',
    };
    const sportLabel = sportLabels[matchData.sport] || matchData.sport;
    const defaultTitle = `${sportLabel} ${matchData.format} - ${venueRow.name}`;

    const insertPayload: Record<string, unknown> = {
      title: defaultTitle,
      match_type: matchData.type,
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
      start_time: matchData.dateTime,
      duration: matchData.duration,
      level: matchData.level,
      ambiance: matchData.ambiance,
      max_players: matchData.maxPlayers,
      registered_players: [],
      created_by: userId,
      home_team_id: matchData.homeTeamId ?? null,
      away_team_id: matchData.awayTeamId ?? null,
      entry_fee: matchData.entryFee ?? 0,
      prize: matchData.prize ?? 0,
      needs_players: matchData.needsPlayers ?? true,
      location_lat: matchData.lat,
      location_lng: matchData.lng,
    };
    if (matchData.tournamentId != null) insertPayload.tournament_id = matchData.tournamentId;
    if (matchData.roundLabel != null) insertPayload.round_label = matchData.roundLabel;

    const { data, error } = await (supabase
      .from('matches')
      .insert(insertPayload as any)
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
    
    const payload: Record<string, unknown> = {
      score_home: homeScore,
      score_away: awayScore,
      status: 'completed',
    };
    if (playerStats && playerStats.length > 0) {
      payload.player_stats = playerStats;
    }

    const { data, error } = await ((supabase.from('matches') as any)
      .update(payload)
      .eq('id', matchId)
      .select());
    
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Score non enregistré – vérifiez les permissions (RLS) sur la table matches.');
    }

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

  async updateMatch(matchId: string, updates: {
    dateTime?: string;
    venueId?: string;
    homeTeamId?: string | null;
    awayTeamId?: string | null;
    roundLabel?: string | null;
    status?: string;
  }) {
    const payload: Record<string, unknown> = {};
    if (updates.dateTime != null) payload.date_time = updates.dateTime;
    if (updates.venueId != null) {
      payload.venue_id = updates.venueId;
      const { data: venue } = await (supabase.from('venues').select('*').eq('id', updates.venueId).single() as any);
      if (venue) payload.venue_data = { id: venue.id, name: venue.name, address: venue.address, city: venue.city };
    }
    if (updates.homeTeamId !== undefined) payload.home_team_id = updates.homeTeamId;
    if (updates.awayTeamId !== undefined) payload.away_team_id = updates.awayTeamId;
    if (updates.roundLabel !== undefined) payload.round_label = updates.roundLabel;
    if (updates.status != null) payload.status = updates.status;
    if (Object.keys(payload).length === 0) return this.getById(matchId);
    const { error } = await (supabase.from('matches').update(payload as any).eq('id', matchId) as any);
    if (error) throw error;
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
