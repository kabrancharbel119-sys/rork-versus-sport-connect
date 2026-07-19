-- Update existing invoices: populate dedicated columns AND remove sensitive data from metadata
-- SÉCURITAIRE : UPDATE uniquement, aucune suppression de ligne ou de table
-- Les clés metadata sont retirées proprement via l'opérateur JSONB '-'

BEGIN;

-- 1. Tournament registration invoices (context_id = tournament_id from tournament_teams)
UPDATE invoices i
SET 
  payer_name = COALESCE(i.payer_name, sub.payer_name),
  payee_name = COALESCE(i.payee_name, sub.payee_name),
  event_name = COALESCE(i.event_name, sub.event_name),
  event_id = COALESCE(i.event_id, sub.tournament_id),
  metadata = (i.metadata - 'payer_name' - 'payee_name' - 'event_name' - 'event_id' - 'team_name' - 'team_id' - 'reason' - 'context_type' - 'context_id' - 'venue_name') || jsonb_build_object('team_name', sub.team_name)
FROM (
  SELECT
    i2.id as invoice_id,
    u_payer.full_name as payer_name,
    tm.name as team_name,
    u_payee.full_name as payee_name,
    t.name as event_name,
    t.id as tournament_id
  FROM invoices i2
  JOIN tournaments t ON t.id = i2.context_id
  JOIN tournament_teams tt ON tt.tournament_id = t.id
  JOIN teams tm ON tm.id = tt.team_id
  LEFT JOIN users u_payer ON u_payer.id = tm.captain_id
  LEFT JOIN users u_payee ON u_payee.id = t.created_by
  WHERE i2.context_type = 'tournament_registration'
    AND t.entry_fee > 0
    AND tt.status = 'confirmed'
) sub
WHERE i.id = sub.invoice_id;

-- 2. Booking invoices (context_id = booking_id)
UPDATE invoices i
SET 
  payer_name = COALESCE(i.payer_name, sub.payer_name),
  payee_name = COALESCE(i.payee_name, sub.payee_name),
  event_name = COALESCE(i.event_name, sub.event_name),
  event_id = COALESCE(i.event_id, sub.venue_id),
  metadata = (i.metadata - 'payer_name' - 'payee_name' - 'event_name' - 'event_id' - 'team_name' - 'team_id' - 'reason' - 'context_type' - 'context_id' - 'venue_name' - 'booking_id')
FROM (
  SELECT
    i2.id as invoice_id,
    u_payer.full_name as payer_name,
    u_payee.full_name as payee_name,
    v.name as event_name,
    v.id as venue_id
  FROM invoices i2
  JOIN bookings b ON b.id = i2.context_id
  JOIN venues v ON v.id = b.venue_id
  LEFT JOIN users u_payer ON u_payer.id = b.user_id
  LEFT JOIN users u_payee ON u_payee.id = v.owner_id
  WHERE i2.context_type = 'booking'
) sub
WHERE i.id = sub.invoice_id;

-- 3. Tournament payments legacy (context_id = tournament_payment_id)
UPDATE invoices i
SET 
  payer_name = COALESCE(i.payer_name, sub.payer_name),
  payee_name = COALESCE(i.payee_name, sub.payee_name),
  event_name = COALESCE(i.event_name, sub.event_name),
  event_id = COALESCE(i.event_id, sub.tournament_id),
  metadata = (i.metadata - 'payer_name' - 'payee_name' - 'event_name' - 'event_id' - 'team_name' - 'team_id' - 'reason' - 'context_type' - 'context_id' - 'venue_name' - 'tournament_id') || jsonb_build_object('team_name', sub.team_name)
FROM (
  SELECT
    i2.id as invoice_id,
    u_payer.full_name as payer_name,
    tm.name as team_name,
    u_payee.full_name as payee_name,
    t.name as event_name,
    t.id as tournament_id
  FROM invoices i2
  JOIN tournament_payments tp ON tp.id = i2.context_id
  JOIN tournaments t ON t.id = tp.tournament_id
  LEFT JOIN teams tm ON tm.id = tp.team_id
  LEFT JOIN users u_payer ON u_payer.id = tm.captain_id
  LEFT JOIN users u_payee ON u_payee.id = t.created_by
  WHERE i2.context_type = 'tournament_registration'
    AND tp.status = 'approved'
) sub
WHERE i.id = sub.invoice_id;

-- 4. Clean ALL invoices: remove any remaining sensitive keys from metadata
--    Only touches rows that actually have these keys
UPDATE invoices
SET metadata = metadata - 'payer_name' - 'payee_name' - 'event_name' - 'event_id' - 'reason' - 'context_type' - 'context_id' - 'venue_name' - 'booking_id' - 'payment_transaction_id' - 'tournament_id' - 'team_id' - 'request_id' - 'venue_id' - 'purpose_category'
WHERE metadata ?| array['payer_name', 'payee_name', 'event_name', 'event_id', 'reason', 'context_type', 'context_id', 'venue_name', 'booking_id', 'payment_transaction_id', 'tournament_id', 'team_id', 'request_id', 'venue_id', 'purpose_category'];

-- 5. Clean description fields that contain raw UUIDs
UPDATE invoices
SET description = 'Inscription equipe ' || COALESCE(metadata->>'team_name', 'Inconnue') || ' au tournoi ' || COALESCE(event_name, 'Inconnu')
WHERE context_type = 'tournament_registration'
  AND description ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

UPDATE invoices
SET description = 'Reservation de terrain' || CASE WHEN event_name IS NOT NULL THEN ' "' || event_name || '"' ELSE '' END
WHERE context_type = 'booking'
  AND description ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

COMMIT;

-- Verify: metadata should be clean (only team_name or empty), description should have no UUIDs
SELECT id, invoice_number, payer_name, payee_name, event_name, description, metadata
FROM invoices
ORDER BY created_at DESC
LIMIT 20;
