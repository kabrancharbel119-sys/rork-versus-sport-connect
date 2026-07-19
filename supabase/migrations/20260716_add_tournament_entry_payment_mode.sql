-- Add entry_payment_mode column to tournaments table
-- Allows organizers to choose how teams pay the entry fee:
--   in_app_immediate  = pay online at registration
--   in_app_on_site_qr = pay via QR scan on tournament day
--   cash_off_app      = pay cash directly to organizer

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS entry_payment_mode TEXT
  DEFAULT 'in_app_immediate'
  CHECK (entry_payment_mode IN ('in_app_immediate', 'in_app_on_site_qr', 'cash_off_app'));

COMMENT ON COLUMN tournaments.entry_payment_mode IS
  'Mode de paiement des frais d''inscription: in_app_immediate | in_app_on_site_qr | cash_off_app';
