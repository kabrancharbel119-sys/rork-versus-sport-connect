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
  venue_id: string | null;
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

  async getByVenue(venueId: string) {
    console.log('[TournamentsAPI] Getting tournaments for venue:', venueId);
    const { data, error } = await (supabase
      .from('tournaments')
      .select('*')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false }) as any);

    if (error) throw error;
    return ((data || []) as TournamentRow[]).map(mapTournamentRowToTournament);
  },

  async getByCreator(userId: string) {
    console.log('[TournamentsAPI] Getting tournaments created by user:', userId);
    const { data, error } = await (supabase
      .from('tournaments')
      .select('*')
      .eq('created_by', userId)
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
    selectedSlots?: Record<string, number[]>;
  }) {
    console.log('[TournamentsAPI] Creating tournament:', data.name);

    // Determine initial status BEFORE inserting: fetch venue to check auto_approve
    let initialStatus: 'registration' | 'venue_pending' = 'registration';
    let venueRowForBooking: any = null;
    if (data.venue?.id) {
      const { data: vr } = await (supabase
        .from('venues')
        .select('*')
        .eq('id', data.venue.id)
        .single() as any);
      if (vr) {
        venueRowForBooking = vr;
        if (vr.auto_approve === false) initialStatus = 'venue_pending';
      }
    }

    const { data: row, error } = await (supabase
      .from('tournaments')
      .insert({
        name: data.name,
        description: data.description || null,
        sport: data.sport,
        format: data.format,
        type: data.type,
        status: initialStatus,
        level: data.level,
        max_teams: data.maxTeams,
        registered_teams: [],
        entry_fee: data.entryFee,
        prize_pool: data.prizePool,
        prizes: data.prizes,
        venue_id: data.venue?.id || null,
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
    let createdTournament = mapTournamentRowToTournament(row as TournamentRow);

    // Create a single booking covering the full tournament period to notify the venue manager
    // Non-blocking: a tournament reserves the whole period, individual match bookings handle slots
    if (data.venue?.id && venueRowForBooking) {
      try {
        const v = venueRowForBooking;
        const autoApprove = v.auto_approve !== false;
        const bookingStatus = autoApprove ? 'confirmed' : 'pending';

        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

        // Calculate total price: sum of all selected slots × pricePerHour
        const pricePerHour = v.price_per_hour ?? 0;
        const totalHours = Object.values(data.selectedSlots ?? {}).reduce((sum, slots) => sum + slots.length, 0);
        const totalAmount = totalHours * pricePerHour;

        const { data: bookingRow } = await (supabase
          .from('bookings')
          .insert({
            venue_id: data.venue.id,
            user_id: userId,
            date: dateStr,
            start_time: `${dateStr}T09:00:00`,
            end_time: `${endDateStr}T22:00:00`,
            total_amount: totalAmount,
            match_id: null,
            tournament_id: (row as any).id,
            status: bookingStatus,
          } as any)
          .select()
          .single() as any);

        // Notify venue owner
        if (v.owner_id) {
          const { notificationsApi } = await import('@/lib/api/notifications');
          await notificationsApi.send(v.owner_id, {
            type: 'booking',
            title: bookingStatus === 'pending'
              ? '🏟️ Demande de réservation (Tournoi)'
              : '✅ Réservation confirmée (Tournoi)',
            message: `${v.name} — Tournoi "${data.name}" du ${dateStr} au ${endDateStr}`,
            data: {
              bookingId: bookingRow?.id ?? '',
              venueId: data.venue.id,
              tournamentId: (row as any).id,
              date: dateStr,
              status: bookingStatus,
            },
          });
        }
      } catch (bookingErr: any) {
        console.warn('[TournamentsAPI] Booking creation failed (non-blocking):', bookingErr?.message);
      }
    }

    return createdTournament;
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
    
    // Get current tournament data to check for date changes
    const { data: currentTournament, error: fetchError } = await (supabase
      .from('tournaments')
      .select('start_date, end_date, match_ids')
      .eq('id', id)
      .single() as any);
    
    if (fetchError) throw fetchError;
    
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
      .update(payload as any)
      .eq('id', id)
      .select()
      .single() as any);
    if (error) throw error;
    
    // If dates changed, update all tournament matches proportionally
    if ((data.startDate != null || data.endDate != null) && currentTournament) {
      const oldStart = new Date(currentTournament.start_date);
      const oldEnd = new Date(currentTournament.end_date);
      const newStart = data.startDate ? new Date(data.startDate) : oldStart;
      const newEnd = data.endDate ? new Date(data.endDate) : oldEnd;
      
      const matchIds = (currentTournament.match_ids as string[]) || [];
      
      if (matchIds.length > 0) {
        console.log('[TournamentsAPI] Updating match dates for', matchIds.length, 'matches');
        
        // Get all matches
        const { data: matches, error: matchesError } = await (supabase
          .from('matches')
          .select('id, date_time, start_time')
          .in('id', matchIds) as any);
        
        if (!matchesError && matches) {
          const oldDuration = oldEnd.getTime() - oldStart.getTime();
          const newDuration = newEnd.getTime() - newStart.getTime();
          
          // Update each match proportionally
          for (const match of matches) {
            const oldMatchDate = new Date(match.date_time || match.start_time);
            
            // Calculate the position of this match in the old tournament timeline (0 to 1)
            const position = oldDuration > 0 
              ? (oldMatchDate.getTime() - oldStart.getTime()) / oldDuration 
              : 0;
            
            // Apply the same position to the new timeline
            const newMatchTime = new Date(newStart.getTime() + (position * newDuration));
            
            // Update the match
            await supabase
              .from('matches')
              .update({
                date_time: newMatchTime.toISOString(),
                start_time: newMatchTime.toISOString(),
              } as any)
              .eq('id', match.id);
          }
          
          console.log('[TournamentsAPI] Updated', matches.length, 'match dates');
        }
      }
    }
    
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
    
    // Vérifier que le tournoi existe et accepte les inscriptions
    const { data: tournament, error: tournamentError } = await (supabase
      .from('tournaments')
      .select('status, max_teams, entry_fee')
      .eq('id', tournamentId)
      .single() as any);
    
    if (tournamentError || !tournament) throw new Error('Tournoi non trouvé');
    if (tournament.status !== 'registration') throw new Error('Inscriptions fermées');
    
    // Vérifier si l'équipe est déjà inscrite
    const { data: existing } = await supabase
      .from('tournament_teams')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('team_id', teamId)
      .single();
    
    if (existing) throw new Error('Équipe déjà inscrite');
    
    // Vérifier les places disponibles via la fonction SQL
    const { data: hasSpots, error: spotsError } = await (supabase
      .rpc('has_available_spots', { p_tournament_id: tournamentId }) as any);
    
    if (spotsError) throw spotsError;
    if (!hasSpots) throw new Error('Tournoi complet');
    
    // Inscrire l'équipe avec statut pending_payment
    const { error: insertError } = await supabase
      .from('tournament_teams')
      .insert({
        tournament_id: tournamentId,
        team_id: teamId,
        status: 'pending_payment',
      });
    
    if (insertError) throw insertError;
    
    // Aussi mettre à jour registered_teams pour compatibilité (sera déprécié)
    const { data: row } = await supabase
      .from('tournaments')
      .select('registered_teams')
      .eq('id', tournamentId)
      .single();
    
    const current = (row?.registered_teams as string[]) || [];
    if (!current.includes(teamId)) {
      await supabase
        .from('tournaments')
        .update({ registered_teams: [...current, teamId] } as any)
        .eq('id', tournamentId);
    }
    
    return { success: true, requiresPayment: tournament.entry_fee > 0 };
  },

  async unregisterTeam(tournamentId: string, teamId: string) {
    if (!tournamentId?.trim() || !teamId?.trim()) throw new Error('Données invalides');
    
    // Vérifier que le tournoi accepte les désinscriptions
    const { data: tournament, error: tournamentError } = await (supabase
      .from('tournaments')
      .select('status')
      .eq('id', tournamentId)
      .single() as any);
    
    if (tournamentError || !tournament) throw new Error('Tournoi non trouvé');
    if (tournament.status !== 'registration') throw new Error('Impossible de se désinscrire : inscriptions fermées');
    
    // Vérifier le statut de l'équipe (peut être absent si données legacy désynchronisées)
    const { data: teamStatus } = await supabase
      .from('tournament_teams')
      .select('status')
      .eq('tournament_id', tournamentId)
      .eq('team_id', teamId)
      .maybeSingle();

    if (teamStatus?.status === 'confirmed') {
      throw new Error('Impossible de se désinscrire : paiement déjà validé');
    }
    
    // Supprimer l'inscription (le paiement sera supprimé automatiquement via CASCADE)
    const { error: deleteError } = await supabase
      .from('tournament_teams')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('team_id', teamId);
    
    if (deleteError) throw deleteError;
    
    // Aussi mettre à jour registered_teams pour compatibilité
    const { data: row } = await supabase
      .from('tournaments')
      .select('registered_teams')
      .eq('id', tournamentId)
      .single();
    
    const current = (row?.registered_teams as string[]) || [];
    const updated = current.filter((id) => id !== teamId);
    await supabase
      .from('tournaments')
      .update({ registered_teams: updated } as any)
      .eq('id', tournamentId);
    
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
      .update({ match_ids: updated } as any)
      .eq('id', tournamentId) as any);
    if (updateError) throw updateError;
    return { success: true };
  },

  async setWinner(tournamentId: string, winnerTeamId: string) {
    const { error } = await (supabase
      .from('tournaments')
      .update({ winner_id: winnerTeamId, status: 'completed' } as any)
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
      .update({ match_ids: updated } as any)
      .eq('id', tournamentId) as any);
    if (updateError) throw updateError;
    return { success: true };
  },
};
