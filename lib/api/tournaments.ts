import { supabase } from '@/lib/supabase';
import { matchesApi } from '@/lib/api/matches';
import { notificationsApi } from '@/lib/api/notifications';
import type { Tournament, TournamentPrize, Venue, Sport, SkillLevel, VenuePaymentMode } from '@/types';
import type { Match } from '@/types';
import { DEMO_TOURNAMENT_ID, DEMO_MATCHES } from '@/lib/demo-data';

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
  banner_image: string | null;
  managers: string[] | null;
  created_by: string | null;
  created_at: string;
  is_demo?: boolean;
  entry_payment_mode?: string | null;
  has_tickets?: boolean | null;
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
    bannerImage: row.banner_image ?? undefined,
    managers: (row.managers as string[]) || [],
    createdBy: row.created_by ?? '',
    createdAt: new Date(row.created_at),
    isDemo: row.is_demo ?? false,
    entryPaymentMode: (row.entry_payment_mode as VenuePaymentMode | null) ?? 'in_app_immediate',
    hasTickets: row.has_tickets ?? false,
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
    bannerImage?: string;
    selectedSlots?: Record<string, number[]>;
    entryPaymentMode?: VenuePaymentMode;
    hasTickets?: boolean;
  }) {
    console.log('[TournamentsAPI] Creating tournament:', data.name);

    // RÈGLE: un tournoi doit obligatoirement être lié à un terrain inscrit dans l'app
    if (!data.venue?.id) {
      throw new Error('Un tournoi doit être organisé sur un terrain inscrit dans l’application');
    }

    // Determine initial status BEFORE inserting: fetch venue to check auto_approve
    let initialStatus: 'registration' | 'venue_pending' = 'registration';
    let venueRowForBooking: any = null;
    {
      const { data: vr, error: venueError } = await (supabase
        .from('venues')
        .select('*')
        .eq('id', data.venue.id)
        .single() as any);
      if (venueError || !vr) {
        throw new Error('Terrain introuvable. Le tournoi doit être organisé sur un terrain inscrit dans l’application');
      }
      if (vr.is_active === false) {
        throw new Error('Ce terrain n’est pas actif actuellement');
      }
      venueRowForBooking = vr;
      if (vr.auto_approve === false) initialStatus = 'venue_pending';

      // RÈGLE SÉCURITÉ: un gestionnaire de terrain ne peut organiser que sur SES terrains
      const { data: creatorRow } = await (supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single() as any);
      if (creatorRow?.role === 'venue_manager' && vr.owner_id !== userId) {
        throw new Error('En tant que gestionnaire de terrain, vous ne pouvez organiser un tournoi que sur vos propres terrains');
      }

      // Le gestionnaire organise sur son propre terrain: réservation auto-confirmée
      if (creatorRow?.role === 'venue_manager' && vr.owner_id === userId) {
        initialStatus = 'registration';
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
        banner_image: data.bannerImage ?? null,
        entry_payment_mode: data.entryPaymentMode ?? 'in_app_immediate',
        ...(data.hasTickets ? { has_tickets: true } : {}),
      } as any)
      .select()
      .single() as any);

    if (error) throw error;
    let createdTournament = mapTournamentRowToTournament(row as TournamentRow);

    // Create a single booking covering the full tournament period to notify the venue manager
    if (data.venue?.id && venueRowForBooking) {
      try {
        const v = venueRowForBooking;
        const isOwnVenue = v.owner_id === userId;
        const autoApprove = isOwnVenue || v.auto_approve !== false;
        const bookingStatus = autoApprove ? 'confirmed' : 'pending';

        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        const pricePerHour = v.price_per_hour ?? 0;
        const openingHours: any[] = Array.isArray(v.opening_hours) ? v.opening_hours : [];

        // Determine venue payment mode for payment_status
        const venuePaymentMode = (v as any).payment_mode ?? 'cash_off_app';
        const initialPaymentStatus = venuePaymentMode === 'cash_off_app' ? 'not_required' : 'pending';

        const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

        // Compute overall time range from selectedSlots or venue opening hours
        const slots = data.selectedSlots ?? {};
        const slotDates = Object.keys(slots);
        let overallStartHour = 9;
        let overallEndHour = 18;
        let totalHours = 0;

        if (slotDates.length > 0) {
          let minHour = 24, maxHour = 0;
          for (const [, hours] of Object.entries(slots)) {
            if (!hours || hours.length === 0) continue;
            minHour = Math.min(minHour, ...hours);
            maxHour = Math.max(maxHour, ...hours);
            totalHours += hours.length;
          }
          if (minHour < 24 && maxHour > 0) {
            overallStartHour = minHour;
            overallEndHour = maxHour + 1;
          }
        } else {
          // No specific slots: use earliest opening and latest closing across all tournament days
          let minOpen = 24, maxClose = 0;
          const cur = new Date(startDate);
          while (cur <= endDate) {
            const dow = cur.getDay();
            const dh = openingHours.find((d: any) => Number(d?.dayOfWeek) === dow);
            if (dh && !dh.isClosed) {
              const po = parseInt(String(dh.openTime || '').split(':')[0], 10);
              const pc = parseInt(String(dh.closeTime || '').split(':')[0], 10);
              if (!isNaN(po) && !isNaN(pc) && po < pc) {
                minOpen = Math.min(minOpen, po);
                maxClose = Math.max(maxClose, pc);
              }
            }
            cur.setDate(cur.getDate() + 1);
          }
          if (minOpen < 24 && maxClose > 0) {
            overallStartHour = minOpen;
            overallEndHour = maxClose;
          }
          // Estimate total hours: days × hours per day
          const dayCount = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          totalHours = dayCount * (overallEndHour - overallStartHour);
        }

        // Validate opening hours for each day of the tournament
        const conflictErrors: string[] = [];
        const cur = new Date(startDate);
        while (cur <= endDate) {
          const dow = cur.getDay();
          const dh = openingHours.find((d: any) => Number(d?.dayOfWeek) === dow);
          if (dh?.isClosed === true) {
            const dStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
            conflictErrors.push(`${dStr}: terrain fermé ce jour`);
          }
          cur.setDate(cur.getDate() + 1);
        }

        // Check existing bookings for conflicts on each day
        if (conflictErrors.length === 0) {
          const cur2 = new Date(startDate);
          while (cur2 <= endDate) {
            const dStr = `${cur2.getFullYear()}-${String(cur2.getMonth() + 1).padStart(2, '0')}-${String(cur2.getDate()).padStart(2, '0')}`;
            const { data: existing } = await (supabase
              .from('bookings')
              .select('start_time, end_time')
              .eq('venue_id', data.venue.id)
              .eq('date', dStr)
              .neq('status', 'cancelled')
              .neq('status', 'rejected') as any);
            const bookedHours = new Set<number>();
            for (const b of (existing || []) as { start_time: string; end_time: string }[]) {
              const bStart = parseInt(b.start_time?.split('T')[1]?.split(':')[0] ?? '0', 10) || 0;
              const bEnd = parseInt(b.end_time?.split('T')[1]?.split(':')[0] ?? '0', 10) || 0;
              for (let h = bStart; h < bEnd; h++) bookedHours.add(h);
            }
            const conflicts: number[] = [];
            for (let h = overallStartHour; h < overallEndHour; h++) {
              if (bookedHours.has(h)) conflicts.push(h);
            }
            if (conflicts.length > 0) {
              conflictErrors.push(`${dStr}: créneaux ${conflicts.map(h => `${h}h`).join(', ')} déjà réservés`);
            }
            cur2.setDate(cur2.getDate() + 1);
          }
        }

        if (conflictErrors.length > 0 && !isOwnVenue) {
          throw new Error(`Conflits de réservation détectés:\n${conflictErrors.join('\n')}`);
        }

        const totalAmount = totalHours * pricePerHour;

        // Create a single booking for the entire tournament period
        const { data: bookingRow, error: bookingErr } = await (supabase
          .from('bookings')
          .insert({
            venue_id: data.venue.id,
            user_id: userId,
            date: dateStr,
            start_time: `${dateStr}T${String(overallStartHour).padStart(2, '0')}:00:00`,
            end_time: `${endDateStr}T${String(overallEndHour).padStart(2, '0')}:00:00`,
            total_amount: totalAmount,
            match_id: null,
            tournament_id: (row as any).id,
            status: bookingStatus,
            payment_status: initialPaymentStatus,
          } as any)
          .select()
          .single() as any);

        if (bookingErr) {
          console.warn('[TournamentsAPI] Booking insert failed:', bookingErr?.message);
        }

        // Build slot summary for notification
        const slotSummary = slotDates.length > 0
          ? Object.entries(slots).map(([d, hrs]) => `${d}: ${Math.min(...hrs)}h-${Math.max(...hrs) + 1}h`).join(' | ')
          : `${dateStr} → ${endDateStr}: ${overallStartHour}h-${overallEndHour}h`;

        // Get organizer display name
        let organizerName = 'Organisateur';
        try {
          const { data: orgRow } = await (supabase
            .from('users')
            .select('full_name, username')
            .eq('id', userId)
            .single() as any);
          organizerName = orgRow?.full_name || orgRow?.username || 'Organisateur';
        } catch {}

        // Notify venue owner
        if (v.owner_id) {
          const { notificationsApi } = await import('@/lib/api/notifications');
          await notificationsApi.send(v.owner_id, {
            type: 'booking',
            title: bookingStatus === 'pending'
              ? '🏟️ Demande de réservation (Tournoi)'
              : '✅ Réservation confirmée (Tournoi)',
            message: `${v.name} — Tournoi "${data.name}" du ${dateStr} au ${endDateStr}` +
              `\nOrganisateur: ${organizerName}` +
              `\nSport: ${data.sport} · ${data.format} · ${data.maxTeams} équipes max` +
              `\nInscription: ${data.entryFee.toLocaleString()} FCFA` +
              `\nCréneaux: ${slotSummary}` +
              `\nTotal: ${totalAmount.toLocaleString()} FCFA`,
            data: {
              bookingId: bookingRow?.id ?? '',
              venueId: data.venue.id,
              tournamentId: (row as any).id,
              date: dateStr,
              status: bookingStatus,
              organizerName,
              sport: data.sport,
              maxTeams: String(data.maxTeams),
              entryFee: String(data.entryFee),
              totalAmount: String(totalAmount),
              slotSummary,
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
    status?: 'registration' | 'in_progress' | 'completed' | 'venue_pending' | 'cancelled';
    sponsorName?: string;
    sponsorLogo?: string;
    bannerImage?: string;
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
    if (data.bannerImage != null) payload.banner_image = data.bannerImage;
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

  async delete(id: string, isAdmin: boolean = false) {
    console.log('[TournamentsAPI] Deleting tournament:', id, 'isAdmin:', isAdmin);

    // Check if tournament has entry fee and at least one confirmed team
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('entry_fee, entry_payment_mode')
      .eq('id', id)
      .single();

    if (tournament && (tournament.entry_fee ?? 0) > 0) {
      const { count } = await supabase
        .from('tournament_teams')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', id)
        .eq('status', 'confirmed');

      if ((count ?? 0) > 0 && !isAdmin) {
        throw new Error('Impossible de supprimer ce tournoi : des équipes ont déjà payé leur inscription. Contactez un administrateur pour effectuer cette opération après vérification.');
      }
    }

    const { error } = await (supabase.from('tournaments').delete().eq('id', id) as any);
    if (error) throw error;
    return { success: true };
  },

  async registerTeam(tournamentId: string, teamId: string) {
    if (!tournamentId?.trim() || !teamId?.trim()) throw new Error('Données invalides');
    
    // Vérifier que le tournoi existe et accepte les inscriptions
    const { data: tournament, error: tournamentError } = await (supabase
      .from('tournaments')
      .select('status, max_teams, entry_fee, entry_payment_mode')
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
    
    // Déterminer le statut initial selon le mode de paiement:
    // - in_app_immediate: pending_payment (l'équipe doit payer via GeniusPay pour être confirmée)
    // - cash_off_app: confirmed (paiement cash directement à l'organisateur)
    const paymentMode = tournament.entry_payment_mode || 'in_app_immediate';
    const requiresInAppPayment = tournament.entry_fee > 0 && paymentMode === 'in_app_immediate';
    const initialStatus = requiresInAppPayment ? 'pending_payment' : 'confirmed';
    
    // Inscrire l'équipe avec le statut approprié
    const { error: insertError } = await supabase
      .from('tournament_teams')
      .insert({
        tournament_id: tournamentId,
        team_id: teamId,
        status: initialStatus,
        ...(initialStatus === 'confirmed' ? { confirmed_at: new Date().toISOString() } : {}),
      });
    
    if (insertError) throw insertError;
    
    // Notifier l'organisateur de la nouvelle inscription
    try {
      const { data: tournamentInfo } = await supabase
        .from('tournaments')
        .select('name, created_by')
        .eq('id', tournamentId)
        .maybeSingle();

      const { data: teamInfo } = await supabase
        .from('teams')
        .select('name, captain_id')
        .eq('id', teamId)
        .maybeSingle();

      if (tournamentInfo?.created_by) {
        await notificationsApi.send(tournamentInfo.created_by, {
          type: 'tournament',
          title: 'Nouvelle inscription',
          message: `L'équipe "${teamInfo?.name ?? 'Équipe'}" s'est inscrite à votre tournoi "${tournamentInfo.name}".${initialStatus === 'confirmed' ? ' Inscription confirmée.' : ' En attente de paiement.'}`,
          data: {
            tournamentId,
            route: `/tournament/${tournamentId}/manage`,
          },
        });
      }

      // Notifier le capitaine de l'équipe de la confirmation
      if (initialStatus === 'confirmed' && teamInfo?.captain_id) {
        await notificationsApi.send(teamInfo.captain_id, {
          type: 'tournament',
          title: 'Inscription confirmée',
          message: `L'inscription de votre équipe "${teamInfo.name}" au tournoi "${tournamentInfo?.name ?? 'Tournoi'}" est confirmée.`,
          data: {
            tournamentId,
            route: `/tournament/${tournamentId}`,
          },
        });
      }
    } catch (e) {
      console.warn('[TournamentsAPI] Notification failed:', (e as Error)?.message);
    }
    
    // Mettre à jour registered_teams uniquement si l'équipe est confirmée
    // (pas de paiement in-app requis). Pour les paiements in_app_immediate,
    // l'équipe sera ajoutée à registered_teams par le webhook GeniusPay
    // quand le paiement sera confirmé.
    if (initialStatus === 'confirmed') {
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
    }
    
    return { success: true, requiresPayment: requiresInAppPayment, paymentMode, entryFee: tournament.entry_fee };
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
    if (tournamentId === DEMO_TOURNAMENT_ID) return DEMO_MATCHES;
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
