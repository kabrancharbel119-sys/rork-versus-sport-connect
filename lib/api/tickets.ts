import { supabase, supabaseAdmin } from '@/lib/supabase';
import { notificationsApi } from '@/lib/api/notifications';
import type { Ticket, TicketType, TicketSalesStats, TicketEventType } from '@/types';

// =============================================
// ROW TYPES
// =============================================

interface TicketTypeRow {
  id: string;
  event_type: string;
  event_id: string;
  name: string;
  description: string | null;
  price: number;
  quantity_total: number;
  quantity_sold: number;
  sales_start: string | null;
  sales_end: string | null;
  max_per_user: number;
  is_active: boolean;
  valid_days: string[] | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface TicketRow {
  id: string;
  ticket_type_id: string;
  event_type: string;
  event_id: string;
  buyer_id: string;
  holder_name: string | null;
  price_paid: number;
  status: string;
  ticket_code: string;
  qr_token: string;
  payment_transaction_id: string | null;
  purchased_at: string;
  paid_at: string | null;
  used_at: string | null;
  validated_by: string | null;
  cancelled_at: string | null;
  created_at: string;
  ticket_type?: TicketTypeRow;
}

// =============================================
// MAPPERS
// =============================================

const mapTicketTypeRow = (row: TicketTypeRow): TicketType => ({
  id: row.id,
  eventType: row.event_type as TicketEventType,
  eventId: row.event_id,
  name: row.name,
  description: row.description || undefined,
  price: row.price,
  quantityTotal: row.quantity_total,
  quantitySold: row.quantity_sold,
  salesStart: row.sales_start ? new Date(row.sales_start) : undefined,
  salesEnd: row.sales_end ? new Date(row.sales_end) : undefined,
  maxPerUser: row.max_per_user,
  isActive: row.is_active,
  validDays: row.valid_days ?? null,
  createdBy: row.created_by,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

const mapTicketRow = (row: TicketRow): Ticket => ({
  id: row.id,
  ticketTypeId: row.ticket_type_id,
  ticketType: row.ticket_type ? mapTicketTypeRow(row.ticket_type) : undefined,
  eventType: row.event_type as TicketEventType,
  eventId: row.event_id,
  buyerId: row.buyer_id,
  holderName: row.holder_name || undefined,
  pricePaid: row.price_paid,
  status: row.status as Ticket['status'],
  ticketCode: row.ticket_code,
  qrToken: row.qr_token,
  paymentTransactionId: row.payment_transaction_id || undefined,
  purchasedAt: new Date(row.purchased_at),
  paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
  usedAt: row.used_at ? new Date(row.used_at) : undefined,
  validatedBy: row.validated_by || undefined,
  cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : undefined,
  createdAt: new Date(row.created_at),
});

// =============================================
// API
// =============================================

export const ticketsApi = {
  // ---------- TYPES DE BILLETS (ORGANISATEUR) ----------

  async createTicketType(data: {
    eventType: TicketEventType;
    eventId: string;
    name: string;
    description?: string;
    price: number;
    quantityTotal: number;
    salesStart?: Date;
    salesEnd?: Date;
    maxPerUser?: number;
    validDays?: string[] | null;
    createdBy: string;
  }): Promise<TicketType> {
    console.log('[TicketsAPI] Creating ticket type for', data.eventType, data.eventId);
    const { data: row, error } = await (supabase
      .from('ticket_types')
      .insert({
        event_type: data.eventType,
        event_id: data.eventId,
        name: data.name,
        description: data.description ?? null,
        price: data.price,
        quantity_total: data.quantityTotal,
        sales_start: data.salesStart?.toISOString() ?? null,
        sales_end: data.salesEnd?.toISOString() ?? null,
        max_per_user: data.maxPerUser ?? 10,
        valid_days: data.validDays ?? null,
        created_by: data.createdBy,
      } as any)
      .select()
      .single() as any);

    if (error) throw error;
    return mapTicketTypeRow(row as TicketTypeRow);
  },

  async updateTicketType(ticketTypeId: string, updates: {
    name?: string;
    description?: string;
    price?: number;
    quantityTotal?: number;
    salesStart?: Date | null;
    salesEnd?: Date | null;
    maxPerUser?: number;
    isActive?: boolean;
    validDays?: string[] | null;
  }): Promise<TicketType> {
    console.log('[TicketsAPI] Updating ticket type:', ticketTypeId);
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.price !== undefined) payload.price = updates.price;
    if (updates.quantityTotal !== undefined) payload.quantity_total = updates.quantityTotal;
    if (updates.salesStart !== undefined) payload.sales_start = updates.salesStart?.toISOString() ?? null;
    if (updates.salesEnd !== undefined) payload.sales_end = updates.salesEnd?.toISOString() ?? null;
    if (updates.maxPerUser !== undefined) payload.max_per_user = updates.maxPerUser;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    if (updates.validDays !== undefined) payload.valid_days = updates.validDays;

    const { data: row, error } = await ((supabase.from('ticket_types') as any)
      .update(payload)
      .eq('id', ticketTypeId)
      .select()
      .single());

    if (error) throw error;
    return mapTicketTypeRow(row as TicketTypeRow);
  },

  async deleteTicketType(ticketTypeId: string): Promise<void> {
    console.log('[TicketsAPI] Deleting ticket type:', ticketTypeId);
    const { error } = await (supabase
      .from('ticket_types')
      .delete()
      .eq('id', ticketTypeId) as any);
    if (error) throw error;
  },

  async getTicketTypesForEvent(eventType: TicketEventType, eventId: string): Promise<TicketType[]> {
    console.log('[TicketsAPI] Getting ticket types for', eventType, eventId);
    const { data, error } = await (supabase
      .from('ticket_types')
      .select('*')
      .eq('event_type', eventType)
      .eq('event_id', eventId)
      .order('price', { ascending: true }) as any);

    if (error) throw error;
    return ((data || []) as TicketTypeRow[]).map(mapTicketTypeRow);
  },

  // ---------- ACHAT ----------

  /**
   * Achat de billets via le RPC atomique (SECURITY DEFINER).
   * - Billets gratuits (ou paiement hors app): initialStatus = 'valid'
   * - Billets payants in-app: initialStatus = 'pending_payment' puis confirmation
   */
  async purchaseTickets(data: {
    ticketTypeId: string;
    buyerId: string;
    quantity: number;
    initialStatus: 'valid' | 'pending_payment';
    paymentTransactionId?: string;
  }): Promise<Ticket[]> {
    console.log('[TicketsAPI] Purchasing', data.quantity, 'ticket(s) of type', data.ticketTypeId);
    const { data: rows, error } = await (supabase.rpc as any)('purchase_tickets', {
      p_ticket_type_id: data.ticketTypeId,
      p_buyer_id: data.buyerId,
      p_quantity: data.quantity,
      p_initial_status: data.initialStatus,
      p_payment_transaction_id: data.paymentTransactionId ?? null,
    });

    if (error) throw error;
    return ((rows || []) as TicketRow[]).map(mapTicketRow);
  },

  /** Attacher une référence de paiement aux billets en attente */
  async attachPaymentTransaction(ticketIds: string[], paymentTransactionId: string): Promise<void> {
    console.log('[TicketsAPI] Attaching payment ref to', ticketIds.length, 'ticket(s)');
    const { error } = await ((supabase.from('tickets') as any)
      .update({ payment_transaction_id: paymentTransactionId })
      .in('id', ticketIds));
    if (error) throw error;
  },

  /** Confirmer les billets après paiement réussi */
  async confirmTicketsPayment(paymentTransactionId: string): Promise<number> {
    console.log('[TicketsAPI] Confirming tickets for payment:', paymentTransactionId);
    const client = (supabaseAdmin ?? supabase) as typeof supabase;
    const { data, error } = await (client.rpc as any)('confirm_ticket_payment', {
      p_payment_transaction_id: paymentTransactionId,
    });
    if (error) throw error;
    return (data as number) ?? 0;
  },

  /** Annuler les billets en attente (paiement échoué) et restituer le stock */
  async cancelPendingTickets(paymentTransactionId: string): Promise<number> {
    console.log('[TicketsAPI] Cancelling pending tickets for payment:', paymentTransactionId);
    const { data, error } = await (supabase.rpc as any)('cancel_pending_tickets', {
      p_payment_transaction_id: paymentTransactionId,
    });
    if (error) throw error;
    return (data as number) ?? 0;
  },

  // ---------- MES BILLETS ----------

  async getMyTickets(userId: string): Promise<Ticket[]> {
    console.log('[TicketsAPI] Getting tickets for user:', userId);
    const { data, error } = await (supabase
      .from('tickets')
      .select('*, ticket_type:ticket_types(*)')
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false }) as any);

    if (error) throw error;
    const tickets = ((data || []) as TicketRow[]).map(mapTicketRow);

    // Enrichir avec les infos événement
    const tournamentIds = [...new Set(tickets.filter(t => t.eventType === 'tournament').map(t => t.eventId))];
    const matchIds = [...new Set(tickets.filter(t => t.eventType === 'match').map(t => t.eventId))];

    const [tournamentsRes, matchesRes] = await Promise.all([
      tournamentIds.length > 0
        ? (supabase.from('tournaments').select('id, name, start_date, venue_data, sport').in('id', tournamentIds) as any)
        : Promise.resolve({ data: [], error: null }),
      matchIds.length > 0
        ? (supabase.from('matches').select('id, sport, date_time, venue_data').in('id', matchIds) as any)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const tournamentMap = new Map<string, { name: string; date: string; location?: string; sport?: string }>();
    (tournamentsRes.data || []).forEach((t: any) => {
      tournamentMap.set(t.id, {
        name: t.name,
        date: t.start_date,
        location: t.venue_data?.city || t.venue_data?.address || undefined,
        sport: t.sport,
      });
    });
    const matchMap = new Map<string, { name: string; date: string; location?: string; sport?: string }>();
    (matchesRes.data || []).forEach((m: any) => {
      matchMap.set(m.id, {
        name: `Match ${m.sport || ''}`.trim(),
        date: m.date_time,
        location: m.venue_data?.city || m.venue_data?.address || undefined,
        sport: m.sport,
      });
    });

    return tickets.map(t => ({
      ...t,
      eventInfo: t.eventType === 'tournament' ? tournamentMap.get(t.eventId) : matchMap.get(t.eventId),
    })) as any;
  },

  async getTicketById(ticketId: string): Promise<Ticket | null> {
    const { data, error } = await (supabase
      .from('tickets')
      .select('*, ticket_type:ticket_types(*)')
      .eq('id', ticketId)
      .single() as any);

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data ? mapTicketRow(data as TicketRow) : null;
  },

  // ---------- VALIDATION (ORGANISATEUR) ----------

  /** Valider un billet via son QR token (scan à l'entrée) */
  async validateTicket(qrToken: string, validatorId: string, expectedEventId?: string, expectedEventType?: string): Promise<{
    success: boolean;
    error?: string;
    ticketCode?: string;
    ticketTypeName?: string;
    ticketTypeDescription?: string;
    buyerName?: string;
    holderName?: string;
    pricePaid?: number;
    eventName?: string;
    eventType?: string;
    eventId?: string;
    eventDate?: string;
    eventLocation?: string;
    usedAt?: string;
  }> {
    console.log('[TicketsAPI] Validating ticket:', qrToken);
    const { data, error } = await (supabase.rpc as any)('validate_ticket', {
      p_qr_token: qrToken,
      p_validator_id: validatorId,
      p_expected_event_id: expectedEventId || null,
      p_expected_event_type: expectedEventType || null,
    });

    if (error) throw error;
    const result = data as any;
    return {
      success: !!result?.success,
      error: result?.error,
      ticketCode: result?.ticket_code,
      ticketTypeName: result?.ticket_type_name,
      ticketTypeDescription: result?.ticket_type_description,
      buyerName: result?.buyer_name,
      holderName: result?.holder_name,
      pricePaid: result?.price_paid,
      eventName: result?.event_name,
      eventType: result?.event_type,
      eventId: result?.event_id,
      eventDate: result?.event_date,
      eventLocation: result?.event_location,
      usedAt: result?.used_at,
    };
  },

  /** Valider un billet par son code manuel (ex: VS-A1B2C3D4) */
  async validateTicketByCode(ticketCode: string, validatorId: string, expectedEventId?: string, expectedEventType?: string) {
    console.log('[TicketsAPI] Validating ticket by code:', ticketCode);
    const { data, error } = await (supabase
      .from('tickets')
      .select('qr_token')
      .eq('ticket_code', ticketCode.trim().toUpperCase())
      .single() as any);

    if (error || !data) {
      return { success: false, error: 'Billet introuvable avec ce code' };
    }
    return this.validateTicket((data as { qr_token: string }).qr_token, validatorId, expectedEventId, expectedEventType);
  },

  // ---------- STATS DE VENTE (ORGANISATEUR) ----------

  async getEventSalesStats(eventType: TicketEventType, eventId: string): Promise<TicketSalesStats> {
    console.log('[TicketsAPI] Getting sales stats for', eventType, eventId);
    const [typesRes, ticketsRes] = await Promise.all([
      (supabase
        .from('ticket_types')
        .select('*')
        .eq('event_type', eventType)
        .eq('event_id', eventId) as any),
      (supabase
        .from('tickets')
        .select('ticket_type_id, status, price_paid')
        .eq('event_type', eventType)
        .eq('event_id', eventId) as any),
    ]);

    if (typesRes.error) throw typesRes.error;
    if (ticketsRes.error) throw ticketsRes.error;

    const types = (typesRes.data || []) as TicketTypeRow[];
    const tickets = (ticketsRes.data || []) as { ticket_type_id: string; status: string; price_paid: number }[];

    const activeTickets = tickets.filter(t => t.status === 'valid' || t.status === 'used');
    const byType = types.map(tt => {
      const typeTickets = activeTickets.filter(t => t.ticket_type_id === tt.id);
      return {
        ticketTypeId: tt.id,
        name: tt.name,
        sold: typeTickets.length,
        total: tt.quantity_total,
        used: typeTickets.filter(t => t.status === 'used').length,
        revenue: typeTickets.reduce((sum, t) => sum + (t.price_paid || 0), 0),
      };
    });

    return {
      totalSold: activeTickets.length,
      totalUsed: activeTickets.filter(t => t.status === 'used').length,
      totalRevenue: activeTickets.reduce((sum, t) => sum + (t.price_paid || 0), 0),
      byType,
    };
  },

  /** Liste des billets vendus pour un événement (organisateur) */
  async getEventTickets(eventType: TicketEventType, eventId: string): Promise<Ticket[]> {
    const { data, error } = await (supabase
      .from('tickets')
      .select('*, ticket_type:ticket_types(*)')
      .eq('event_type', eventType)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false }) as any);

    if (error) throw error;
    return ((data || []) as TicketRow[]).map(mapTicketRow);
  },

  // ---------- HISTORIQUE DES SCANS (ORGANISATEUR) ----------

  /** Historique des billets scannés par un organisateur */
  async getScanHistory(organizerId: string, eventType?: string, eventId?: string): Promise<{
    id: string;
    ticketCode: string;
    ticketTypeName: string;
    buyerName: string;
    holderName?: string;
    pricePaid: number;
    status: string;
    eventType: string;
    eventId: string;
    usedAt?: string;
    purchasedAt: string;
  }[]> {
    console.log('[TicketsAPI] Getting scan history for organizer:', organizerId);
    const { data, error } = await (supabase.rpc as any)('get_organizer_scan_history', {
      p_organizer_id: organizerId,
      p_event_type: eventType ?? null,
      p_event_id: eventId ?? null,
    });

    if (error) throw error;
    return (data || []) as any[];
  },

  /**
   * Génère (ou récupère) la facture pour un lot de billets déjà achetés
   * (référence de paiement partagée, y compris pour les billets gratuits).
   */
  async createInvoiceForPurchase(paymentTransactionId: string): Promise<void> {
    try {
      const { error } = await (supabase.rpc as any)('create_invoice_for_ticket_purchase', {
        p_payment_transaction_id: paymentTransactionId,
      });
      if (error) throw error;
    } catch (e) {
      console.warn('[TicketsAPI] Invoice creation for purchase failed (non-blocking):', (e as Error)?.message ?? e);
    }
  },

  // ---------- NOTIFICATION ----------

  async notifyPurchase(buyerId: string, eventName: string, quantity: number): Promise<void> {
    try {
      await notificationsApi.send(buyerId, {
        type: 'system',
        title: '🎟️ Billets confirmés',
        message: `Vos ${quantity > 1 ? `${quantity} billets` : 'billet'} pour ${eventName} ${quantity > 1 ? 'sont confirmés' : 'est confirmé'}. Retrouvez-les dans "Mes billets".`,
        data: { route: '/my-tickets' },
      });
    } catch (e) {
      console.warn('[TicketsAPI] Purchase notification failed:', (e as Error)?.message ?? e);
    }
  },
};
