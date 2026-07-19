-- =============================================================
-- Triggers : génération automatique des factures / reçus
-- SÉCURITAIRE : CREATE OR REPLACE uniquement, aucun DROP de table/colonne
-- =============================================================

BEGIN;

-- =============================================================
-- 1. Facture d'inscription à un tournoi
-- =============================================================
CREATE OR REPLACE FUNCTION create_invoice_for_tournament_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_team RECORD;
  v_tournament RECORD;
  v_payer RECORD;
  v_payee RECORD;
  v_invoice_number TEXT;
  v_amount INT;
BEGIN
  -- Only generate for approved payments
  IF NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  -- Avoid duplicate invoice for this payment
  IF EXISTS (
    SELECT 1 FROM invoices
    WHERE context_type = 'tournament_registration'
      AND context_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Get team and tournament info
  SELECT name, captain_id INTO v_team
  FROM teams
  WHERE id = NEW.team_id;

  SELECT name, created_by INTO v_tournament
  FROM tournaments
  WHERE id = NEW.tournament_id;

  -- Guard: skip if team or tournament not found
  IF v_team IS NULL OR v_tournament IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get payer and payee names
  SELECT full_name INTO v_payer FROM users WHERE id = v_team.captain_id;
  SELECT full_name INTO v_payee FROM users WHERE id = v_tournament.created_by;

  v_amount := COALESCE(NEW.amount::INT, 0);
  IF v_amount <= 0 THEN
    RETURN NEW;
  END IF;

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
    'tournament_registration',
    NEW.id,
    v_amount,
    'XOF',
    v_team.captain_id,
    v_tournament.created_by,
    'Inscription de ' || COALESCE(v_team.name, 'Équipe') || ' au tournoi ' || COALESCE(v_tournament.name, 'Tournoi'),
    COALESCE(NEW.method, 'in_app'),
    NEW.transaction_ref,
    'paid',
    NOW(),
    COALESCE(NEW.validated_at, NOW()),
    jsonb_build_object('team_name', COALESCE(v_team.name, NULL)),
    COALESCE(v_payer.full_name, NULL),
    COALESCE(v_payee.full_name, NULL),
    COALESCE(v_tournament.name, NULL),
    NEW.tournament_id,
    'Frais d''inscription au tournoi ' || COALESCE(v_tournament.name, 'Inconnu') || ' — Équipe: ' || COALESCE(v_team.name, 'Inconnue')
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the payment flow if invoice generation fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger safely without DROP (conditional CREATE only)
DO $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'tournament_payment_invoice_trigger'
      AND tgrelid = 'public.tournament_payments'::regclass
  ) THEN
    EXECUTE $exec$
      CREATE TRIGGER tournament_payment_invoice_trigger
      AFTER INSERT OR UPDATE OF status ON public.tournament_payments
      FOR EACH ROW
      EXECUTE FUNCTION create_invoice_for_tournament_payment()
    $exec$;
  END IF;
END $func$;


-- =============================================================
-- 2. Reçu de décaissement d'une avance organisateur
-- =============================================================
CREATE OR REPLACE FUNCTION create_invoice_for_payout_request()
RETURNS TRIGGER AS $$
DECLARE
  v_venue_owner_id UUID;
  v_beneficiary_id UUID;
  v_context_type TEXT;
  v_description TEXT;
  v_invoice_number TEXT;
  v_amount INT;
  v_tournament RECORD;
  v_payee RECORD;
BEGIN
  -- Only generate when funds are actually sent
  IF NEW.disbursement_status NOT IN ('sent_to_venue', 'sent_to_organizer')
     OR NEW.disbursement_status IS NOT DISTINCT FROM OLD.disbursement_status THEN
    RETURN NEW;
  END IF;

  -- Avoid duplicate receipt for this request
  IF EXISTS (
    SELECT 1 FROM invoices
    WHERE context_type IN ('venue_advance', 'logistics_advance')
      AND context_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Get tournament info
  SELECT name, created_by INTO v_tournament
  FROM tournaments
  WHERE id = NEW.tournament_id;

  -- Determine context and beneficiary
  IF NEW.disbursement_status = 'sent_to_venue' AND NEW.venue_id IS NOT NULL THEN
    SELECT owner_id INTO v_venue_owner_id
    FROM venues
    WHERE id = NEW.venue_id;

    v_beneficiary_id := v_venue_owner_id;
    v_context_type := 'venue_advance';
    v_description := 'Avance versée directement au terrain pour la réservation du tournoi';
  ELSE
    v_beneficiary_id := NEW.organizer_id;
    v_context_type := 'logistics_advance';
    v_description := 'Avance logistique versée à l''organisateur du tournoi';
  END IF;

  -- Guard: skip if no beneficiary
  IF v_beneficiary_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get payee name
  SELECT full_name INTO v_payee FROM users WHERE id = v_beneficiary_id;

  v_amount := COALESCE(NEW.requested_amount::INT, 0);
  IF v_amount <= 0 THEN
    RETURN NEW;
  END IF;

  v_invoice_number := generate_invoice_number('REC');

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
    'payout_receipt',
    v_context_type,
    NEW.id,
    v_amount,
    'XOF',
    NULL,
    v_beneficiary_id,
    v_description,
    'in_app',
    NEW.disbursement_transaction_id,
    'paid',
    NOW(),
    COALESCE(NEW.disbursed_at, NOW()),
    jsonb_build_object('team_name', NULL),
    NULL,
    COALESCE(v_payee.full_name, NULL),
    COALESCE(v_tournament.name, NULL),
    NEW.tournament_id,
    v_description
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the payout flow if invoice generation fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger safely without DROP (conditional CREATE only)
DO $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'payout_request_invoice_trigger'
      AND tgrelid = 'public.tournament_payout_requests'::regclass
  ) THEN
    EXECUTE $exec$
      CREATE TRIGGER payout_request_invoice_trigger
      AFTER UPDATE OF disbursement_status ON public.tournament_payout_requests
      FOR EACH ROW
      EXECUTE FUNCTION create_invoice_for_payout_request()
    $exec$;
  END IF;
END $func$;

COMMIT;
