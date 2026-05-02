import { supabase, supabaseAdmin } from '@/lib/supabase';
import { notificationsApi } from '@/lib/api/notifications';
import { DEMO_TOURNAMENT_ID, DEMO_TEAMS } from '@/lib/demo-data';
import type {
  TournamentPayment,
  PaymentLog,
  TournamentTeam,
  PaymentMethod,
  PaymentStatus,
  TournamentTeamStatus,
  TournamentPayoutRequest,
  PayoutRequestStatus,
} from '@/types';

// =============================================
// TYPES POUR LES ROWS DE LA DB
// =============================================

interface TournamentPaymentRow {
  id: string;
  tournament_id: string;
  team_id: string;
  amount: number;
  method: string;
  receiver: string;
  status: string;
  screenshot_url: string | null;
  transaction_ref: string | null;
  expected_sender_name: string | null;
  validated_by: string | null;
  created_at: string;
  validated_at: string | null;
  payment_deadline: string | null;
  payout_status: string;
  organizer_amount: number;
  platform_fee: number;
}

interface PaymentLogRow {
  id: string;
  payment_id: string;
  action: string;
  performed_by: string | null;
  details: any;
  timestamp: string;
}

interface TournamentTeamRow {
  id: string;
  tournament_id: string;
  team_id: string;
  status: string;
  registered_at: string;
  confirmed_at: string | null;
}

interface TournamentPayoutRequestRow {
  id: string;
  tournament_id: string;
  organizer_id: string;
  requested_amount: number;
  purpose_category: 'venue' | 'referees' | 'logistics' | 'communication' | 'prize' | 'other';
  reason: string;
  use_of_funds: string;
  budget_breakdown: string;
  amount_already_spent: number;
  needed_by: string | null;
  supporting_evidence: string | null;
  fallback_contact: string | null;
  urgency: 'low' | 'medium' | 'high';
  payout_phone: string;
  status: string;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================
// MAPPERS
// =============================================

function mapPaymentRowToPayment(row: TournamentPaymentRow): TournamentPayment {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    teamId: row.team_id,
    amount: row.amount,
    method: row.method as PaymentMethod,
    receiver: row.receiver,
    status: row.status as PaymentStatus,
    screenshotUrl: row.screenshot_url || undefined,
    transactionRef: row.transaction_ref || undefined,
    expectedSenderName: row.expected_sender_name || undefined,
    validatedBy: row.validated_by || undefined,
    createdAt: new Date(row.created_at),
    validatedAt: row.validated_at ? new Date(row.validated_at) : undefined,
    paymentDeadline: row.payment_deadline ? new Date(row.payment_deadline) : undefined,
    payoutStatus: row.payout_status as 'pending' | 'sent',
    organizerAmount: row.organizer_amount,
    platformFee: row.platform_fee,
  };
}

function mapPayoutRequestRowToRequest(row: TournamentPayoutRequestRow): TournamentPayoutRequest {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    organizerId: row.organizer_id,
    requestedAmount: row.requested_amount,
    purposeCategory: row.purpose_category,
    reason: row.reason,
    useOfFunds: row.use_of_funds,
    budgetBreakdown: row.budget_breakdown,
    amountAlreadySpent: row.amount_already_spent,
    neededBy: row.needed_by ? new Date(row.needed_by) : undefined,
    supportingEvidence: row.supporting_evidence || undefined,
    fallbackContact: row.fallback_contact || undefined,
    urgency: row.urgency,
    payoutPhone: row.payout_phone,
    status: row.status as PayoutRequestStatus,
    adminNote: row.admin_note || undefined,
    reviewedBy: row.reviewed_by || undefined,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapLogRowToLog(row: PaymentLogRow): PaymentLog {
  return {
    id: row.id,
    paymentId: row.payment_id,
    action: row.action,
    performedBy: row.performed_by || undefined,
    details: row.details || {},
    timestamp: new Date(row.timestamp),
  };
}

function mapTournamentTeamRowToTournamentTeam(row: TournamentTeamRow): TournamentTeam {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    teamId: row.team_id,
    status: row.status as TournamentTeamStatus,
    registeredAt: new Date(row.registered_at),
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : undefined,
  };
}

// =============================================
// CONFIGURATION ADMIN (NUMÉROS DE PAIEMENT)
// =============================================

export const PAYMENT_CONFIG = {
  wave: {
    number: '+225 0789924981',
    name: 'Versus Sport',
  },
  orange: {
    number: '+225 0789924981',
    name: 'Versus Sport',
  },
  paymentDeadlineHours: 2, // 2 heures pour soumettre la preuve
};

// =============================================
// API TOURNAMENT PAYMENTS
// =============================================

export const tournamentPaymentsApi = {
  /**
   * Récupérer le paiement d'une équipe pour un tournoi
   */
  async getPayment(tournamentId: string, teamId: string): Promise<TournamentPayment | null> {
    console.log('[PaymentsAPI] Getting payment for tournament:', tournamentId, 'team:', teamId);
    const { data, error } = await (supabase
      .from('tournament_payments')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('team_id', teamId)
      .single() as any);

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data ? mapPaymentRowToPayment(data as TournamentPaymentRow) : null;
  },

  /**
   * Récupérer tous les paiements en attente de validation (ADMIN)
   */
  async getPendingPayments(): Promise<TournamentPayment[]> {
    console.log('[PaymentsAPI] Getting pending payments');
    const client = (supabaseAdmin ?? supabase) as typeof supabase;
    const { data, error } = await (client
      .from('tournament_payments')
      .select('*')
      .eq('status', 'submitted')
      .order('created_at', { ascending: true }) as any);

    if (error) throw error;
    return ((data || []) as TournamentPaymentRow[]).map(mapPaymentRowToPayment);
  },

  /**
   * Récupérer tous les paiements d'un tournoi (ADMIN/ORGANIZER)
   */
  async getTournamentPayments(tournamentId: string): Promise<TournamentPayment[]> {
    console.log('[PaymentsAPI] Getting payments for tournament:', tournamentId);
    const { data, error } = await (supabase
      .from('tournament_payments')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false }) as any);

    if (error) throw error;
    return ((data || []) as TournamentPaymentRow[]).map(mapPaymentRowToPayment);
  },

  /**
   * Soumettre un paiement (CAPITAINE)
   */
  async submitPayment(data: {
    tournamentId: string;
    teamId: string;
    amount: number;
    method: PaymentMethod;
    screenshotUrl?: string;
    transactionRef?: string;
    expectedSenderName: string;
  }): Promise<TournamentPayment> {
    console.log('[PaymentsAPI] Submitting payment for team:', data.teamId);

    // Calculer la deadline (2h à partir de maintenant)
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + PAYMENT_CONFIG.paymentDeadlineHours);

    const { data: row, error } = await (supabase
      .from('tournament_payments')
      .insert({
        tournament_id: data.tournamentId,
        team_id: data.teamId,
        amount: data.amount,
        method: data.method,
        receiver: 'admin',
        status: 'submitted',
        screenshot_url: data.screenshotUrl || null,
        transaction_ref: data.transactionRef || null,
        expected_sender_name: data.expectedSenderName,
        payment_deadline: deadline.toISOString(),
      })
      .select()
      .single() as any);

    if (error) throw error;

    // Mettre à jour le statut de l'équipe
    await supabase
      .from('tournament_teams')
      .update({ status: 'payment_submitted' })
      .eq('tournament_id', data.tournamentId)
      .eq('team_id', data.teamId);

    return mapPaymentRowToPayment(row as TournamentPaymentRow);
  },

  /**
   * Mettre à jour un paiement existant (CAPITAINE)
   */
  async updatePayment(
    tournamentId: string,
    teamId: string,
    data: {
      screenshotUrl?: string;
      transactionRef?: string;
      expectedSenderName?: string;
    }
  ): Promise<TournamentPayment> {
    console.log('[PaymentsAPI] Updating payment for team:', teamId);

    const { data: row, error } = await (supabase
      .from('tournament_payments')
      .update({
        screenshot_url: data.screenshotUrl || null,
        transaction_ref: data.transactionRef || null,
        expected_sender_name: data.expectedSenderName,
        status: 'submitted',
      })
      .eq('tournament_id', tournamentId)
      .eq('team_id', teamId)
      .select()
      .single() as any);

    if (error) throw error;
    return mapPaymentRowToPayment(row as TournamentPaymentRow);
  },

  /**
   * Approuver un paiement (ADMIN UNIQUEMENT)
   */
  async approvePayment(paymentId: string, adminId: string): Promise<TournamentPayment> {
    console.log('[PaymentsAPI] Approving payment:', paymentId);
    const client = (supabaseAdmin ?? supabase) as typeof supabase;

    const { data: row, error } = await (client
      .from('tournament_payments')
      .update({
        status: 'approved',
        validated_by: adminId,
        validated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single() as any);

    if (error) throw error;

    const payment = mapPaymentRowToPayment(row as TournamentPaymentRow);

    // Mettre à jour le statut de l'équipe
    await (supabaseAdmin ?? supabase)
      .from('tournament_teams')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      })
      .eq('tournament_id', payment.tournamentId)
      .eq('team_id', payment.teamId);

    // Notifications (non bloquantes)
    try {
      const { data: teamRow } = await (supabase
        .from('teams')
        .select('name, captain_id')
        .eq('id', payment.teamId)
        .single() as any);

      const { data: tournamentRow } = await (supabase
        .from('tournaments')
        .select('name, created_by')
        .eq('id', payment.tournamentId)
        .single() as any);

      const teamName = teamRow?.name || 'Votre équipe';
      const tournamentName = tournamentRow?.name || 'ce tournoi';
      const captainId = teamRow?.captain_id as string | undefined;
      const organizerId = tournamentRow?.created_by as string | undefined;

      if (captainId) {
        await notificationsApi.send(captainId, {
          type: 'tournament',
          title: 'Paiement approuvé ✅',
          message: `Le paiement de ${teamName} est approuvé. Inscription confirmée pour ${tournamentName}.`,
          data: { route: `/tournament/${payment.tournamentId}` },
        });
      }

      if (organizerId && organizerId !== captainId) {
        await notificationsApi.send(organizerId, {
          type: 'tournament',
          title: 'Paiement équipe approuvé',
          message: `Le paiement de l’équipe ${teamName} est approuvé. Inscription confirmée.`,
          data: { route: `/tournament/${payment.tournamentId}` },
        });
      }
    } catch (e) {
      console.warn('[PaymentsAPI] Notification failed after approval:', (e as Error)?.message ?? e);
    }

    return payment;
  },

  /**
   * Rejeter un paiement (ADMIN UNIQUEMENT)
   */
  async rejectPayment(paymentId: string, adminId: string, reason?: string): Promise<TournamentPayment> {
    console.log('[PaymentsAPI] Rejecting payment:', paymentId);
    const client = (supabaseAdmin ?? supabase) as typeof supabase;

    const { data: row, error } = await (client
      .from('tournament_payments')
      .update({
        status: 'rejected',
        validated_by: adminId,
        validated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single() as any);

    if (error) throw error;

    const payment = mapPaymentRowToPayment(row as TournamentPaymentRow);

    // Mettre à jour le statut de l'équipe
    await (supabaseAdmin ?? supabase)
      .from('tournament_teams')
      .update({ status: 'rejected' })
      .eq('tournament_id', payment.tournamentId)
      .eq('team_id', payment.teamId);

    // Logger la raison du rejet si fournie
    if (reason) {
      await supabase.from('payment_logs').insert({
        payment_id: paymentId,
        action: 'rejected_with_reason',
        performed_by: adminId,
        details: { reason },
      });
    }

    return payment;
  },

  /**
   * Récupérer les logs d'un paiement
   */
  async getPaymentLogs(paymentId: string): Promise<PaymentLog[]> {
    console.log('[PaymentsAPI] Getting logs for payment:', paymentId);
    const { data, error } = await (supabase
      .from('payment_logs')
      .select('*')
      .eq('payment_id', paymentId)
      .order('timestamp', { ascending: false }) as any);

    if (error) throw error;
    return ((data || []) as PaymentLogRow[]).map(mapLogRowToLog);
  },

  /**
   * Annuler les paiements expirés (CRON/ADMIN)
   */
  async cancelExpiredPayments(): Promise<number> {
    console.log('[PaymentsAPI] Cancelling expired payments');
    const client = (supabaseAdmin ?? supabase) as typeof supabase;

    // Appeler la fonction SQL
    const { error } = await client.rpc('cancel_expired_payments' as any);
    if (error) throw error;

    // Compter combien ont été annulés
    const { count } = await supabase
      .from('tournament_payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'rejected')
      .gte('payment_deadline', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return count || 0;
  },
};

// =============================================
// API TOURNAMENT PAYOUT REQUESTS
// =============================================

export const tournamentPayoutRequestsApi = {
  async createRequest(data: {
    tournamentId: string;
    organizerId: string;
    requestedAmount: number;
    purposeCategory: 'venue' | 'referees' | 'logistics' | 'communication' | 'prize' | 'other';
    reason: string;
    useOfFunds: string;
    budgetBreakdown: string;
    amountAlreadySpent: number;
    neededBy?: string;
    supportingEvidence?: string;
    fallbackContact?: string;
    urgency: 'low' | 'medium' | 'high';
    payoutPhone: string;
  }): Promise<TournamentPayoutRequest> {
    const { data: row, error } = await (supabase
      .from('tournament_payout_requests')
      .insert({
        tournament_id: data.tournamentId,
        organizer_id: data.organizerId,
        requested_amount: data.requestedAmount,
        purpose_category: data.purposeCategory,
        reason: data.reason,
        use_of_funds: data.useOfFunds,
        budget_breakdown: data.budgetBreakdown,
        amount_already_spent: data.amountAlreadySpent,
        needed_by: data.neededBy || null,
        supporting_evidence: data.supportingEvidence || null,
        fallback_contact: data.fallbackContact || null,
        urgency: data.urgency,
        payout_phone: data.payoutPhone,
        status: 'pending',
      })
      .select('*')
      .single() as any);

    if (error) throw error;
    return mapPayoutRequestRowToRequest(row as TournamentPayoutRequestRow);
  },

  async getOrganizerRequests(organizerId: string): Promise<TournamentPayoutRequest[]> {
    const { data, error } = await (supabase
      .from('tournament_payout_requests')
      .select('*')
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false }) as any);

    if (error) throw error;
    return ((data || []) as TournamentPayoutRequestRow[]).map(mapPayoutRequestRowToRequest);
  },

  async getTournamentRequests(tournamentId: string): Promise<TournamentPayoutRequest[]> {
    const { data, error } = await (supabase
      .from('tournament_payout_requests')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false }) as any);

    if (error) throw error;
    return ((data || []) as TournamentPayoutRequestRow[]).map(mapPayoutRequestRowToRequest);
  },

  async getPendingRequests(): Promise<TournamentPayoutRequest[]> {
    const { data, error } = await (supabase
      .from('tournament_payout_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }) as any);

    if (error) throw error;
    return ((data || []) as TournamentPayoutRequestRow[]).map(mapPayoutRequestRowToRequest);
  },

  async approveRequest(requestId: string, adminId: string, adminNote?: string): Promise<TournamentPayoutRequest> {
    const client = (supabaseAdmin ?? supabase) as typeof supabase;
    const { data, error } = await (client
      .from('tournament_payout_requests')
      .update({
        status: 'approved',
        admin_note: adminNote || null,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select('*')
      .single() as any);

    if (error) throw error;
    return mapPayoutRequestRowToRequest(data as TournamentPayoutRequestRow);
  },

  async rejectRequest(requestId: string, adminId: string, adminNote?: string): Promise<TournamentPayoutRequest> {
    const client = (supabaseAdmin ?? supabase) as typeof supabase;
    const { data, error } = await (client
      .from('tournament_payout_requests')
      .update({
        status: 'rejected',
        admin_note: adminNote || null,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select('*')
      .single() as any);

    if (error) throw error;
    return mapPayoutRequestRowToRequest(data as TournamentPayoutRequestRow);
  },
};

// =============================================
// API TOURNAMENT TEAMS
// =============================================

export const tournamentTeamsApi = {
  /**
   * Inscrire une équipe à un tournoi
   */
  async registerTeam(tournamentId: string, teamId: string): Promise<TournamentTeam> {
    console.log('[TournamentTeamsAPI] Registering team:', teamId, 'to tournament:', tournamentId);

    // Vérifier qu'il y a des places disponibles
    const { data: hasSpots, error: spotsError } = await (supabase
      .rpc('has_available_spots', { p_tournament_id: tournamentId }) as any);

    if (spotsError) throw spotsError;
    if (!hasSpots) throw new Error('Tournoi complet');

    const { data: row, error } = await (supabase
      .from('tournament_teams')
      .insert({
        tournament_id: tournamentId,
        team_id: teamId,
        status: 'pending_payment',
      })
      .select()
      .single() as any);

    if (error) throw error;
    return mapTournamentTeamRowToTournamentTeam(row as TournamentTeamRow);
  },

  /**
   * Récupérer toutes les équipes d'un tournoi avec leurs statuts
   */
  async getTournamentTeams(tournamentId: string): Promise<TournamentTeam[]> {
    if (tournamentId === DEMO_TOURNAMENT_ID) {
      return DEMO_TEAMS.map((t, i) => ({
        id: `demo-tt-${i}`,
        tournamentId,
        teamId: t.id,
        status: 'confirmed' as TournamentTeamStatus,
        registeredAt: new Date(),
      }));
    }
    console.log('[TournamentTeamsAPI] Getting teams for tournament:', tournamentId);
    const { data, error } = await (supabase
      .from('tournament_teams')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('registered_at', { ascending: true }) as any);

    if (error) throw error;
    return ((data || []) as TournamentTeamRow[]).map(mapTournamentTeamRowToTournamentTeam);
  },

  /**
   * Récupérer le statut d'une équipe dans un tournoi
   */
  async getTeamStatus(tournamentId: string, teamId: string): Promise<TournamentTeam | null> {
    console.log('[TournamentTeamsAPI] Getting team status:', teamId, 'in tournament:', tournamentId);
    const { data, error } = await (supabase
      .from('tournament_teams')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('team_id', teamId)
      .single() as any);

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data ? mapTournamentTeamRowToTournamentTeam(data as TournamentTeamRow) : null;
  },

  /**
   * Désinscrire une équipe d'un tournoi
   */
  async unregisterTeam(tournamentId: string, teamId: string): Promise<void> {
    console.log('[TournamentTeamsAPI] Unregistering team:', teamId, 'from tournament:', tournamentId);

    // Supprimer l'inscription
    const { error } = await supabase
      .from('tournament_teams')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('team_id', teamId);

    if (error) throw error;

    // Le paiement sera automatiquement supprimé via CASCADE
  },

  /**
   * Compter les places réservées (confirmées + en attente de validation)
   */
  async countReservedSpots(tournamentId: string): Promise<number> {
    const { data, error } = await (supabase
      .rpc('count_reserved_spots', { p_tournament_id: tournamentId }) as any);

    if (error) throw error;
    return data || 0;
  },
};
