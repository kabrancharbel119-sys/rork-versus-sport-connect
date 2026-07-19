import { supabase, supabaseAdmin } from '@/lib/supabase';
import type {
  TournamentFundsLedgerEntry,
  TournamentFundsSummary,
  TournamentDispute,
  FundsLedgerEntryType,
  DisputeSeverity,
  DisputeStatus,
} from '@/types';

// =============================================
// RÈGLES ANTI-FRAUDE (configurables)
// =============================================

export const FUNDS_RULES = {
  /** Taux de remplissage minimum (%) pour débloquer une avance logistique */
  minFillRateForLogisticsAdvance: 50,
  /** Plafond (%) des fonds nets encaissés pour une avance logistique */
  maxLogisticsAdvancePercent: 30,
  /** Délai (heures) après la fin du tournoi avant libération du solde organisateur */
  organizerFundsLockHours: 24,
};

// =============================================
// TYPES POUR LES ROWS DE LA DB
// =============================================

interface FundsLedgerRow {
  id: string;
  tournament_id: string;
  entry_type: string;
  amount: number;
  reference_type: string | null;
  reference_id: string | null;
  performed_by: string | null;
  note: string | null;
  created_at: string;
}

interface DisputeRow {
  id: string;
  tournament_id: string;
  reported_by: string;
  severity: string;
  reason: string;
  status: string;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

// =============================================
// MAPPERS
// =============================================

function mapLedgerRow(row: FundsLedgerRow): TournamentFundsLedgerEntry {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    entryType: row.entry_type as FundsLedgerEntryType,
    amount: row.amount,
    referenceType: row.reference_type || undefined,
    referenceId: row.reference_id || undefined,
    performedBy: row.performed_by || undefined,
    note: row.note || undefined,
    createdAt: new Date(row.created_at),
  };
}

function mapDisputeRow(row: DisputeRow): TournamentDispute {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    reportedBy: row.reported_by,
    severity: row.severity as DisputeSeverity,
    reason: row.reason,
    status: row.status as DisputeStatus,
    resolutionNote: row.resolution_note || undefined,
    resolvedBy: row.resolved_by || undefined,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
    createdAt: new Date(row.created_at),
  };
}

// =============================================
// API LEDGER DES FONDS TOURNOI
// =============================================

export const tournamentFundsApi = {
  /**
   * Ajouter une écriture au ledger (ADMIN/BACKEND uniquement).
   * Convention: montant positif = entrée, négatif = sortie.
   */
  async addLedgerEntry(data: {
    tournamentId: string;
    entryType: FundsLedgerEntryType;
    amount: number;
    referenceType?: string;
    referenceId?: string;
    performedBy?: string;
    note?: string;
  }): Promise<TournamentFundsLedgerEntry> {
    console.log('[FundsAPI] Adding ledger entry:', data.entryType, data.amount, 'for tournament:', data.tournamentId);

    // Cohérence des signes selon le type d'écriture
    const outflowTypes: FundsLedgerEntryType[] = ['refund', 'venue_advance', 'logistics_advance', 'platform_fee', 'organizer_release'];
    const normalizedAmount = outflowTypes.includes(data.entryType)
      ? -Math.abs(data.amount)
      : Math.abs(data.amount);

    const client = (supabaseAdmin ?? supabase) as typeof supabase;
    const { data: row, error } = await (client
      .from('tournament_funds_ledger')
      .insert({
        tournament_id: data.tournamentId,
        entry_type: data.entryType,
        amount: normalizedAmount,
        reference_type: data.referenceType || null,
        reference_id: data.referenceId || null,
        performed_by: data.performedBy || null,
        note: data.note || null,
      })
      .select('*')
      .single() as any);

    if (error) throw error;
    return mapLedgerRow(row as FundsLedgerRow);
  },

  /**
   * Récupérer toutes les écritures d'un tournoi
   */
  async getLedger(tournamentId: string): Promise<TournamentFundsLedgerEntry[]> {
    const { data, error } = await (supabase
      .from('tournament_funds_ledger')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false }) as any);

    if (error) throw error;
    return ((data || []) as FundsLedgerRow[]).map(mapLedgerRow);
  },

  /**
   * Résumé financier d'un tournoi (via fonctions SQL + règles locales)
   */
  async getFundsSummary(tournamentId: string): Promise<TournamentFundsSummary> {
    console.log('[FundsAPI] Getting funds summary for tournament:', tournamentId);

    const [netRes, advancedRes, fillRes, releaseRes] = await Promise.all([
      (supabase.rpc('get_tournament_net_collected', { p_tournament_id: tournamentId }) as any),
      (supabase.rpc('get_tournament_total_advanced', { p_tournament_id: tournamentId }) as any),
      (supabase.rpc('get_tournament_fill_rate', { p_tournament_id: tournamentId }) as any),
      (supabase.rpc('can_release_organizer_funds', { p_tournament_id: tournamentId }) as any),
    ]);

    if (netRes.error) throw netRes.error;
    if (advancedRes.error) throw advancedRes.error;
    if (fillRes.error) throw fillRes.error;
    if (releaseRes.error) throw releaseRes.error;

    const netCollected = (netRes.data as number) ?? 0;
    const totalAdvanced = (advancedRes.data as number) ?? 0;
    const fillRatePercent = (fillRes.data as number) ?? 0;

    // Plafond logistique = 30% du net encaissé - avances déjà versées
    const maxLogistics = Math.floor((netCollected * FUNDS_RULES.maxLogisticsAdvancePercent) / 100);
    const availableForLogisticsAdvance = Math.max(0, maxLogistics - totalAdvanced);

    return {
      tournamentId,
      netCollected,
      totalAdvanced,
      availableForLogisticsAdvance,
      fillRatePercent,
      canReleaseOrganizerFunds: (releaseRes.data as boolean) ?? false,
    };
  },

  /**
   * Valider une demande d'avance selon les règles anti-fraude.
   * Retourne { allowed, reason } sans lever d'exception.
   */
  async validateAdvanceRequest(data: {
    tournamentId: string;
    purposeCategory: string;
    requestedAmount: number;
    organizerId: string;
    venueId?: string;
  }): Promise<{ allowed: boolean; reason?: string }> {
    const isVenueAdvance = data.purposeCategory === 'venue';

    if (isVenueAdvance) {
      // Une avance terrain doit référencer le terrain lié au tournoi
      if (!data.venueId) {
        return { allowed: false, reason: 'Une avance pour le terrain doit être liée au terrain du tournoi.' };
      }

      const { data: venueRow, error: venueError } = await (supabase
        .from('venues')
        .select('id, owner_id, payment_mode')
        .eq('id', data.venueId)
        .single() as any);

      if (venueError || !venueRow) {
        return { allowed: false, reason: 'Terrain introuvable.' };
      }

      // Un organisateur propriétaire du terrain n'a pas besoin d'avance terrain
      if (venueRow.owner_id === data.organizerId) {
        return { allowed: false, reason: 'Vous êtes le gestionnaire de ce terrain : aucune avance terrain n’est nécessaire.' };
      }

      // Le paiement direct au terrain nécessite un terrain en mode paiement in-app
      if (venueRow.payment_mode === 'cash_off_app') {
        return { allowed: false, reason: 'Ce terrain n’accepte pas les paiements via l’application. L’avance terrain directe n’est pas disponible.' };
      }

      return { allowed: true };
    }

    // Avance logistique : règles de seuil et plafond
    const summary = await this.getFundsSummary(data.tournamentId);

    if (summary.fillRatePercent < FUNDS_RULES.minFillRateForLogisticsAdvance) {
      return {
        allowed: false,
        reason: `Le tournoi doit être rempli à au moins ${FUNDS_RULES.minFillRateForLogisticsAdvance}% (actuellement ${summary.fillRatePercent}%) pour demander une avance logistique.`,
      };
    }

    if (data.requestedAmount > summary.availableForLogisticsAdvance) {
      return {
        allowed: false,
        reason: `Montant trop élevé. Maximum disponible : ${summary.availableForLogisticsAdvance.toLocaleString()} FCFA (${FUNDS_RULES.maxLogisticsAdvancePercent}% des fonds encaissés, moins les avances déjà versées).`,
      };
    }

    return { allowed: true };
  },
};

// =============================================
// API LITIGES TOURNOI
// =============================================

export const tournamentDisputesApi = {
  /**
   * Signaler un litige (capitaine d'une équipe inscrite)
   */
  async createDispute(data: {
    tournamentId: string;
    reportedBy: string;
    severity: DisputeSeverity;
    reason: string;
  }): Promise<TournamentDispute> {
    console.log('[DisputesAPI] Creating dispute for tournament:', data.tournamentId);
    const { data: row, error } = await (supabase
      .from('tournament_disputes')
      .insert({
        tournament_id: data.tournamentId,
        reported_by: data.reportedBy,
        severity: data.severity,
        reason: data.reason,
        status: 'open',
      })
      .select('*')
      .single() as any);

    if (error) throw error;
    return mapDisputeRow(row as DisputeRow);
  },

  /**
   * Litiges d'un tournoi
   */
  async getTournamentDisputes(tournamentId: string): Promise<TournamentDispute[]> {
    const { data, error } = await (supabase
      .from('tournament_disputes')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false }) as any);

    if (error) throw error;
    return ((data || []) as DisputeRow[]).map(mapDisputeRow);
  },

  /**
   * Litiges ouverts (ADMIN)
   */
  async getOpenDisputes(): Promise<TournamentDispute[]> {
    const client = (supabaseAdmin ?? supabase) as typeof supabase;
    const { data, error } = await (client
      .from('tournament_disputes')
      .select('*')
      .in('status', ['open', 'investigating'])
      .order('created_at', { ascending: true }) as any);

    if (error) throw error;
    return ((data || []) as DisputeRow[]).map(mapDisputeRow);
  },

  /**
   * Mettre à jour le statut d'un litige (ADMIN)
   */
  async updateDisputeStatus(
    disputeId: string,
    adminId: string,
    status: DisputeStatus,
    resolutionNote?: string
  ): Promise<TournamentDispute> {
    const client = (supabaseAdmin ?? supabase) as typeof supabase;
    const payload: Record<string, unknown> = { status };
    if (status === 'resolved') {
      payload.resolved_by = adminId;
      payload.resolved_at = new Date().toISOString();
      payload.resolution_note = resolutionNote || null;
    }

    const { data: row, error } = await (client
      .from('tournament_disputes')
      .update(payload)
      .eq('id', disputeId)
      .select('*')
      .single() as any);

    if (error) throw error;
    return mapDisputeRow(row as DisputeRow);
  },
};
