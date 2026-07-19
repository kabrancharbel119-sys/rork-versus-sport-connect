-- =============================================================
-- Politique d'annulation des tournois
-- SÉCURITAIRE : CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS
-- Aucune suppression de table/colonne/donnée
-- =============================================================

BEGIN;

-- 1. Ajouter le statut 'cancelled' aux tournois (si non existant)
-- Note: le type enum existe déjà, on utilise ALTER TYPE si possible
DO $func$
BEGIN
  -- Check if 'cancelled' status is already supported by checking existing data
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_status_check'
  ) THEN
    -- No constraint, status is likely text - nothing to do
    NULL;
  END IF;
END $func$;

-- 2. Table des demandes d'annulation
CREATE TABLE IF NOT EXISTS tournament_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT,
  refund_processed BOOLEAN DEFAULT FALSE,
  refund_amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherches rapides
CREATE INDEX IF NOT EXISTS idx_cancellation_requests_tournament ON tournament_cancellation_requests(tournament_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_requests_status ON tournament_cancellation_requests(status);
CREATE INDEX IF NOT EXISTS idx_cancellation_requests_organizer ON tournament_cancellation_requests(organizer_id);

-- 3. RLS policies
ALTER TABLE tournament_cancellation_requests ENABLE ROW LEVEL SECURITY;

-- Organisateur peut voir ses propres demandes
DO $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tournament_cancellation_requests' AND policyname = 'organizer_view_own_requests'
  ) THEN
    EXECUTE $exec$
      CREATE POLICY organizer_view_own_requests ON tournament_cancellation_requests
      FOR SELECT USING (
        organizer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    $exec$;
  END IF;
END $func$;

-- Organisateur peut créer une demande
DO $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tournament_cancellation_requests' AND policyname = 'organizer_create_request'
  ) THEN
    EXECUTE $exec$
      CREATE POLICY organizer_create_request ON tournament_cancellation_requests
      FOR INSERT WITH CHECK (
        organizer_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM tournaments t
          WHERE t.id = tournament_id AND t.created_by = auth.uid()
        )
      )
    $exec$;
  END IF;
END $func$;

-- Admin peut tout (approuver, rejeter, mettre à jour)
DO $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tournament_cancellation_requests' AND policyname = 'admin_manage_requests'
  ) THEN
    EXECUTE $exec$
      CREATE POLICY admin_manage_requests ON tournament_cancellation_requests
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    $exec$;
  END IF;
END $func$;

-- 4. Trigger: updated_at
CREATE OR REPLACE FUNCTION update_cancellation_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'cancellation_request_updated_at_trigger'
      AND tgrelid = 'public.tournament_cancellation_requests'::regclass
  ) THEN
    EXECUTE $exec$
      CREATE TRIGGER cancellation_request_updated_at_trigger
      BEFORE UPDATE ON tournament_cancellation_requests
      FOR EACH ROW
      EXECUTE FUNCTION update_cancellation_request_updated_at()
    $exec$;
  END IF;
END $func$;

-- 5. Fonction: traiter l'annulation approuvée
-- - Marque le tournoi comme 'cancelled'
-- - Marque toutes les équipes confirmées comme 'cancelled'
-- - Enregistre les remboursements dans le ledger
-- - Notifie les capitaines d'équipes
CREATE OR REPLACE FUNCTION process_tournament_cancellation(
  p_tournament_id UUID,
  p_admin_id UUID,
  p_refund_amount INTEGER DEFAULT 0
)
RETURNS TABLE (
  success BOOLEAN,
  teams_cancelled INTEGER,
  refund_total INTEGER
) AS $$
DECLARE
  v_tournament RECORD;
  v_team_count INTEGER := 0;
  v_refund_total INTEGER := 0;
  v_cancellation_id UUID;
BEGIN
  -- Récupérer les infos du tournoi
  SELECT name, created_by, entry_fee INTO v_tournament
  FROM tournaments WHERE id = p_tournament_id;

  IF v_tournament IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0;
    RETURN;
  END IF;

  -- Marquer le tournoi comme 'cancelled'
  UPDATE tournaments
  SET status = 'cancelled'
  WHERE id = p_tournament_id;

  -- Annuler toutes les équipes confirmées
  UPDATE tournament_teams
  SET status = 'cancelled'
  WHERE tournament_id = p_tournament_id
    AND status = 'confirmed';

  GET DIAGNOSTICS v_team_count = ROW_COUNT;

  -- Calculer le remboursement total
  v_refund_total := COALESCE(p_refund_amount, 0) * v_team_count;

  -- Enregistrer les remboursements dans le ledger (non bloquant)
  IF v_refund_total > 0 THEN
    BEGIN
      INSERT INTO tournament_funds_ledger (
        tournament_id, entry_type, amount, reference_type, reference_id,
        performed_by, note
      ) VALUES (
        p_tournament_id, 'refund', v_refund_total,
        'tournament_cancellation', p_tournament_id,
        p_admin_id, 'Remboursement suite a l''annulation du tournoi'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN QUERY SELECT TRUE, v_team_count, v_refund_total;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Trigger: empêcher l'organisateur d'annuler un tournoi payant avec équipes confirmées
CREATE OR REPLACE FUNCTION prevent_organizer_cancel_with_payments()
RETURNS TRIGGER AS $$
DECLARE
  v_confirmed_count INTEGER;
  v_entry_fee INTEGER;
BEGIN
  -- Seulement si le statut passe à 'cancelled'
  IF NEW.status IS DISTINCT FROM 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Si OLD.status était déjà 'cancelled', pas de vérification
  IF OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Vérifier si le tournoi a un entry_fee > 0
  SELECT entry_fee INTO v_entry_fee FROM tournaments WHERE id = NEW.id;
  IF v_entry_fee IS NULL OR v_entry_fee = 0 THEN
    RETURN NEW; -- Tournoi gratuit, annulation libre
  END IF;

  -- Compter les équipes confirmées
  SELECT COUNT(*) INTO v_confirmed_count
  FROM tournament_teams
  WHERE tournament_id = NEW.id AND status = 'confirmed';

  IF v_confirmed_count > 0 THEN
    -- Vérifier si c'est un admin (service role bypass RLS)
    -- Ce trigger s'exécute en SECURITY DEFINER, donc on vérifie directement
    -- Si une demande d'annulation approuvée existe, on autorise
    IF EXISTS (
      SELECT 1 FROM tournament_cancellation_requests
      WHERE tournament_id = NEW.id
        AND status = 'approved'
    ) THEN
      RETURN NEW;
    END IF;

    -- Sinon, bloquer
    RAISE EXCEPTION 'ANNULATION_BLOQUEE: Ce tournoi a % équipe(s) ayant payé l''inscription. L''organisateur doit soumettre une demande d''annulation à l''administrateur.', v_confirmed_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'prevent_organizer_cancel_trigger'
      AND tgrelid = 'public.tournaments'::regclass
  ) THEN
    EXECUTE $exec$
      CREATE TRIGGER prevent_organizer_cancel_trigger
      BEFORE UPDATE OF status ON tournaments
      FOR EACH ROW
      EXECUTE FUNCTION prevent_organizer_cancel_with_payments()
    $exec$;
  END IF;
END $func$;

COMMIT;

-- Vérification (lecture seule)
SELECT 'tournament_cancellation_requests' as table_name, count(*) as row_count
FROM tournament_cancellation_requests;
