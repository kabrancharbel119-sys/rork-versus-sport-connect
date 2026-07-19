import { supabase, supabaseAdmin } from '@/lib/supabase';
import type {
  Invoice,
  InvoiceDocumentType,
  InvoiceContextType,
  InvoiceStatus,
} from '@/types';

// =============================================
// TYPES POUR LES ROWS DE LA DB
// =============================================

interface InvoiceRow {
  id: string;
  invoice_number: string;
  document_type: string;
  context_type: string;
  context_id: string;
  amount: number;
  currency: string;
  payer_id: string | null;
  beneficiary_id: string | null;
  description: string;
  payment_method: string | null;
  payment_transaction_id: string | null;
  status: string;
  issued_at: string;
  paid_at: string | null;
  metadata: Record<string, any> | null;
  payer_name: string | null;
  payee_name: string | null;
  event_name: string | null;
  reason: string | null;
  created_at: string;
}

// =============================================
// MAPPER
// =============================================

function mapInvoiceRow(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    documentType: row.document_type as InvoiceDocumentType,
    contextType: row.context_type as InvoiceContextType,
    contextId: row.context_id,
    amount: row.amount,
    currency: row.currency,
    payerId: row.payer_id || undefined,
    beneficiaryId: row.beneficiary_id || undefined,
    description: row.description,
    paymentMethod: row.payment_method || undefined,
    paymentTransactionId: row.payment_transaction_id || undefined,
    status: row.status as InvoiceStatus,
    issuedAt: new Date(row.issued_at),
    paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
    metadata: row.metadata || undefined,
    payerName: row.payer_name || undefined,
    payeeName: row.payee_name || undefined,
    eventName: row.event_name || undefined,
    reason: row.reason || undefined,
    createdAt: new Date(row.created_at),
  };
}

// =============================================
// API FACTURES
// =============================================

export const invoicesApi = {
  /**
   * Créer une facture / reçu / avoir (ADMIN/BACKEND).
   * Le numéro est généré côté DB via generate_invoice_number().
   */
  async createInvoice(data: {
    documentType: InvoiceDocumentType;
    contextType: InvoiceContextType;
    contextId: string;
    amount: number;
    payerId?: string;
    beneficiaryId?: string;
    description: string;
    paymentMethod?: string;
    paymentTransactionId?: string;
    status?: InvoiceStatus;
    metadata?: Record<string, any>;
  }): Promise<Invoice> {
    console.log('[InvoicesAPI] Creating', data.documentType, 'for', data.contextType, data.contextId);
    const client = (supabaseAdmin ?? supabase) as typeof supabase;

    // Préfixe selon le type de document
    const prefix = data.documentType === 'credit_note' ? 'AVR' : data.documentType === 'payout_receipt' ? 'REC' : 'INV';
    const { data: numberData, error: numberError } = await (client
      .rpc('generate_invoice_number', { p_prefix: prefix }) as any);

    if (numberError) throw numberError;
    const invoiceNumber = numberData as string;

    const now = new Date().toISOString();
    const { data: row, error } = await (client
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        document_type: data.documentType,
        context_type: data.contextType,
        context_id: data.contextId,
        amount: data.amount,
        currency: 'XOF',
        payer_id: data.payerId || null,
        beneficiary_id: data.beneficiaryId || null,
        description: data.description,
        payment_method: data.paymentMethod || null,
        payment_transaction_id: data.paymentTransactionId || null,
        status: data.status ?? 'issued',
        issued_at: now,
        paid_at: data.status === 'paid' ? now : null,
        metadata: data.metadata || {},
      })
      .select('*')
      .single() as any);

    if (error) throw error;
    return mapInvoiceRow(row as InvoiceRow);
  },

  /**
   * Créer un avoir (credit note) lié à une facture existante (remboursement)
   */
  async createCreditNote(originalInvoiceId: string, adminId: string, reason?: string): Promise<Invoice> {
    console.log('[InvoicesAPI] Creating credit note for invoice:', originalInvoiceId);
    const client = (supabaseAdmin ?? supabase) as typeof supabase;

    const { data: original, error: fetchError } = await (client
      .from('invoices')
      .select('*')
      .eq('id', originalInvoiceId)
      .single() as any);

    if (fetchError || !original) throw fetchError ?? new Error('Facture originale introuvable');

    // Marquer la facture originale comme remboursée
    await (client
      .from('invoices')
      .update({ status: 'refunded' })
      .eq('id', originalInvoiceId) as any);

    return this.createInvoice({
      documentType: 'credit_note',
      contextType: original.context_type,
      contextId: original.context_id,
      amount: original.amount,
      payerId: original.payer_id || undefined,
      beneficiaryId: original.beneficiary_id || undefined,
      description: reason || `Avoir sur facture ${original.invoice_number}`,
      paymentMethod: original.payment_method || undefined,
      status: 'issued',
      metadata: { originalInvoiceId, originalInvoiceNumber: original.invoice_number, createdBy: adminId },
    });
  },

  /**
   * Récupérer une facture par son ID
   */
  async getInvoiceById(invoiceId: string): Promise<Invoice> {
    const { data, error } = await (supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single() as any);

    if (error) throw error;
    if (!data) throw new Error('Facture introuvable.');
    return mapInvoiceRow(data as InvoiceRow);
  },

  /**
   * Factures d'un utilisateur (payeur OU bénéficiaire)
   */
  async getUserInvoices(userId: string): Promise<Invoice[]> {
    const { data, error } = await (supabase
      .from('invoices')
      .select('*')
      .or(`payer_id.eq.${userId},beneficiary_id.eq.${userId}`)
      .order('created_at', { ascending: false }) as any);

    if (error) throw error;
    return ((data || []) as InvoiceRow[]).map(mapInvoiceRow);
  },

  /**
   * Factures où l'utilisateur est le payeur (réservations de l'utilisateur)
   */
  async getPayerInvoices(userId: string): Promise<Invoice[]> {
    const { data, error } = await (supabase
      .from('invoices')
      .select('*')
      .eq('payer_id', userId)
      .order('created_at', { ascending: false }) as any);

    if (error) throw error;
    return ((data || []) as InvoiceRow[]).map(mapInvoiceRow);
  },

  /**
   * Factures liées à un contexte (booking, tournoi, avance...)
   */
  async getByContext(contextType: InvoiceContextType, contextId: string): Promise<Invoice[]> {
    const { data, error } = await (supabase
      .from('invoices')
      .select('*')
      .eq('context_type', contextType)
      .eq('context_id', contextId)
      .order('created_at', { ascending: false }) as any);

    if (error) throw error;
    return ((data || []) as InvoiceRow[]).map(mapInvoiceRow);
  },

  /**
   * Toutes les factures (ADMIN)
   */
  async getAll(limit: number = 100): Promise<Invoice[]> {
    const client = (supabaseAdmin ?? supabase) as typeof supabase;
    const { data, error } = await (client
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit) as any);

    if (error) throw error;
    return ((data || []) as InvoiceRow[]).map(mapInvoiceRow);
  },

  /**
   * Marquer une facture comme payée
   */
  async markPaid(invoiceId: string, transactionId?: string): Promise<Invoice> {
    const client = (supabaseAdmin ?? supabase) as typeof supabase;
    const { data: row, error } = await (client
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        ...(transactionId ? { payment_transaction_id: transactionId } : {}),
      })
      .eq('id', invoiceId)
      .select('*')
      .single() as any);

    if (error) throw error;
    return mapInvoiceRow(row as InvoiceRow);
  },
};
