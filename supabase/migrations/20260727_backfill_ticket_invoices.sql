-- =============================================================
-- FIX: Backfill invoices/receipts for tickets purchased BEFORE
-- the invoice-generation fix was in place (paid tickets that
-- never got an invoice, and free tickets bought without any
-- payment_transaction_id reference).
--
-- SAFE: no DELETE, no DROP. Only:
--   - UPDATE tickets.payment_transaction_id for legacy free
--     tickets that have none (needed to group/link them to an
--     invoice), each ticket gets a unique synthetic reference.
--   - INSERT missing invoices via the existing SECURITY DEFINER
--     function create_invoice_for_ticket_purchase().
-- Idempotent: safe to run multiple times, skips tickets/refs
-- that already have a matching invoice.
-- =============================================================

DO $$
DECLARE
  r RECORD;
  v_ref TEXT;
BEGIN
  -- 1) Tickets already tied to a payment_transaction_id (paid or
  --    already-referenced free batches) but missing their invoice.
  FOR r IN
    SELECT DISTINCT tk.payment_transaction_id AS ref
    FROM public.tickets tk
    WHERE tk.payment_transaction_id IS NOT NULL
      AND tk.status = 'valid'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.context_type = 'ticket_purchase' AND i.context_id = r.ref
    ) THEN
      PERFORM public.create_invoice_for_ticket_purchase(r.ref);
    END IF;
  END LOOP;

  -- 2) Legacy free tickets with no payment_transaction_id at all:
  --    assign a unique synthetic reference per ticket, then generate
  --    its receipt (amount = 0, status = 'paid').
  FOR r IN
    SELECT id FROM public.tickets
    WHERE payment_transaction_id IS NULL
      AND status = 'valid'
  LOOP
    v_ref := 'LEGACY-' || r.id::TEXT;
    IF NOT EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.context_type = 'ticket_purchase' AND i.context_id = v_ref
    ) THEN
      UPDATE public.tickets SET payment_transaction_id = v_ref WHERE id = r.id;
      PERFORM public.create_invoice_for_ticket_purchase(v_ref);
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  -- Never fail the migration; invoice backfill is best-effort.
  NULL;
END $$;
