import { supabase, supabaseAdmin } from '@/lib/supabase';
import { notificationsApi } from '@/lib/api/notifications';
import type { TournamentCancellationRequest, CancellationRequestStatus } from '@/types';

interface CancellationRequestRow {
  id: string;
  tournament_id: string;
  organizer_id: string;
  reason: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_note: string | null;
  organizer_response: string | null;
  internal_comment: string | null;
  refund_processed: boolean;
  refund_amount: number;
  created_at: string;
  updated_at: string;
}

export interface CancellationRequestWithDetails extends TournamentCancellationRequest {
  tournamentName?: string;
  tournamentSport?: string;
  tournamentFormat?: string;
  tournamentStatus?: string;
  tournamentEntryFee?: number;
  venueName?: string;
  startDate?: string;
  registeredTeamCount?: number;
  confirmedTeamCount?: number;
  organizerName?: string;
  organizerUsername?: string;
}

function mapRowToRequest(row: CancellationRequestRow): TournamentCancellationRequest {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    organizerId: row.organizer_id,
    reason: row.reason,
    status: row.status as CancellationRequestStatus,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
    adminNote: row.admin_note ?? undefined,
    organizerResponse: row.organizer_response ?? undefined,
    internalComment: row.internal_comment ?? undefined,
    refundProcessed: row.refund_processed,
    refundAmount: row.refund_amount,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export const tournamentCancellationApi = {
  /**
   * Organisateur: soumettre une demande d'annulation
   */
  async requestCancellation(data: {
    tournamentId: string;
    organizerId: string;
    reason: string;
  }): Promise<TournamentCancellationRequest> {
    console.log('[CancellationAPI] Requesting cancellation for tournament:', data.tournamentId);

    // Vérifier qu'il n'y a pas déjà une demande en cours
    const { data: existing } = await supabase
      .from('tournament_cancellation_requests')
      .select('id, status')
      .eq('tournament_id', data.tournamentId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      throw new Error('Une demande d\'annulation est déjà en cours pour ce tournoi.');
    }

    const { data: row, error } = await supabase
      .from('tournament_cancellation_requests')
      .insert({
        tournament_id: data.tournamentId,
        organizer_id: data.organizerId,
        reason: data.reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Notifier les admins
    try {
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin');

      const { data: tournament } = await supabase
        .from('tournaments')
        .select('name')
        .eq('id', data.tournamentId)
        .single();

      const tournamentName = tournament?.name || 'Tournoi';

      for (const admin of (admins || [])) {
        await notificationsApi.send(admin.id, {
          type: 'tournament',
          title: 'Demande d\'annulation de tournoi',
          message: `L'organisateur demande l'annulation du tournoi "${tournamentName}". Raison: ${data.reason}`,
          data: {
            tournamentId: data.tournamentId,
            cancellationRequestId: row.id,
            route: '/admin',
          },
        });
      }
    } catch (e) {
      console.warn('[CancellationAPI] Failed to notify admins:', (e as Error)?.message);
    }

    return mapRowToRequest(row as CancellationRequestRow);
  },

  /**
   * Admin: récupérer toutes les demandes en attente avec détails
   */
  async getPendingRequests(): Promise<CancellationRequestWithDetails[]> {
    const client = (supabaseAdmin ?? supabase) as typeof supabase;
    const { data, error } = await client
      .from('tournament_cancellation_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;
    const rows = (data || []) as CancellationRequestRow[];
    const requests = rows.map(mapRowToRequest);

    // Enrichir avec les détails
    const enriched = await Promise.all(
      requests.map(async (req) => {
        const details = await this.fetchDetailsForRequest(req, client);
        return { ...req, ...details };
      })
    );
    return enriched;
  },

  /**
   * Admin: récupérer toutes les demandes (tous statuts) avec détails
   */
  async getAllRequests(): Promise<CancellationRequestWithDetails[]> {
    const client = (supabaseAdmin ?? supabase) as typeof supabase;
    const { data, error } = await client
      .from('tournament_cancellation_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = (data || []) as CancellationRequestRow[];
    const requests = rows.map(mapRowToRequest);

    const enriched = await Promise.all(
      requests.map(async (req) => {
        const details = await this.fetchDetailsForRequest(req, client);
        return { ...req, ...details };
      })
    );
    return enriched;
  },

  /**
   * Helper: récupérer les détails d'une demande (tournoi, organisateur, équipes)
   */
  async fetchDetailsForRequest(req: TournamentCancellationRequest, client?: any): Promise<Partial<CancellationRequestWithDetails>> {
    const c = client ?? (supabaseAdmin ?? supabase) as typeof supabase;
    const details: Partial<CancellationRequestWithDetails> = {};

    try {
      // Infos tournoi
      const { data: tournament } = await c
        .from('tournaments')
        .select('name, sport, format, status, entry_fee, start_date, venue_id')
        .eq('id', req.tournamentId)
        .maybeSingle();

      if (tournament) {
        details.tournamentName = tournament.name;
        details.tournamentSport = tournament.sport;
        details.tournamentFormat = tournament.format;
        details.tournamentStatus = tournament.status;
        details.tournamentEntryFee = tournament.entry_fee;
        details.startDate = tournament.start_date;

        // Nom du terrain
        if (tournament.venue_id) {
          const { data: venue } = await c
            .from('venues')
            .select('name')
            .eq('id', tournament.venue_id)
            .maybeSingle();
          if (venue) details.venueName = venue.name;
        }
      }
    } catch (e) {
      console.warn('[CancellationAPI] Failed to fetch tournament details:', (e as Error)?.message);
    }

    try {
      // Infos organisateur
      const { data: organizer } = await c
        .from('users')
        .select('full_name, username')
        .eq('id', req.organizerId)
        .maybeSingle();

      if (organizer) {
        details.organizerName = organizer.full_name;
        details.organizerUsername = organizer.username;
      }
    } catch (e) {
      console.warn('[CancellationAPI] Failed to fetch organizer:', (e as Error)?.message);
    }

    try {
      // Compter les équipes inscrites et confirmées
      const { count: registeredCount } = await c
        .from('tournament_teams')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', req.tournamentId);

      const { count: confirmedCount } = await c
        .from('tournament_teams')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', req.tournamentId)
        .eq('status', 'confirmed');

      details.registeredTeamCount = registeredCount ?? 0;
      details.confirmedTeamCount = confirmedCount ?? 0;
    } catch (e) {
      console.warn('[CancellationAPI] Failed to fetch team counts:', (e as Error)?.message);
    }

    return details;
  },

  /**
   * Récupérer les demandes d'un organisateur
   */
  async getOrganizerRequests(organizerId: string): Promise<TournamentCancellationRequest[]> {
    const { data, error } = await supabase
      .from('tournament_cancellation_requests')
      .select('*')
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ((data || []) as CancellationRequestRow[]).map(mapRowToRequest);
  },

  /**
   * Récupérer la demande d'annulation d'un tournoi
   */
  async getByTournament(tournamentId: string): Promise<TournamentCancellationRequest | null> {
    const { data, error } = await supabase
      .from('tournament_cancellation_requests')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return mapRowToRequest(data as CancellationRequestRow);
  },

  /**
   * Admin: approuver une demande d'annulation
   * - Marque la demande comme approuvée
   * - Exécute l'annulation (status = cancelled, équipes = cancelled)
   * - Enregistre les remboursements dans le ledger
   * - Notifie l'organisateur et les capitaines
   */
  async approveRequest(data: {
    requestId: string;
    adminId: string;
    refundAmount?: number;
    organizerResponse?: string;
    internalComment?: string;
  }): Promise<{ success: boolean; teamsCancelled: number; refundTotal: number }> {
    console.log('[CancellationAPI] Approving cancellation request:', data.requestId);
    const client = (supabaseAdmin ?? supabase) as typeof supabase;

    // Récupérer la demande
    const { data: request, error: reqError } = await client
      .from('tournament_cancellation_requests')
      .select('*')
      .eq('id', data.requestId)
      .single();

    if (reqError || !request) throw new Error('Demande d\'annulation introuvable');
    if (request.status !== 'pending') throw new Error('Cette demande a déjà été traitée');

    // Marquer la demande comme approuvée
    await client
      .from('tournament_cancellation_requests')
      .update({
        status: 'approved',
        reviewed_by: data.adminId,
        reviewed_at: new Date().toISOString(),
        organizer_response: data.organizerResponse || null,
        internal_comment: data.internalComment || null,
        refund_amount: data.refundAmount || 0,
      })
      .eq('id', data.requestId);

    // Exécuter l'annulation via la fonction SQL
    const { data: result, error: cancelError } = await client
      .rpc('process_tournament_cancellation', {
        p_tournament_id: request.tournament_id,
        p_admin_id: data.adminId,
        p_refund_amount: data.refundAmount || 0,
      });

    if (cancelError) {
      console.error('[CancellationAPI] process_tournament_cancellation failed:', cancelError);
      throw new Error('Erreur lors du traitement de l\'annulation: ' + cancelError.message);
    }

    const resultRow = (result as any)?.[0];
    const teamsCancelled = resultRow?.teams_cancelled || 0;
    const refundTotal = resultRow?.refund_total || 0;

    // Marquer le remboursement comme traité
    if (refundTotal > 0) {
      await client
        .from('tournament_cancellation_requests')
        .update({ refund_processed: true })
        .eq('id', data.requestId);
    }

    // Notifications
    try {
      const { data: tournament } = await client
        .from('tournaments')
        .select('name')
        .eq('id', request.tournament_id)
        .single();

      const tournamentName = tournament?.name || 'Tournoi';

      // Notifier l'organisateur
      await notificationsApi.send(request.organizer_id, {
        type: 'tournament',
        title: 'Annulation approuvée',
        message: `Votre demande d'annulation du tournoi "${tournamentName}" a été approuvée. ${teamsCancelled} équipe(s) annulée(s).${refundTotal > 0 ? ` Remboursement total: ${refundTotal.toLocaleString('fr-FR')} FCFA.` : ''}${data.organizerResponse ? `\n\nRéponse de l'administrateur: ${data.organizerResponse}` : ''}`,
        data: {
          tournamentId: request.tournament_id,
          route: `/tournament/${request.tournament_id}/manage`,
        },
      });

      // Notifier les capitaines de TOUTES les équipes inscrites
      const { data: teams } = await client
        .from('tournament_teams')
        .select('team_id, status')
        .eq('tournament_id', request.tournament_id);

      for (const tt of (teams || [])) {
        const { data: team } = await client
          .from('teams')
          .select('name, captain_id')
          .eq('id', tt.team_id)
          .maybeSingle();

        if (team?.captain_id) {
          const wasConfirmed = tt.status === 'cancelled';
          await notificationsApi.send(team.captain_id, {
            type: 'tournament',
            title: 'Tournoi annulé',
            message: `Le tournoi "${tournamentName}" a été annulé.${wasConfirmed && data.refundAmount && data.refundAmount > 0 ? ` Un remboursement de ${data.refundAmount.toLocaleString('fr-FR')} FCFA sera traité.` : wasConfirmed ? ' Contactez l\'organisateur pour plus d\'informations.' : ''}`,
            data: {
              tournamentId: request.tournament_id,
              route: '/tournaments',
            },
          });
        }
      }
    } catch (e) {
      console.warn('[CancellationAPI] Notification failed:', (e as Error)?.message);
    }

    return { success: true, teamsCancelled, refundTotal };
  },

  /**
   * Admin: rejeter une demande d'annulation
   */
  async rejectRequest(data: {
    requestId: string;
    adminId: string;
    organizerResponse?: string;
    internalComment?: string;
  }): Promise<void> {
    console.log('[CancellationAPI] Rejecting cancellation request:', data.requestId);
    const client = (supabaseAdmin ?? supabase) as typeof supabase;

    const { data: request, error: reqError } = await client
      .from('tournament_cancellation_requests')
      .select('*')
      .eq('id', data.requestId)
      .single();

    if (reqError || !request) throw new Error('Demande d\'annulation introuvable');
    if (request.status !== 'pending') throw new Error('Cette demande a déjà été traitée');

    await client
      .from('tournament_cancellation_requests')
      .update({
        status: 'rejected',
        reviewed_by: data.adminId,
        reviewed_at: new Date().toISOString(),
        organizer_response: data.organizerResponse || null,
        internal_comment: data.internalComment || null,
      })
      .eq('id', data.requestId);

    // Notifier l'organisateur
    try {
      const { data: tournament } = await client
        .from('tournaments')
        .select('name')
        .eq('id', request.tournament_id)
        .single();

      await notificationsApi.send(request.organizer_id, {
        type: 'tournament',
        title: 'Demande d\'annulation rejetée',
        message: `Votre demande d'annulation du tournoi "${tournament?.name || 'Tournoi'}" a été rejetée.${data.organizerResponse ? ` Raison: ${data.organizerResponse}` : ''}`,
        data: {
          tournamentId: request.tournament_id,
          route: `/tournament/${request.tournament_id}/manage`,
        },
      });
    } catch (e) {
      console.warn('[CancellationAPI] Notification failed:', (e as Error)?.message);
    }
  },

  /**
   * Notifier toutes les équipes inscrites (tous statuts) de l'annulation ou suppression d'un tournoi
   */
  async notifyTeamsOfCancellation(tournamentId: string, reason?: string): Promise<void> {
    const client = (supabaseAdmin ?? supabase) as typeof supabase;
    try {
      const { data: tournament } = await client
        .from('tournaments')
        .select('name')
        .eq('id', tournamentId)
        .maybeSingle();

      const tournamentName = tournament?.name || 'Tournoi';

      const { data: teams } = await client
        .from('tournament_teams')
        .select('team_id, status')
        .eq('tournament_id', tournamentId);

      if (!teams || teams.length === 0) return;

      for (const tt of teams) {
        const { data: team } = await client
          .from('teams')
          .select('name, captain_id')
          .eq('id', tt.team_id)
          .maybeSingle();

        if (team?.captain_id) {
          const isConfirmed = tt.status === 'confirmed';
          await notificationsApi.send(team.captain_id, {
            type: 'tournament',
            title: 'Tournoi annulé',
            message: `Le tournoi "${tournamentName}" a été annulé.${reason ? ` Raison: ${reason}` : ''}${isConfirmed ? ' Un remboursement sera traité si applicable.' : ''}`,
            data: {
              tournamentId,
              route: '/tournaments',
            },
          });
        }
      }
    } catch (e) {
      console.warn('[CancellationAPI] notifyTeamsOfCancellation failed:', (e as Error)?.message);
    }
  },
};
