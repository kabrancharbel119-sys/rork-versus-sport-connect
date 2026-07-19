-- =============================================================
-- Trigger : génération automatique d'une facture lorsqu'une
-- réservation (bookings) passe en payment_status = 'paid'.
-- SÉCURITAIRE : CREATE OR REPLACE uniquement, aucun DROP de table/colonne
-- =============================================================

BEGIN;

CREATE OR REPLACE FUNCTION create_invoice_for_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_venue RECORD;
  v_payer RECORD;
  v_payee RECORD;
  v_invoice_number TEXT;
BEGIN
  -- Only create an invoice when the payment is confirmed
  IF NEW.payment_status IS DISTINCT FROM 'paid' THEN
    RETURN NEW;
  END IF;

  -- Avoid duplicate invoices for the same booking
  IF EXISTS (
    SELECT 1 FROM invoices
    WHERE context_type = 'booking' AND context_id = NEW.id
  ) THEN
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
    NEW.id,
    NEW.total_amount,
    'XOF',
    NEW.user_id,
    v_venue.owner_id,
    'Réservation de terrain ' || COALESCE(v_venue.name, 'Terrain'),
    'in_app',
    NEW.payment_transaction_id,
    'paid',
    NOW(),
    NOW(),
    jsonb_build_object('team_name', NULL),
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

-- Recreate trigger safely without DROP (conditional CREATE only)
DO $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'booking_invoice_trigger'
      AND tgrelid = 'public.bookings'::regclass
  ) THEN
    EXECUTE $exec$
      CREATE TRIGGER booking_invoice_trigger
      AFTER INSERT OR UPDATE OF payment_status ON public.bookings
      FOR EACH ROW
      EXECUTE FUNCTION create_invoice_for_booking()
    $exec$;
  END IF;
END $func$;

COMMIT;
