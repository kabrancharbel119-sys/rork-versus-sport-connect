-- =============================================================
-- SCRIPT COMPLET: Correction des factures (sûr, non-destructif)
-- 1. Met à jour les fonctions trigger (CREATE OR REPLACE)
-- 2. Génère les factures manquantes pour transactions récentes
-- 3. Remplit payer_id/beneficiary_id NULL
-- 4. Remplit payer_name/payee_name/event_name NULL
-- 5. Nettoie metadata des champs sensibles
-- =============================================================

BEGIN;

-- =============================================================
-- 1. METTRE À JOUR LES FONCTIONS TRIGGER
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
  IF NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM invoices
    WHERE context_type = 'tournament_registration' AND context_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT name, captain_id INTO v_team FROM teams WHERE id = NEW.team_id;
  SELECT name, created_by INTO v_tournament FROM tournaments WHERE id = NEW.tournament_id;

  IF v_team IS NULL OR v_tournament IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_payer FROM users WHERE id = v_team.captain_id;
  SELECT full_name INTO v_payee FROM users WHERE id = v_tournament.created_by;

  v_amount := COALESCE(NEW.amount::INT, 0);
  IF v_amount <= 0 THEN
    RETURN NEW;
  END IF;

  v_invoice_number := generate_invoice_number('INV');

  INSERT INTO invoices (
    invoice_number, document_type, context_type, context_id,
    amount, currency, payer_id, beneficiary_id, description,
    payment_method, payment_transaction_id, status, issued_at, paid_at,
    metadata, payer_name, payee_name, event_name, event_id, reason
  ) VALUES (
    v_invoice_number, 'invoice', 'tournament_registration', NEW.id,
    v_amount, 'XOF', v_team.captain_id, v_tournament.created_by,
    'Inscription de ' || COALESCE(v_team.name, 'Équipe') || ' au tournoi ' || COALESCE(v_tournament.name, 'Tournoi'),
    COALESCE(NEW.method, 'in_app'), NEW.transaction_ref, 'paid', NOW(),
    COALESCE(NEW.validated_at, NOW()),
    jsonb_build_object('team_name', COALESCE(v_team.name, NULL)),
    COALESCE(v_payer.full_name, NULL), COALESCE(v_payee.full_name, NULL),
    COALESCE(v_tournament.name, NULL), NEW.tournament_id,
    'Frais d''inscription au tournoi ' || COALESCE(v_tournament.name, 'Inconnu')
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION create_invoice_for_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_venue RECORD;
  v_payer RECORD;
  v_payee RECORD;
  v_invoice_number TEXT;
BEGIN
  IF NEW.payment_status IS DISTINCT FROM 'paid' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM invoices WHERE context_type = 'booking' AND context_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT name, owner_id INTO v_venue FROM venues WHERE id = NEW.venue_id;

  IF v_venue IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_payer FROM users WHERE id = NEW.user_id;
  SELECT full_name INTO v_payee FROM users WHERE id = v_venue.owner_id;

  v_invoice_number := generate_invoice_number('INV');

  INSERT INTO invoices (
    invoice_number, document_type, context_type, context_id,
    amount, currency, payer_id, beneficiary_id, description,
    payment_method, payment_transaction_id, status, issued_at, paid_at,
    metadata, payer_name, payee_name, event_name, event_id, reason
  ) VALUES (
    v_invoice_number, 'invoice', 'booking', NEW.id,
    NEW.total_amount, 'XOF', NEW.user_id, v_venue.owner_id,
    'Réservation de terrain ' || COALESCE(v_venue.name, 'Terrain'),
    'in_app', NEW.payment_transaction_id, 'paid', NOW(), NOW(),
    jsonb_build_object('team_name', NULL),
    COALESCE(v_payer.full_name, NULL), COALESCE(v_payee.full_name, NULL),
    COALESCE(v_venue.name, NULL), NEW.venue_id,
    'Réservation de terrain ' || COALESCE(v_venue.name, 'Inconnu')
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
  IF NEW.disbursement_status NOT IN ('sent_to_venue', 'sent_to_organizer')
     OR NEW.disbursement_status IS NOT DISTINCT FROM OLD.disbursement_status THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM invoices
    WHERE context_type IN ('venue_advance', 'logistics_advance') AND context_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT name, created_by INTO v_tournament FROM tournaments WHERE id = NEW.tournament_id;

  IF NEW.disbursement_status = 'sent_to_venue' AND NEW.venue_id IS NOT NULL THEN
    SELECT owner_id INTO v_venue_owner_id FROM venues WHERE id = NEW.venue_id;
    v_beneficiary_id := v_venue_owner_id;
    v_context_type := 'venue_advance';
    v_description := 'Avance versée directement au terrain pour la réservation du tournoi';
  ELSE
    v_beneficiary_id := NEW.organizer_id;
    v_context_type := 'logistics_advance';
    v_description := 'Avance logistique versée à l''organisateur du tournoi';
  END IF;

  IF v_beneficiary_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_payee FROM users WHERE id = v_beneficiary_id;

  v_amount := COALESCE(NEW.requested_amount::INT, 0);
  IF v_amount <= 0 THEN
    RETURN NEW;
  END IF;

  v_invoice_number := generate_invoice_number('REC');

  INSERT INTO invoices (
    invoice_number, document_type, context_type, context_id,
    amount, currency, payer_id, beneficiary_id, description,
    payment_method, payment_transaction_id, status, issued_at, paid_at,
    metadata, payer_name, payee_name, event_name, event_id, reason
  ) VALUES (
    v_invoice_number, 'payout_receipt', v_context_type, NEW.id,
    v_amount, 'XOF', NULL, v_beneficiary_id, v_description,
    'in_app', NEW.disbursement_transaction_id, 'paid', NOW(),
    COALESCE(NEW.disbursed_at, NOW()),
    jsonb_build_object('team_name', NULL), NULL,
    COALESCE(v_payee.full_name, NULL), COALESCE(v_tournament.name, NULL),
    NEW.tournament_id, v_description
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================
-- 2. GÉNÉRER LES FACTURES MANQUANTES
-- =============================================================

-- 2a. Tournament payments approuvés sans facture
INSERT INTO invoices (
  invoice_number, document_type, context_type, context_id,
  amount, currency, payer_id, beneficiary_id, description,
  payment_method, payment_transaction_id, status, issued_at, paid_at,
  metadata, payer_name, payee_name, event_name, event_id, reason
)
SELECT
  generate_invoice_number('INV'),
  'invoice', 'tournament_registration', tp.id,
  COALESCE(tp.amount, 0), 'XOF',
  tm.captain_id, t.created_by,
  'Inscription de ' || COALESCE(tm.name, 'Équipe') || ' au tournoi ' || COALESCE(t.name, 'Tournoi'),
  COALESCE(tp.method, 'in_app'), tp.transaction_ref, 'paid',
  COALESCE(tp.validated_at, NOW()), COALESCE(tp.validated_at, NOW()),
  jsonb_build_object('team_name', COALESCE(tm.name, NULL)),
  (SELECT u.full_name FROM users u WHERE u.id = tm.captain_id LIMIT 1),
  (SELECT u.full_name FROM users u WHERE u.id = t.created_by LIMIT 1),
  COALESCE(t.name, NULL), tp.tournament_id,
  'Frais d''inscription au tournoi ' || COALESCE(t.name, 'Inconnu')
FROM tournament_payments tp
JOIN tournaments t ON t.id = tp.tournament_id
LEFT JOIN teams tm ON tm.id = tp.team_id
WHERE tp.status = 'approved'
  AND COALESCE(tp.amount, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.context_type = 'tournament_registration' AND i.context_id = tp.id
  );

-- 2b. Bookings payés sans facture
INSERT INTO invoices (
  invoice_number, document_type, context_type, context_id,
  amount, currency, payer_id, beneficiary_id, description,
  payment_method, payment_transaction_id, status, issued_at, paid_at,
  metadata, payer_name, payee_name, event_name, event_id, reason
)
SELECT
  generate_invoice_number('INV'),
  'invoice', 'booking', b.id,
  COALESCE(b.total_amount, 0), 'XOF',
  b.user_id, v.owner_id,
  'Réservation de terrain ' || COALESCE(v.name, 'Terrain'),
  'in_app', b.payment_transaction_id, 'paid',
  COALESCE(b.paid_at, b.created_at, NOW()), COALESCE(b.paid_at, b.created_at, NOW()),
  jsonb_build_object('team_name', NULL),
  (SELECT u.full_name FROM users u WHERE u.id = b.user_id LIMIT 1),
  (SELECT u.full_name FROM users u WHERE u.id = v.owner_id LIMIT 1),
  COALESCE(v.name, NULL), v.id,
  'Réservation de terrain ' || COALESCE(v.name, 'Inconnu')
FROM bookings b
JOIN venues v ON v.id = b.venue_id
WHERE b.payment_status = 'paid'
  AND COALESCE(b.total_amount, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.context_type = 'booking' AND i.context_id = b.id
  );

-- 2c. Tournament teams confirmés avec entry_fee mais sans facture
INSERT INTO invoices (
  invoice_number, document_type, context_type, context_id,
  amount, currency, payer_id, beneficiary_id, description,
  payment_method, payment_transaction_id, status, issued_at, paid_at,
  metadata, payer_name, payee_name, event_name, event_id, reason
)
SELECT
  generate_invoice_number('INV'),
  'invoice', 'tournament_registration', t.id,
  COALESCE(t.entry_fee, 0), 'XOF',
  tm.captain_id, t.created_by,
  'Inscription de ' || COALESCE(tm.name, 'Équipe') || ' au tournoi ' || COALESCE(t.name, 'Tournoi'),
  'in_app', NULL, 'paid',
  COALESCE(tt.confirmed_at, NOW()), COALESCE(tt.confirmed_at, NOW()),
  jsonb_build_object('team_name', COALESCE(tm.name, NULL)),
  (SELECT u.full_name FROM users u WHERE u.id = tm.captain_id LIMIT 1),
  (SELECT u.full_name FROM users u WHERE u.id = t.created_by LIMIT 1),
  COALESCE(t.name, NULL), t.id,
  'Frais d''inscription au tournoi ' || COALESCE(t.name, 'Inconnu')
FROM tournament_teams tt
JOIN tournaments t ON t.id = tt.tournament_id
LEFT JOIN teams tm ON tm.id = tt.team_id
WHERE tt.status = 'confirmed'
  AND COALESCE(t.entry_fee, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.context_type = 'tournament_registration' AND i.context_id = t.id
  );

-- =============================================================
-- 3. REMPLIR payer_id ET beneficiary_id NULL
-- =============================================================

-- Fix payer_id NULL pour tournament_registration (context_id = tournament_id)
UPDATE invoices i
SET payer_id = sub.captain_id, payer_name = sub.captain_name
FROM (
  SELECT DISTINCT ON (i2.id) i2.id as invoice_id, tm.captain_id, u.full_name as captain_name
  FROM invoices i2
  JOIN tournaments t ON t.id = i2.context_id
  JOIN tournament_teams tt ON tt.tournament_id = t.id
  JOIN teams tm ON tm.id = tt.team_id
  LEFT JOIN users u ON u.id = tm.captain_id
  WHERE i2.context_type = 'tournament_registration' AND i2.payer_id IS NULL
    AND tt.status = 'confirmed' AND t.entry_fee > 0
  ORDER BY i2.id, tt.confirmed_at ASC
) sub
WHERE i.id = sub.invoice_id AND i.payer_id IS NULL;

-- Fix payer_id NULL pour tournament_registration (context_id = payment_id)
UPDATE invoices i
SET payer_id = sub.captain_id, payer_name = sub.captain_name
FROM (
  SELECT i2.id as invoice_id, tm.captain_id, u.full_name as captain_name
  FROM invoices i2
  JOIN tournament_payments tp ON tp.id = i2.context_id
  JOIN teams tm ON tm.id = tp.team_id
  LEFT JOIN users u ON u.id = tm.captain_id
  WHERE i2.context_type = 'tournament_registration' AND i2.payer_id IS NULL
    AND tp.status = 'approved'
) sub
WHERE i.id = sub.invoice_id AND i.payer_id IS NULL;

-- Fix payer_id NULL pour bookings
UPDATE invoices i
SET payer_id = sub.user_id, payer_name = sub.user_name
FROM (
  SELECT i2.id as invoice_id, b.user_id, u.full_name as user_name
  FROM invoices i2
  JOIN bookings b ON b.id = i2.context_id
  LEFT JOIN users u ON u.id = b.user_id
  WHERE i2.context_type = 'booking' AND i2.payer_id IS NULL
) sub
WHERE i.id = sub.invoice_id AND i.payer_id IS NULL;

-- Fix beneficiary_id NULL pour tournament_registration
UPDATE invoices i
SET beneficiary_id = sub.organizer_id
FROM (
  SELECT DISTINCT ON (i2.id) i2.id as invoice_id, t.created_by as organizer_id
  FROM invoices i2
  JOIN tournaments t ON t.id = i2.context_id
  WHERE i2.context_type = 'tournament_registration' AND i2.beneficiary_id IS NULL
) sub
WHERE i.id = sub.invoice_id AND i.beneficiary_id IS NULL;

-- Fix beneficiary_id NULL pour bookings
UPDATE invoices i
SET beneficiary_id = sub.owner_id
FROM (
  SELECT i2.id as invoice_id, v.owner_id
  FROM invoices i2
  JOIN bookings b ON b.id = i2.context_id
  JOIN venues v ON v.id = b.venue_id
  WHERE i2.context_type = 'booking' AND i2.beneficiary_id IS NULL
) sub
WHERE i.id = sub.invoice_id AND i.beneficiary_id IS NULL;

-- Fix beneficiary_id NULL pour tournament_payments
UPDATE invoices i
SET beneficiary_id = sub.organizer_id
FROM (
  SELECT i2.id as invoice_id, t.created_by as organizer_id
  FROM invoices i2
  JOIN tournament_payments tp ON tp.id = i2.context_id
  JOIN tournaments t ON t.id = tp.tournament_id
  WHERE i2.context_type = 'tournament_registration' AND i2.beneficiary_id IS NULL
) sub
WHERE i.id = sub.invoice_id AND i.beneficiary_id IS NULL;

-- =============================================================
-- 4. REMPLIR payer_name, payee_name, event_name NULL
-- =============================================================

-- Pour tournament_registration (context_id = tournament_id)
UPDATE invoices i
SET 
  payer_name = COALESCE(i.payer_name, sub.payer_name),
  payee_name = COALESCE(i.payee_name, sub.payee_name),
  event_name = COALESCE(i.event_name, sub.event_name),
  event_id = COALESCE(i.event_id, sub.tournament_id)
FROM (
  SELECT DISTINCT ON (i2.id)
    i2.id as invoice_id, u_payer.full_name as payer_name,
    u_payee.full_name as payee_name, t.name as event_name, t.id as tournament_id
  FROM invoices i2
  JOIN tournaments t ON t.id = i2.context_id
  JOIN tournament_teams tt ON tt.tournament_id = t.id
  JOIN teams tm ON tm.id = tt.team_id
  LEFT JOIN users u_payer ON u_payer.id = tm.captain_id
  LEFT JOIN users u_payee ON u_payee.id = t.created_by
  WHERE i2.context_type = 'tournament_registration' AND t.entry_fee > 0 AND tt.status = 'confirmed'
  ORDER BY i2.id, tt.confirmed_at ASC
) sub
WHERE i.id = sub.invoice_id
  AND (i.payer_name IS NULL OR i.payee_name IS NULL OR i.event_name IS NULL);

-- Pour bookings
UPDATE invoices i
SET 
  payer_name = COALESCE(i.payer_name, sub.payer_name),
  payee_name = COALESCE(i.payee_name, sub.payee_name),
  event_name = COALESCE(i.event_name, sub.event_name),
  event_id = COALESCE(i.event_id, sub.venue_id)
FROM (
  SELECT i2.id as invoice_id, u_payer.full_name as payer_name,
    u_payee.full_name as payee_name, v.name as event_name, v.id as venue_id
  FROM invoices i2
  JOIN bookings b ON b.id = i2.context_id
  JOIN venues v ON v.id = b.venue_id
  LEFT JOIN users u_payer ON u_payer.id = b.user_id
  LEFT JOIN users u_payee ON u_payee.id = v.owner_id
  WHERE i2.context_type = 'booking'
) sub
WHERE i.id = sub.invoice_id
  AND (i.payer_name IS NULL OR i.payee_name IS NULL OR i.event_name IS NULL);

-- Pour tournament_payments
UPDATE invoices i
SET 
  payer_name = COALESCE(i.payer_name, sub.payer_name),
  payee_name = COALESCE(i.payee_name, sub.payee_name),
  event_name = COALESCE(i.event_name, sub.event_name),
  event_id = COALESCE(i.event_id, sub.tournament_id)
FROM (
  SELECT i2.id as invoice_id, u_payer.full_name as payer_name,
    u_payee.full_name as payee_name, t.name as event_name, t.id as tournament_id
  FROM invoices i2
  JOIN tournament_payments tp ON tp.id = i2.context_id
  JOIN tournaments t ON t.id = tp.tournament_id
  LEFT JOIN teams tm ON tm.id = tp.team_id
  LEFT JOIN users u_payer ON u_payer.id = tm.captain_id
  LEFT JOIN users u_payee ON u_payee.id = t.created_by
  WHERE i2.context_type = 'tournament_registration' AND tp.status = 'approved'
) sub
WHERE i.id = sub.invoice_id
  AND (i.payer_name IS NULL OR i.payee_name IS NULL OR i.event_name IS NULL);

-- =============================================================
-- 5. NETTOYER METADATA (retirer les champs sensibles)
-- =============================================================

UPDATE invoices
SET metadata = metadata - 'payer_name' - 'payee_name' - 'event_name' - 'event_id'
  - 'reason' - 'context_type' - 'context_id' - 'venue_name' - 'booking_id'
  - 'payment_transaction_id' - 'tournament_id' - 'team_id' - 'request_id'
  - 'venue_id' - 'purpose_category'
WHERE metadata ?| array['payer_name', 'payee_name', 'event_name', 'event_id',
  'reason', 'context_type', 'context_id', 'venue_name', 'booking_id',
  'payment_transaction_id', 'tournament_id', 'team_id', 'request_id',
  'venue_id', 'purpose_category'];

-- Nettoyer les descriptions contenant des UUIDs
UPDATE invoices
SET description = 'Inscription equipe ' || COALESCE(metadata->>'team_name', 'Inconnue') || ' au tournoi ' || COALESCE(event_name, 'Inconnu')
WHERE context_type = 'tournament_registration'
  AND description ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

UPDATE invoices
SET description = 'Reservation de terrain' || CASE WHEN event_name IS NOT NULL THEN ' "' || event_name || '"' ELSE '' END
WHERE context_type = 'booking'
  AND description ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

COMMIT;

-- =============================================================
-- VÉRIFICATION (lecture seule)
-- =============================================================
SELECT id, invoice_number, context_type, status,
  payer_id, beneficiary_id, payer_name, payee_name, event_name, description
FROM invoices
ORDER BY created_at DESC
LIMIT 20;
