-- =============================================
-- MODES DE PAIEMENT PAR TERRAIN
-- =============================================
-- Chaque terrain choisit son mode de paiement pour les réservations :
--   in_app_immediate  : paiement in-app obligatoire après validation manager
--   in_app_on_site_qr : paiement in-app au moment du scan QR le jour J
--   cash_off_app      : paiement cash/hors-app (mode traditionnel)
-- Modifiable à tout moment par le gestionnaire dans les paramètres du terrain.

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'cash_off_app'
    CHECK (payment_mode IN ('in_app_immediate', 'in_app_on_site_qr', 'cash_off_app'));

-- Numéro de réception des paiements du gestionnaire (payouts directs terrain)
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS payout_phone TEXT;

CREATE INDEX IF NOT EXISTS idx_venues_payment_mode ON venues(payment_mode);

-- =============================================
-- CHAMPS DE PAIEMENT SUR LES RÉSERVATIONS
-- =============================================
-- payment_status suit le cycle de paiement, indépendamment du statut booking :
--   not_required : terrain en mode cash_off_app
--   pending      : paiement attendu (immédiat ou au scan QR)
--   paid         : paiement in-app confirmé
--   refunded     : remboursé suite à annulation
--   failed       : tentative échouée

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (payment_status IN ('not_required', 'pending', 'paid', 'refunded', 'failed'));

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
