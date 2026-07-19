-- Fix existing invoices that have payer_id or beneficiary_id = NULL
-- SÉCURITAIRE : UPDATE uniquement sur les lignes où la valeur est NULL
-- Aucune suppression, aucune modification de schéma

BEGIN;

-- 1. Fix tournament_registration invoices where context_id = tournament_id
--    Use DISTINCT ON to pick one captain per invoice (first confirmed team)
UPDATE invoices i
SET 
  payer_id = sub.captain_id,
  payer_name = sub.captain_name
FROM (
  SELECT DISTINCT ON (i2.id)
    i2.id as invoice_id,
    tm.captain_id,
    u.full_name as captain_name
  FROM invoices i2
  JOIN tournaments t ON t.id = i2.context_id
  JOIN tournament_teams tt ON tt.tournament_id = t.id
  JOIN teams tm ON tm.id = tt.team_id
  LEFT JOIN users u ON u.id = tm.captain_id
  WHERE i2.context_type = 'tournament_registration'
    AND i2.payer_id IS NULL
    AND tt.status = 'confirmed'
    AND t.entry_fee > 0
  ORDER BY i2.id, tt.confirmed_at ASC
) sub
WHERE i.id = sub.invoice_id
  AND i.payer_id IS NULL;

-- 2. Fix tournament_registration invoices where context_id = tournament_payment_id
UPDATE invoices i
SET 
  payer_id = sub.captain_id,
  payer_name = sub.captain_name
FROM (
  SELECT 
    i2.id as invoice_id,
    tm.captain_id,
    u.full_name as captain_name
  FROM invoices i2
  JOIN tournament_payments tp ON tp.id = i2.context_id
  JOIN teams tm ON tm.id = tp.team_id
  LEFT JOIN users u ON u.id = tm.captain_id
  WHERE i2.context_type = 'tournament_registration'
    AND i2.payer_id IS NULL
    AND tp.status = 'approved'
) sub
WHERE i.id = sub.invoice_id
  AND i.payer_id IS NULL;

-- 3. Fix booking invoices where payer_id is NULL
UPDATE invoices i
SET 
  payer_id = sub.user_id,
  payer_name = sub.user_name
FROM (
  SELECT 
    i2.id as invoice_id,
    b.user_id,
    u.full_name as user_name
  FROM invoices i2
  JOIN bookings b ON b.id = i2.context_id
  LEFT JOIN users u ON u.id = b.user_id
  WHERE i2.context_type = 'booking'
    AND i2.payer_id IS NULL
) sub
WHERE i.id = sub.invoice_id
  AND i.payer_id IS NULL;

-- 4. Fix beneficiary_id if NULL for tournament_registration (context_id = tournament_id)
UPDATE invoices i
SET beneficiary_id = sub.organizer_id
FROM (
  SELECT DISTINCT ON (i2.id)
    i2.id as invoice_id,
    t.created_by as organizer_id
  FROM invoices i2
  JOIN tournaments t ON t.id = i2.context_id
  WHERE i2.context_type = 'tournament_registration'
    AND i2.beneficiary_id IS NULL
) sub
WHERE i.id = sub.invoice_id
  AND i.beneficiary_id IS NULL;

-- 5. Fix beneficiary_id if NULL for bookings
UPDATE invoices i
SET beneficiary_id = sub.owner_id
FROM (
  SELECT 
    i2.id as invoice_id,
    v.owner_id
  FROM invoices i2
  JOIN bookings b ON b.id = i2.context_id
  JOIN venues v ON v.id = b.venue_id
  WHERE i2.context_type = 'booking'
    AND i2.beneficiary_id IS NULL
) sub
WHERE i.id = sub.invoice_id
  AND i.beneficiary_id IS NULL;

-- 6. Fix beneficiary_id from tournament_payments
UPDATE invoices i
SET beneficiary_id = sub.organizer_id
FROM (
  SELECT 
    i2.id as invoice_id,
    t.created_by as organizer_id
  FROM invoices i2
  JOIN tournament_payments tp ON tp.id = i2.context_id
  JOIN tournaments t ON t.id = tp.tournament_id
  WHERE i2.context_type = 'tournament_registration'
    AND i2.beneficiary_id IS NULL
) sub
WHERE i.id = sub.invoice_id
  AND i.beneficiary_id IS NULL;

COMMIT;

-- Verify: check for any remaining NULLs
SELECT id, invoice_number, payer_id, payer_name, beneficiary_id, payee_name, context_type, status
FROM invoices
WHERE payer_id IS NULL OR beneficiary_id IS NULL
ORDER BY created_at DESC
LIMIT 20;
