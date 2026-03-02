-- Migration: Application des corrections E2E en production
-- Date: 2026-03-02
-- Description: Validation, contraintes, et corrections identifiées dans les tests E2E

-- ============================================================================
-- 1. CONTRAINTES DE VALIDATION SUR MATCHES
-- ============================================================================

-- Ajouter contrainte CHECK sur entry_fee (doit être >= 0)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'matches_entry_fee_check'
  ) THEN
    ALTER TABLE matches 
    ADD CONSTRAINT matches_entry_fee_check 
    CHECK (entry_fee >= 0);
  END IF;
END $$;

-- Ajouter contrainte CHECK sur max_players (doit être >= 2)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'matches_max_players_check'
  ) THEN
    ALTER TABLE matches 
    ADD CONSTRAINT matches_max_players_check 
    CHECK (max_players >= 2);
  END IF;
END $$;

-- Ajouter contrainte CHECK sur prize (doit être >= 0)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'matches_prize_check'
  ) THEN
    ALTER TABLE matches 
    ADD CONSTRAINT matches_prize_check 
    CHECK (prize >= 0);
  END IF;
END $$;

-- ============================================================================
-- 2. VALIDATION DES STATS JSONB SUR USERS
-- ============================================================================

-- Fonction de validation pour stats JSONB
CREATE OR REPLACE FUNCTION validate_user_stats(stats JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Vérifier que tous les champs requis sont présents
  RETURN (
    stats ? 'matchesPlayed' AND
    stats ? 'wins' AND
    stats ? 'losses' AND
    stats ? 'draws' AND
    stats ? 'goalsScored' AND
    stats ? 'assists' AND
    stats ? 'mvpCount' AND
    stats ? 'fairPlayScore' AND
    stats ? 'tournamentsWon' AND
    stats ? 'cashPrizesTotal' AND
    -- Vérifier que les valeurs sont des nombres
    jsonb_typeof(stats->'matchesPlayed') = 'number' AND
    jsonb_typeof(stats->'wins') = 'number' AND
    jsonb_typeof(stats->'losses') = 'number' AND
    jsonb_typeof(stats->'draws') = 'number' AND
    jsonb_typeof(stats->'goalsScored') = 'number' AND
    jsonb_typeof(stats->'assists') = 'number' AND
    jsonb_typeof(stats->'mvpCount') = 'number' AND
    jsonb_typeof(stats->'fairPlayScore') = 'number' AND
    jsonb_typeof(stats->'tournamentsWon') = 'number' AND
    jsonb_typeof(stats->'cashPrizesTotal') = 'number'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Ajouter contrainte CHECK sur stats
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_stats_check'
  ) THEN
    ALTER TABLE users 
    ADD CONSTRAINT users_stats_check 
    CHECK (validate_user_stats(stats));
  END IF;
END $$;

-- ============================================================================
-- 3. POLITIQUES RLS POUR NOTIFICATIONS
-- ============================================================================

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

-- Politique SELECT : Utilisateurs peuvent voir uniquement leurs propres notifications
CREATE POLICY "Users can view their own notifications"
ON notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Politique UPDATE : Utilisateurs peuvent mettre à jour uniquement leurs propres notifications
CREATE POLICY "Users can update their own notifications"
ON notifications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Politique DELETE : Utilisateurs peuvent supprimer uniquement leurs propres notifications
CREATE POLICY "Users can delete their own notifications"
ON notifications
FOR DELETE
USING (auth.uid() = user_id);

-- Politique INSERT : Système peut créer des notifications pour n'importe quel utilisateur
-- (via service_role ou triggers)
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications"
ON notifications
FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- 4. VALEURS PAR DÉFAUT POUR STATS
-- ============================================================================

-- Fonction pour initialiser les stats par défaut
CREATE OR REPLACE FUNCTION initialize_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stats IS NULL OR NEW.stats = '{}'::jsonb THEN
    NEW.stats = jsonb_build_object(
      'matchesPlayed', 0,
      'wins', 0,
      'losses', 0,
      'draws', 0,
      'goalsScored', 0,
      'assists', 0,
      'mvpCount', 0,
      'fairPlayScore', 0,
      'tournamentsWon', 0,
      'cashPrizesTotal', 0
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour initialiser les stats automatiquement
DROP TRIGGER IF EXISTS initialize_user_stats_trigger ON users;
CREATE TRIGGER initialize_user_stats_trigger
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION initialize_user_stats();

-- ============================================================================
-- 5. VALIDATION BIO VIDE
-- ============================================================================

-- Permettre bio vide (retirer contrainte NOT NULL si elle existe)
ALTER TABLE users ALTER COLUMN bio DROP NOT NULL;

-- Ajouter valeur par défaut vide pour bio
ALTER TABLE users ALTER COLUMN bio SET DEFAULT '';

-- ============================================================================
-- 6. INDEX POUR PERFORMANCES
-- ============================================================================

-- Index sur matches.venue_id pour les jointures
CREATE INDEX IF NOT EXISTS idx_matches_venue_id ON matches(venue_id);

-- Index sur matches.created_by pour les requêtes par créateur
CREATE INDEX IF NOT EXISTS idx_matches_created_by ON matches(created_by);

-- Index sur notifications.user_id pour les requêtes par utilisateur
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Index sur notifications.read pour filtrer les non-lues
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON CONSTRAINT matches_entry_fee_check ON matches IS 
'Ensure entry fee is non-negative';

COMMENT ON CONSTRAINT matches_max_players_check ON matches IS 
'Ensure at least 2 players can join a match';

COMMENT ON CONSTRAINT matches_prize_check ON matches IS 
'Ensure prize amount is non-negative';

COMMENT ON FUNCTION validate_user_stats(JSONB) IS 
'Validates that user stats JSONB contains all required fields with correct types';

COMMENT ON FUNCTION initialize_user_stats() IS 
'Automatically initializes user stats with default values on insert/update';
