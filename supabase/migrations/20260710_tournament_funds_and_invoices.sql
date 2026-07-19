-- =============================================
-- LEDGER DES FONDS TOURNOI + RÈGLES D'AVANCE + FACTURES + LITIGES
-- =============================================
-- Version sûre : aucun DROP POLICY, pas d'opération destructive.
-- Les politiques RLS sont créées uniquement si elles n'existent pas (via DO + pg_policies).

-- =============================================
-- 1. LEDGER DES FONDS TOURNOI
-- =============================================
-- Chaque mouvement financier d'un tournoi est journalisé de façon immuable.
-- entry_type:
--   collection    : encaissement inscription équipe (+)
--   refund        : remboursement équipe (-)
--   venue_advance : avance versée directement au terrain (-)
--   logistics_advance : avance logistique versée à l'organisateur (-)
--   platform_fee  : commission plateforme (-)
--   organizer_release : libération du solde organisateur après tournoi (-)

CREATE TABLE IF NOT EXISTS tournament_funds_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'collection', 'refund', 'venue_advance', 'logistics_advance',
    'platform_fee', 'organizer_release'
  )),
  amount INTEGER NOT NULL, -- positif = entrée, négatif = sortie (FCFA)
  reference_type TEXT, -- 'tournament_payment' | 'payout_request' | 'manual'
  reference_id UUID,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funds_ledger_tournament ON tournament_funds_ledger(tournament_id);
CREATE INDEX IF NOT EXISTS idx_funds_ledger_type ON tournament_funds_ledger(entry_type);
CREATE INDEX IF NOT EXISTS idx_funds_ledger_created ON tournament_funds_ledger(created_at DESC);

ALTER TABLE tournament_funds_ledger ENABLE ROW LEVEL SECURITY;

-- Création des politiques uniquement si elles n'existent pas (pas de DROP)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tournament_funds_ledger' AND policyname = 'funds_ledger_select'
  ) THEN
    CREATE POLICY funds_ledger_select ON tournament_funds_ledger
      FOR SELECT
      USING (
        tournament_id IN (SELECT id FROM tournaments WHERE created_by = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tournament_funds_ledger' AND policyname = 'funds_ledger_insert'
  ) THEN
    CREATE POLICY funds_ledger_insert ON tournament_funds_ledger
      FOR INSERT
      WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
      );
  END IF;
END
$$;

-- Pas de UPDATE/DELETE: le ledger est immuable (aucune policy = interdit)

-- =============================================
-- 2. FONCTIONS DE CALCUL DES FONDS
-- =============================================

-- Net encaissé (encaissements - remboursements)
CREATE OR REPLACE FUNCTION get_tournament_net_collected(p_tournament_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE((
    SELECT SUM(amount)
    FROM tournament_funds_ledger
    WHERE tournament_id = p_tournament_id
    AND entry_type IN ('collection', 'refund')
  ), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Total déjà avancé (avances terrain + logistique)
CREATE OR REPLACE FUNCTION get_tournament_total_advanced(p_tournament_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE((
    SELECT ABS(SUM(amount))
    FROM tournament_funds_ledger
    WHERE tournament_id = p_tournament_id
    AND entry_type IN ('venue_advance', 'logistics_advance')
  ), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Taux de remplissage du tournoi (équipes confirmées / max_teams) en pourcentage
CREATE OR REPLACE FUNCTION get_tournament_fill_rate(p_tournament_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_max_teams INTEGER;
  v_confirmed INTEGER;
BEGIN
  SELECT max_teams INTO v_max_teams FROM tournaments WHERE id = p_tournament_id;
  IF v_max_teams IS NULL OR v_max_teams = 0 THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO v_confirmed
  FROM tournament_teams
  WHERE tournament_id = p_tournament_id
  AND status = 'confirmed';

  RETURN (v_confirmed * 100) / v_max_teams;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- 3. CHAMPS SUPPLÉMENTAIRES SUR LES DEMANDES D'AVANCE
-- =============================================

-- Terrain lié (obligatoire pour les avances de type 'venue')
ALTER TABLE tournament_payout_requests
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;

-- Statut de versement effectif après approbation
--   not_sent | sent_to_venue | sent_to_organizer
ALTER TABLE tournament_payout_requests
  ADD COLUMN IF NOT EXISTS disbursement_status TEXT NOT NULL DEFAULT 'not_sent'
    CHECK (disbursement_status IN ('not_sent', 'sent_to_venue', 'sent_to_organizer'));

ALTER TABLE tournament_payout_requests
  ADD COLUMN IF NOT EXISTS disbursed_at TIMESTAMPTZ;

ALTER TABLE tournament_payout_requests
  ADD COLUMN IF NOT EXISTS disbursement_transaction_id TEXT;

CREATE INDEX IF NOT EXISTS idx_payout_requests_venue ON tournament_payout_requests(venue_id);

-- =============================================
-- 4. LITIGES TOURNOI
-- =============================================
-- Un litige majeur ouvert bloque la libération des fonds organisateur.

CREATE TABLE IF NOT EXISTS tournament_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor', 'major')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved')),
  resolution_note TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_tournament ON tournament_disputes(tournament_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON tournament_disputes(status);

ALTER TABLE tournament_disputes ENABLE ROW LEVEL SECURITY;

-- Création des politiques uniquement si elles n'existent pas (pas de DROP)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tournament_disputes' AND policyname = 'disputes_select'
  ) THEN
    CREATE POLICY disputes_select ON tournament_disputes
      FOR SELECT
      USING (
        reported_by = auth.uid()
        OR tournament_id IN (SELECT id FROM tournaments WHERE created_by = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tournament_disputes' AND policyname = 'disputes_insert'
  ) THEN
    CREATE POLICY disputes_insert ON tournament_disputes
      FOR INSERT
      WITH CHECK (
        reported_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM tournament_teams tt
          JOIN teams t ON t.id = tt.team_id
          WHERE tt.tournament_id = tournament_disputes.tournament_id
          AND t.captain_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tournament_disputes' AND policyname = 'disputes_update'
  ) THEN
    CREATE POLICY disputes_update ON tournament_disputes
      FOR UPDATE
      USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
      );
  END IF;
END
$$;

-- Vérifie si un tournoi a un litige majeur ouvert
CREATE OR REPLACE FUNCTION has_open_major_dispute(p_tournament_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tournament_disputes
    WHERE tournament_id = p_tournament_id
    AND severity = 'major'
    AND status IN ('open', 'investigating')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Vérifie si les fonds organisateur peuvent être libérés
-- (fin du tournoi + 24h ET aucun litige majeur ouvert)
CREATE OR REPLACE FUNCTION can_release_organizer_funds(p_tournament_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_end_date TIMESTAMPTZ;
BEGIN
  SELECT end_date INTO v_end_date FROM tournaments WHERE id = p_tournament_id;
  IF v_end_date IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN NOW() >= (v_end_date + INTERVAL '24 hours')
    AND NOT has_open_major_dispute(p_tournament_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- 5. FACTURES (INVOICES)
-- =============================================
-- document_type:
--   invoice        : facture pour paiement reçu
--   credit_note    : avoir (remboursement/annulation)
--   payout_receipt : reçu de décaissement (avances)
-- context_type:
--   booking | tournament_registration | venue_advance | logistics_advance | organizer_release

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT NOT NULL UNIQUE,
  document_type TEXT NOT NULL DEFAULT 'invoice'
    CHECK (document_type IN ('invoice', 'credit_note', 'payout_receipt')),
  context_type TEXT NOT NULL
    CHECK (context_type IN ('booking', 'tournament_registration', 'venue_advance', 'logistics_advance', 'organizer_release')),
  context_id UUID NOT NULL, -- booking_id / tournament_payment_id / payout_request_id
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XOF',
  payer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  beneficiary_id UUID REFERENCES users(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  payment_method TEXT, -- 'geniuspay' | 'wave' | 'orange' | etc.
  payment_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued', 'paid', 'refunded', 'cancelled')),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_payer ON invoices(payer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_beneficiary ON invoices(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_invoices_context ON invoices(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Création des politiques uniquement si elles n'existent pas (pas de DROP)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'invoices_select'
  ) THEN
    CREATE POLICY invoices_select ON invoices
      FOR SELECT
      USING (
        payer_id = auth.uid()
        OR beneficiary_id = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'invoices_insert'
  ) THEN
    CREATE POLICY invoices_insert ON invoices
      FOR INSERT
      WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'invoices_update'
  ) THEN
    CREATE POLICY invoices_update ON invoices
      FOR UPDATE
      USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
      );
  END IF;
END
$$;

-- Séquence de numérotation des factures
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_invoice_number(p_prefix TEXT DEFAULT 'INV')
RETURNS TEXT AS $$
BEGIN
  RETURN p_prefix || '-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('invoice_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
