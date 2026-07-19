-- Backfill invoices for already-completed transactions
-- Run this in Supabase SQL Editor to generate invoices for:
-- 1. Confirmed tournament_teams (entry fee payments)
-- 2. Paid bookings
-- 3. Approved tournament_payments (legacy)

-- =============================================
-- 1. TOURNAMENT ENTRY FEES (tournament_teams with status = 'confirmed')
-- =============================================
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
)
SELECT
  generate_invoice_number('INV'),
  'invoice',
  'tournament_registration',
  t.id,
  COALESCE(t.entry_fee, 0),
  'XOF',
  tm.captain_id,
  t.created_by,
  'Inscription equipe ' || COALESCE(tm.name, 'Inconnue') || ' au tournoi ' || COALESCE(t.name, 'Inconnu'),
  'in_app',
  NULL,
  'paid',
  COALESCE(tt.confirmed_at, NOW()),
  COALESCE(tt.confirmed_at, NOW()),
  jsonb_build_object('team_name', COALESCE(tm.name, NULL)),
  (SELECT u.full_name FROM users u WHERE u.id = tm.captain_id LIMIT 1),
  (SELECT u.full_name FROM users u WHERE u.id = t.created_by LIMIT 1),
  COALESCE(t.name, NULL),
  t.id,
  'Frais d''inscription au tournoi "' || COALESCE(t.name, 'Inconnu') || '" — Equipe: ' || COALESCE(tm.name, 'Inconnue')
FROM tournament_teams tt
JOIN tournaments t ON t.id = tt.tournament_id
LEFT JOIN teams tm ON tm.id = tt.team_id
WHERE tt.status = 'confirmed'
  AND COALESCE(t.entry_fee, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.context_type = 'tournament_registration'
      AND i.context_id = t.id
  );

-- =============================================
-- 2. PAID BOOKINGS
-- =============================================
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
)
SELECT
  generate_invoice_number('INV'),
  'invoice',
  'booking',
  b.id,
  COALESCE(b.total_amount, 0),
  'XOF',
  b.user_id,
  v.owner_id,
  'Reservation de terrain ' || COALESCE(v.name, 'Inconnu') || ' le ' || TO_CHAR(b.date, 'DD/MM/YYYY'),
  'in_app',
  b.payment_transaction_id,
  'paid',
  COALESCE(b.paid_at, b.created_at, NOW()),
  COALESCE(b.paid_at, b.created_at, NOW()),
  jsonb_build_object('team_name', NULL),
  (SELECT u.full_name FROM users u WHERE u.id = b.user_id LIMIT 1),
  (SELECT u.full_name FROM users u WHERE u.id = v.owner_id LIMIT 1),
  v.name,
  v.id,
  'Reservation de terrain "' || COALESCE(v.name, 'Inconnu') || '"'
FROM bookings b
JOIN venues v ON v.id = b.venue_id
WHERE b.payment_status = 'paid'
  AND COALESCE(b.total_amount, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.context_type = 'booking'
      AND i.context_id = b.id
  );

-- =============================================
-- 3. APPROVED TOURNAMENT_PAYMENTS (legacy)
-- =============================================
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
)
SELECT
  generate_invoice_number('INV'),
  'invoice',
  'tournament_registration',
  tp.id,
  COALESCE(tp.amount, 0),
  'XOF',
  tm2.captain_id,
  t.created_by,
  'Paiement d''inscription au tournoi ' || COALESCE(t.name, 'Inconnu'),
  COALESCE(tp.method, 'in_app'),
  tp.transaction_ref,
  'paid',
  COALESCE(tp.validated_at, tp.created_at, NOW()),
  COALESCE(tp.validated_at, tp.created_at, NOW()),
  jsonb_build_object('team_name', COALESCE(tm2.name, NULL)),
  (SELECT u.full_name FROM users u WHERE u.id = tm2.captain_id LIMIT 1),
  (SELECT u.full_name FROM users u WHERE u.id = t.created_by LIMIT 1),
  COALESCE(t.name, NULL),
  t.id,
  'Paiement d''inscription au tournoi "' || COALESCE(t.name, 'Inconnu') || '"'
FROM tournament_payments tp
JOIN tournaments t ON t.id = tp.tournament_id
LEFT JOIN teams tm2 ON tm2.id = tp.team_id
WHERE tp.status = 'approved'
  AND COALESCE(tp.amount, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.context_type = 'tournament_registration'
      AND i.context_id = tp.id
  );

-- Verify results
SELECT context_type, status, COUNT(*) as count, SUM(amount) as total_amount
FROM invoices
GROUP BY context_type, status
ORDER BY context_type, status;
