-- ============================================================================
-- Migration: Application des corrections E2E en production (Version Corrigée)
-- Date: 2026-03-02
-- Description: Validation, contraintes, et corrections identifiées dans les tests E2E
-- ============================================================================

-- ============================================================================
-- PARTIE 1: CORRIGER LES DONNÉES EXISTANTES AVANT D'AJOUTER LES CONTRAINTES
-- ============================================================================

-- 1.1 Corriger les matches avec des valeurs invalides
UPDATE matches SET entry_fee = 0 WHERE entry_fee < 0 OR entry_fee IS NULL;
UPDATE matches SET max_players = 2 WHERE max_players < 2 OR max_players IS NULL;
UPDATE matches SET prize = 0 WHERE prize < 0 OR prize IS NULL;

-- 1.2 Corriger les users avec bio NULL
UPDATE users SET bio = '' WHERE bio IS NULL;

-- ============================================================================
-- PARTIE 2: CONTRAINTES DE VALIDATION SUR MATCHES
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
-- PARTIE 3: VALIDATION DES STATS JSONB SUR USERS
-- ============================================================================

-- Fonction de validation pour stats JSONB
CREATE OR REPLACE FUNCTION validate_user_stats(stats JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Si stats est NULL, retourner false
  IF stats IS NULL THEN
    RETURN false;
  END IF;
  
  -- Vérifier que tous les champs requis sont présents et sont des nombres
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

-- Corriger tous les utilisateurs avec stats invalides ou manquants
UPDATE users
SET stats = jsonb_build_object(
  'matchesPlayed', COALESCE((stats->>'matchesPlayed')::int, 0),
  'wins', COALESCE((stats->>'wins')::int, 0),
  'losses', COALESCE((stats->>'losses')::int, 0),
  'draws', COALESCE((stats->>'draws')::int, 0),
  'goalsScored', COALESCE((stats->>'goalsScored')::int, 0),
  'assists', COALESCE((stats->>'assists')::int, 0),
  'mvpCount', COALESCE((stats->>'mvpCount')::int, 0),
  'fairPlayScore', COALESCE((stats->>'fairPlayScore')::int, 0),
  'tournamentsWon', COALESCE((stats->>'tournamentsWon')::int, 0),
  'cashPrizesTotal', COALESCE((stats->>'cashPrizesTotal')::int, 0)
)
WHERE stats IS NULL 
   OR NOT validate_user_stats(stats);

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
-- PARTIE 4: TRIGGER POUR INITIALISER LES STATS AUTOMATIQUEMENT
-- ============================================================================

-- Fonction pour initialiser les stats par défaut
CREATE OR REPLACE FUNCTION initialize_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stats IS NULL OR NEW.stats = '{}'::jsonb OR NOT validate_user_stats(NEW.stats) THEN
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
-- PARTIE 5: BIO VIDE AUTORISÉE
-- ============================================================================

-- Permettre bio vide (retirer contrainte NOT NULL si elle existe)
ALTER TABLE users ALTER COLUMN bio DROP NOT NULL;

-- Ajouter valeur par défaut vide pour bio
ALTER TABLE users ALTER COLUMN bio SET DEFAULT '';

-- ============================================================================
-- PARTIE 6: INDEX POUR PERFORMANCES
-- ============================================================================

-- Index sur matches.venue_id pour les jointures
CREATE INDEX IF NOT EXISTS idx_matches_venue_id ON matches(venue_id);

-- Index sur matches.created_by pour les requêtes par créateur
CREATE INDEX IF NOT EXISTS idx_matches_created_by ON matches(created_by);

-- ============================================================================
-- PARTIE 7: POLITIQUES RLS (OPTIONNEL - À ADAPTER SELON VOS TABLES)
-- ============================================================================

-- Note: Cette partie est commentée car elle dépend de la structure exacte de votre table notifications
-- Décommentez et adaptez selon vos besoins

/*
-- Vérifier si la table notifications existe
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'notifications') THEN
    -- Activer RLS sur notifications si pas déjà fait
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    
    -- Supprimer les anciennes politiques si elles existent
    DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
    DROP POLICY IF EXISTS "System can create notifications" ON notifications;
    
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
    CREATE POLICY "System can create notifications"
    ON notifications
    FOR INSERT
    WITH CHECK (true);
    
    -- Index sur notifications.user_id pour les requêtes par utilisateur
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
  END IF;
END $$;
*/

-- ============================================================================
-- PARTIE 8: COMMENTAIRES ET DOCUMENTATION
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

-- ============================================================================
-- VÉRIFICATIONS FINALES
-- ============================================================================

-- Vérifier que toutes les contraintes sont actives
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'matches'::regclass
  AND conname LIKE 'matches_%_check';

-- Vérifier qu'il n'y a plus de stats invalides
SELECT 
  COUNT(*) as users_with_invalid_stats
FROM users
WHERE NOT validate_user_stats(stats);

-- Afficher un message de succès
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20260302_production_fixes_v2 appliquée avec succès !';
  RAISE NOTICE '✅ Contraintes ajoutées sur matches (entry_fee, max_players, prize)';
  RAISE NOTICE '✅ Validation stats JSONB activée sur users';
  RAISE NOTICE '✅ Trigger d''initialisation stats créé';
  RAISE NOTICE '✅ Bio vide autorisée';
  RAISE NOTICE '✅ Index de performance créés';
END $$;
