-- =============================================
-- SYSTÈME DE PAIEMENT POUR TOURNOIS
-- =============================================
-- Ce système gère les paiements centralisés via Wave/Orange Money
-- Tous les paiements sont envoyés à un numéro ADMIN unique
-- Seuls les admins peuvent valider les paiements

-- =============================================
-- TABLE: tournament_payments
-- =============================================
-- Stocke tous les paiements pour les inscriptions aux tournois
CREATE TABLE IF NOT EXISTS tournament_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('wave', 'orange')),
  receiver TEXT NOT NULL DEFAULT 'admin',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  screenshot_url TEXT,
  transaction_ref TEXT,
  expected_sender_name TEXT,
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  payment_deadline TIMESTAMPTZ,
  -- Champs pour distribution future (non utilisés maintenant)
  payout_status TEXT DEFAULT 'pending' CHECK (payout_status IN ('pending', 'sent')),
  organizer_amount REAL DEFAULT 0,
  platform_fee REAL DEFAULT 0,
  -- Contraintes
  UNIQUE(tournament_id, team_id)
);

-- Sécurise la migration si la table existait déjà sans certaines colonnes
ALTER TABLE tournament_payments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE tournament_payments
  ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMPTZ;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_tournament_payments_tournament ON tournament_payments(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_payments_team ON tournament_payments(team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_payments_status ON tournament_payments(status);
CREATE INDEX IF NOT EXISTS idx_tournament_payments_deadline ON tournament_payments(payment_deadline);

-- =============================================
-- TABLE: payment_logs
-- =============================================
-- Logs de toutes les actions sur les paiements
CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES tournament_payments(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_payment_logs_payment ON payment_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_timestamp ON payment_logs(timestamp DESC);

-- =============================================
-- TABLE: tournament_teams
-- =============================================
-- Table de liaison entre tournois et équipes avec statut de paiement
CREATE TABLE IF NOT EXISTS tournament_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'payment_submitted', 'confirmed', 'rejected', 'cancelled')),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  -- Contraintes
  UNIQUE(tournament_id, team_id)
);

-- Sécurise la migration si la table existait déjà sans certaines colonnes
ALTER TABLE tournament_teams
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_payment';

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament ON tournament_teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_team ON tournament_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_status ON tournament_teams(status);

-- =============================================
-- FONCTIONS UTILITAIRES
-- =============================================

-- Fonction pour compter les équipes confirmées + en attente de validation
CREATE OR REPLACE FUNCTION count_reserved_spots(p_tournament_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM tournament_teams
    WHERE tournament_id = p_tournament_id
    AND status IN ('confirmed', 'payment_submitted')
  );
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier si un tournoi a des places disponibles
CREATE OR REPLACE FUNCTION has_available_spots(p_tournament_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_max_teams INTEGER;
  v_reserved INTEGER;
BEGIN
  SELECT max_teams INTO v_max_teams
  FROM tournaments
  WHERE id = p_tournament_id;
  
  v_reserved := count_reserved_spots(p_tournament_id);
  
  RETURN v_reserved < v_max_teams;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour annuler les paiements expirés
CREATE OR REPLACE FUNCTION cancel_expired_payments()
RETURNS void AS $$
BEGIN
  -- Mettre à jour les équipes dont le paiement a expiré
  UPDATE tournament_teams tt
  SET status = 'cancelled'
  FROM tournament_payments tp
  WHERE tt.tournament_id = tp.tournament_id
  AND tt.team_id = tp.team_id
  AND tt.status = 'payment_submitted'
  AND tp.status = 'submitted'
  AND tp.payment_deadline < NOW();
  
  -- Mettre à jour les paiements expirés
  UPDATE tournament_payments
  SET status = 'rejected'
  WHERE status = 'submitted'
  AND payment_deadline < NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RLS (Row Level Security)
-- =============================================

ALTER TABLE tournament_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;

-- Idempotence: supprimer les policies existantes avant recréation
DROP POLICY IF EXISTS tournament_payments_select ON tournament_payments;
DROP POLICY IF EXISTS tournament_payments_insert ON tournament_payments;
DROP POLICY IF EXISTS tournament_payments_update ON tournament_payments;
DROP POLICY IF EXISTS payment_logs_select ON payment_logs;
DROP POLICY IF EXISTS payment_logs_insert ON payment_logs;
DROP POLICY IF EXISTS tournament_teams_select ON tournament_teams;
DROP POLICY IF EXISTS tournament_teams_insert ON tournament_teams;
DROP POLICY IF EXISTS tournament_teams_update ON tournament_teams;

-- Politique pour tournament_payments
-- Lecture: tout le monde peut voir les paiements de son équipe + admins
CREATE POLICY tournament_payments_select ON tournament_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = tournament_payments.team_id 
      AND (teams.captain_id = auth.uid() OR teams.members ? auth.uid()::text)
    )
    OR
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- Insertion: seul le capitaine peut créer un paiement
CREATE POLICY tournament_payments_insert ON tournament_payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = tournament_payments.team_id 
      AND teams.captain_id = auth.uid()
    )
  );

-- Mise à jour: seuls les admins peuvent mettre à jour
CREATE POLICY tournament_payments_update ON tournament_payments
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- Politique pour payment_logs
-- Lecture: admins et membres de l'équipe concernée
CREATE POLICY payment_logs_select ON payment_logs
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    OR
    EXISTS (
      SELECT 1 FROM tournament_payments tp
      JOIN teams t ON t.id = tp.team_id
      WHERE tp.id = payment_logs.payment_id
      AND t.captain_id = auth.uid()
    )
  );

-- Insertion: tout le monde peut créer des logs
CREATE POLICY payment_logs_insert ON payment_logs
  FOR INSERT
  WITH CHECK (true);

-- Politique pour tournament_teams
-- Lecture: tout le monde peut voir les équipes inscrites
CREATE POLICY tournament_teams_select ON tournament_teams
  FOR SELECT
  USING (true);

-- Insertion: seul le capitaine peut inscrire son équipe
CREATE POLICY tournament_teams_insert ON tournament_teams
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = tournament_teams.team_id 
      AND teams.captain_id = auth.uid()
    )
  );

-- Mise à jour: admins et capitaines
CREATE POLICY tournament_teams_update ON tournament_teams
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    OR
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = tournament_teams.team_id 
      AND teams.captain_id = auth.uid()
    )
  );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
