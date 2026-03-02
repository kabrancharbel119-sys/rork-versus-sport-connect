-- =============================================
-- DIAGNOSTIC + CORRECTION DU SCHÉMA (teams, matches, tournaments)
-- =============================================
-- Exécuter dans Supabase : SQL Editor > New query > Coller tout > Run.
-- 1) Affiche les colonnes actuelles (diagnostic)
-- 2) Ajoute toutes les colonnes manquantes avec des valeurs par défaut
-- =============================================

-- ========== PARTIE 1 : DIAGNOSTIC (lecture seule) ==========
-- Décommenter le bloc ci-dessous pour lister les colonnes avant correction :
/*
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('teams', 'matches', 'tournaments')
ORDER BY table_name, ordinal_position;
*/

-- ========== PARTIE 2 : CORRECTION TABLE teams ==========
ALTER TABLE teams ADD COLUMN IF NOT EXISTS format TEXT DEFAULT '11v11';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'intermediate';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS ambiance TEXT DEFAULT 'competitive';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS country TEXT DEFAULT '';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS captain_id UUID;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ========== PARTIE 3 : CORRECTION TABLE matches ==========
-- Colonnes obligatoires ou utilisées par l'app / seeds
ALTER TABLE matches ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Match';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_type TEXT DEFAULT 'friendly';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS sport TEXT DEFAULT 'football';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'friendly';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS format TEXT DEFAULT '11v11';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS date_time TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE matches ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE matches ADD COLUMN IF NOT EXISTS venue_id UUID;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS venue_data JSONB;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_team_id UUID;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_team_id UUID;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 90;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'intermediate';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS ambiance TEXT DEFAULT 'competitive';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 22;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS registered_players JSONB DEFAULT '[]'::jsonb;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_home INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_away INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_id UUID;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS round_label TEXT;

-- Contrainte status matches : alignée sur l'app (open, confirmed, in_progress, completed, cancelled)
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;
-- Corriger les lignes existantes dont le status n'est pas dans la liste autorisée
UPDATE matches SET status = 'open' WHERE status IS NULL OR status NOT IN ('open', 'confirmed', 'in_progress', 'completed', 'cancelled');
ALTER TABLE matches ADD CONSTRAINT matches_status_check
  CHECK (status IN ('open', 'confirmed', 'in_progress', 'completed', 'cancelled'));

-- Si start_time existe en NOT NULL sans défaut : mettre à jour les lignes NULL (après ajout si besoin)
-- UPDATE matches SET start_time = COALESCE(date_time, created_at, NOW()) WHERE start_time IS NULL;

-- ========== PARTIE 4 : CORRECTION TABLE tournaments ==========
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS sport TEXT DEFAULT 'football';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS format TEXT DEFAULT '11v11';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'knockout';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'registration';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'intermediate';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS max_teams INTEGER DEFAULT 16;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registered_teams JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS entry_fee REAL DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prize_pool REAL DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prizes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS venue_data JSONB;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS match_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS winner_id UUID;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS sponsor_name TEXT;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS sponsor_logo TEXT;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS created_by UUID;

-- Contrainte status tournois
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_status_check;
ALTER TABLE tournaments ADD CONSTRAINT tournaments_status_check
  CHECK (status IN ('registration', 'in_progress', 'completed'));

-- ========== PARTIE 5 : SYNCHRONISER date_time / start_time sur matches ==========
-- Si votre table a start_time NOT NULL et des lignes avec date_time renseigné mais start_time NULL :
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'date_time'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'start_time'
  ) THEN
    UPDATE matches SET start_time = date_time WHERE start_time IS NULL AND date_time IS NOT NULL;
    UPDATE matches SET start_time = NOW() WHERE start_time IS NULL;
  END IF;
END $$;

-- ========== RÉSUMÉ : colonnes après correction ==========
SELECT 'teams' AS table_name, count(*) AS column_count FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'teams'
UNION ALL
SELECT 'matches', count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches'
UNION ALL
SELECT 'tournaments', count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments';
