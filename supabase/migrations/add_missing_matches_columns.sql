-- ============================================
-- FIX MATCHES TABLE - COMPLETE SETUP
-- Correction complète de la table matches avec toutes les colonnes requises
-- ============================================

-- 1. Modifier la colonne title pour la rendre nullable avec valeur par défaut
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'matches' AND column_name = 'title') THEN
    ALTER TABLE matches ALTER COLUMN title DROP NOT NULL;
    ALTER TABLE matches ALTER COLUMN title SET DEFAULT 'Match';
    RAISE NOTICE '✓ Colonne title modifiée (nullable + default)';
  ELSE
    ALTER TABLE matches ADD COLUMN title TEXT DEFAULT 'Match';
    RAISE NOTICE '✓ Colonne title ajoutée';
  END IF;
END $$;

-- 1b. Ajouter la colonne match_type si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'match_type') THEN
    ALTER TABLE matches ADD COLUMN match_type TEXT DEFAULT 'friendly';
    RAISE NOTICE '✓ Colonne match_type ajoutée';
  ELSE
    RAISE NOTICE '✓ Colonne match_type existe déjà';
  END IF;
END $$;

-- 1c. Ajouter la colonne start_time si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'start_time') THEN
    ALTER TABLE matches ADD COLUMN start_time TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE '✓ Colonne start_time ajoutée';
  ELSE
    RAISE NOTICE '✓ Colonne start_time existe déjà';
  END IF;
END $$;

-- 2. Vérifier et corriger le type de venue_data (doit être JSONB)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'matches' AND column_name = 'venue_data' 
             AND data_type != 'jsonb') THEN
    ALTER TABLE matches ALTER COLUMN venue_data TYPE JSONB USING venue_data::jsonb;
    RAISE NOTICE '✓ Colonne venue_data convertie en JSONB';
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'matches' AND column_name = 'venue_data') THEN
    ALTER TABLE matches ADD COLUMN venue_data JSONB;
    RAISE NOTICE '✓ Colonne venue_data ajoutée (JSONB)';
  ELSE
    RAISE NOTICE '✓ Colonne venue_data déjà en JSONB';
  END IF;
END $$;

-- 3. Vérifier et corriger le type de registered_players (doit être JSONB)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'matches' AND column_name = 'registered_players' 
             AND data_type != 'jsonb') THEN
    ALTER TABLE matches ALTER COLUMN registered_players TYPE JSONB USING registered_players::jsonb;
    RAISE NOTICE '✓ Colonne registered_players convertie en JSONB';
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'matches' AND column_name = 'registered_players') THEN
    ALTER TABLE matches ADD COLUMN registered_players JSONB DEFAULT '[]'::jsonb;
    RAISE NOTICE '✓ Colonne registered_players ajoutée (JSONB)';
  ELSE
    RAISE NOTICE '✓ Colonne registered_players déjà en JSONB';
  END IF;
END $$;

-- 4. Vérifier et corriger le type de player_stats (doit être JSONB)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'player_stats') THEN
    ALTER TABLE matches ADD COLUMN player_stats JSONB DEFAULT '[]'::jsonb;
    RAISE NOTICE '✓ Colonne player_stats ajoutée (JSONB)';
  ELSE
    RAISE NOTICE '✓ Colonne player_stats existe déjà';
  END IF;
END $$;

-- Ajouter la colonne needs_players si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'needs_players') THEN
    ALTER TABLE matches ADD COLUMN needs_players BOOLEAN DEFAULT true;
    RAISE NOTICE 'Colonne needs_players ajoutée à la table matches';
  ELSE
    RAISE NOTICE 'Colonne needs_players existe déjà';
  END IF;
END $$;

-- Ajouter la colonne tournament_id si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'tournament_id') THEN
    ALTER TABLE matches ADD COLUMN tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL;
    RAISE NOTICE 'Colonne tournament_id ajoutée à la table matches';
  ELSE
    RAISE NOTICE 'Colonne tournament_id existe déjà';
  END IF;
END $$;

-- Ajouter la colonne round_label si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'round_label') THEN
    ALTER TABLE matches ADD COLUMN round_label TEXT;
    RAISE NOTICE 'Colonne round_label ajoutée à la table matches';
  ELSE
    RAISE NOTICE 'Colonne round_label existe déjà';
  END IF;
END $$;

-- Ajouter la colonne entry_fee si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'entry_fee') THEN
    ALTER TABLE matches ADD COLUMN entry_fee INTEGER DEFAULT 0;
    RAISE NOTICE 'Colonne entry_fee ajoutée à la table matches';
  ELSE
    RAISE NOTICE 'Colonne entry_fee existe déjà';
  END IF;
END $$;

-- Ajouter la colonne prize si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'prize') THEN
    ALTER TABLE matches ADD COLUMN prize INTEGER DEFAULT 0;
    RAISE NOTICE 'Colonne prize ajoutée à la table matches';
  ELSE
    RAISE NOTICE 'Colonne prize existe déjà';
  END IF;
END $$;

-- Ajouter la colonne location_lat si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'location_lat') THEN
    ALTER TABLE matches ADD COLUMN location_lat NUMERIC(10,7);
    RAISE NOTICE 'Colonne location_lat ajoutée à la table matches';
  ELSE
    RAISE NOTICE 'Colonne location_lat existe déjà';
  END IF;
END $$;

-- Ajouter la colonne location_lng si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'location_lng') THEN
    ALTER TABLE matches ADD COLUMN location_lng NUMERIC(10,7);
    RAISE NOTICE 'Colonne location_lng ajoutée à la table matches';
  ELSE
    RAISE NOTICE 'Colonne location_lng existe déjà';
  END IF;
END $$;

-- Ajouter la colonne player_stats si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'player_stats') THEN
    ALTER TABLE matches ADD COLUMN player_stats JSONB DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Colonne player_stats ajoutée à la table matches';
  ELSE
    RAISE NOTICE 'Colonne player_stats existe déjà';
  END IF;
END $$;

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_matches_needs_players ON matches(needs_players) WHERE needs_players = true;
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id) WHERE tournament_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_location ON matches(location_lat, location_lng) WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

-- Vérification des colonnes de la table matches
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'matches' 
ORDER BY ordinal_position;
