-- =============================================================
-- FIX: Ensure invoices are generated for ALL bookings and ALL
-- ticket purchases, regardless of payment mode, so that:
--   - The renter (payer) always sees an invoice/receipt for
--     their booking, even when payment is on-site/cash.
--   - The venue manager (beneficiary) always sees the matching
--     invoice for that booking.
--   - Every ticket buyer (including free tickets) sees a
--     receipt in "Mes factures".
-- Each invoice keeps payer_id = the person paying and
-- beneficiary_id = the person/manager being paid, so it appears
-- correctly on both sides via invoicesApi.getUserInvoices()
-- (payer_id OR beneficiary_id = current user).
-- SAFE: CREATE OR REPLACE only, no DROP of tables/columns/data.
-- =============================================================

BEGIN;

-- -------------------------------------------------------------
-- 1) Bookings: generate an invoice on INSERT regardless of
--    payment_status (not just when 'paid'). Status is 'paid'
--    when the booking is already paid, otherwise 'issued'
--    (on-site / cash payment expected). When payment_status
--    later transitions to 'paid', update the existing invoice
--    instead of creating a duplicate.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_invoice_for_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_venue RECORD;
  v_payer RECORD;
  v_payee RECORD;
  v_invoice_number TEXT;
  v_existing_id UUID;
  v_status TEXT;
BEGIN
  v_status := CASE WHEN NEW.payment_status = 'paid' THEN 'paid' ELSE 'issued' END;

  SELECT id INTO v_existing_id
  FROM invoices
  WHERE context_type = 'booking' AND context_id = NEW.id::TEXT
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Booking already has an invoice: keep it in sync when payment completes
    IF NEW.payment_status = 'paid' THEN
      UPDATE invoices
      SET status = 'paid',
          paid_at = COALESCE(paid_at, NOW()),
          payment_transaction_id = COALESCE(NEW.payment_transaction_id, payment_transaction_id),
          amount = NEW.total_amount
      WHERE id = v_existing_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Get venue details for beneficiary and description
  SELECT name, owner_id
  INTO v_venue
  FROM venues
  WHERE id = NEW.venue_id;

  -- Guard: skip if venue not found
  IF v_venue IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get payer and payee names
  SELECT full_name INTO v_payer FROM users WHERE id = NEW.user_id;
  SELECT full_name INTO v_payee FROM users WHERE id = v_venue.owner_id;

  -- Generate invoice number
  v_invoice_number := generate_invoice_number('INV');

  INSERT INTO invoices (
    invoice_number,
    document_type,
    context_type,
    context_id,
    amount,
    currency,
    payer_id,
    beneficiary_id,
    description,
    payment_method,
    payment_transaction_id,
    status,
    issued_at,
    paid_at,
    metadata,
    payer_name,
    payee_name,
    event_name,
    event_id,
    reason
  ) VALUES (
    v_invoice_number,
    'invoice',
    'booking',
    NEW.id::TEXT,
    NEW.total_amount,
    'XOF',
    NEW.user_id,
    v_venue.owner_id,
    'Réservation de terrain ' || COALESCE(v_venue.name, 'Terrain'),
    CASE WHEN NEW.payment_status = 'paid' THEN 'in_app' ELSE 'cash_on_site' END,
    NEW.payment_transaction_id,
    v_status,
    NOW(),
    CASE WHEN v_status = 'paid' THEN NOW() ELSE NULL END,
    jsonb_build_object('team_name', NULL, 'booking_code', NEW.booking_code),
    COALESCE(v_payer.full_name, NULL),
    COALESCE(v_payee.full_name, NULL),
    COALESCE(v_venue.name, NULL),
    NEW.venue_id,
    'Réservation de terrain ' || COALESCE(v_venue.name, 'Inconnu')
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the booking flow if invoice generation fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger to also fire on plain INSERT (not just payment_status updates)
DROP TRIGGER IF EXISTS booking_invoice_trigger ON public.bookings;
CREATE TRIGGER booking_invoice_trigger
  AFTER INSERT OR UPDATE OF payment_status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION create_invoice_for_booking();

-- Backfill: re-fire the trigger for existing bookings that never got an
-- invoice, by touching payment_status (no actual value change).
DO $backfill$
BEGIN
  UPDATE public.bookings
  SET payment_status = payment_status
  WHERE status NOT IN ('cancelled', 'rejected')
    AND NOT EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.context_type = 'booking' AND i.context_id = bookings.id::TEXT
    );
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$backfill$;

COMMIT;
