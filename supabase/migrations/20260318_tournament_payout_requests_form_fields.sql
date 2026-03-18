-- =============================================
-- CHAMPS COMPLÉMENTAIRES POUR LES DEMANDES D'AVANCE
-- =============================================

ALTER TABLE tournament_payout_requests
  ADD COLUMN IF NOT EXISTS purpose_category TEXT NOT NULL DEFAULT 'other'
    CHECK (purpose_category IN ('venue', 'referees', 'logistics', 'communication', 'prize', 'other')),
  ADD COLUMN IF NOT EXISTS budget_breakdown TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS amount_already_spent REAL NOT NULL DEFAULT 0 CHECK (amount_already_spent >= 0),
  ADD COLUMN IF NOT EXISTS needed_by TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supporting_evidence TEXT,
  ADD COLUMN IF NOT EXISTS fallback_contact TEXT;

NOTIFY pgrst, 'reload schema';
