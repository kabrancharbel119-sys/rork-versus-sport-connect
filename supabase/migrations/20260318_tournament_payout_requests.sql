-- =============================================
-- DEMANDES D'AVANCE ORGANISATEURS
-- =============================================

CREATE TABLE IF NOT EXISTS tournament_payout_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_amount REAL NOT NULL CHECK (requested_amount > 0),
  reason TEXT NOT NULL,
  use_of_funds TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
  payout_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_payout_requests_tournament ON tournament_payout_requests(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_payout_requests_organizer ON tournament_payout_requests(organizer_id);
CREATE INDEX IF NOT EXISTS idx_tournament_payout_requests_status ON tournament_payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_tournament_payout_requests_created_at ON tournament_payout_requests(created_at DESC);

ALTER TABLE tournament_payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tournament_payout_requests_select ON tournament_payout_requests;
DROP POLICY IF EXISTS tournament_payout_requests_insert ON tournament_payout_requests;
DROP POLICY IF EXISTS tournament_payout_requests_update ON tournament_payout_requests;

-- Lecture: organisateur concerné + admins
CREATE POLICY tournament_payout_requests_select ON tournament_payout_requests
  FOR SELECT
  USING (
    organizer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- Insertion: uniquement l'organisateur demandeur
CREATE POLICY tournament_payout_requests_insert ON tournament_payout_requests
  FOR INSERT
  WITH CHECK (
    organizer_id = auth.uid()
  );

-- Update: admins uniquement (approbation/rejet)
CREATE POLICY tournament_payout_requests_update ON tournament_payout_requests
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE OR REPLACE FUNCTION set_tournament_payout_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tournament_payout_requests_updated_at ON tournament_payout_requests;

CREATE TRIGGER tournament_payout_requests_updated_at
  BEFORE UPDATE ON tournament_payout_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_tournament_payout_request_updated_at();

NOTIFY pgrst, 'reload schema';
