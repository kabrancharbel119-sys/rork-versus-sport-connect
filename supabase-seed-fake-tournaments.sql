-- =============================================
-- FAUSSES DONNÉES TOURNOIS (pour tester le déroulé)
-- =============================================
-- Exécuter dans Supabase : SQL Editor > New query > Coller > Run.
-- Prérequis : avoir exécuté les migrations tournois + au moins 1 user et 2+ équipes.
-- Ce script ajoute 4 tournois de test : Inscriptions, En cours (avec matchs), Terminé, + un 2e En cours.
-- =============================================

-- 0) Colonnes et contrainte (si pas déjà fait)
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
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_status_check;
ALTER TABLE tournaments ADD CONSTRAINT tournaments_status_check
  CHECK (status IN ('registration', 'in_progress', 'completed'));

-- 1) Tournoi "Inscriptions ouvertes"
INSERT INTO tournaments (
  id, name, description, sport, format, type, status, level, max_teams,
  registered_teams, entry_fee, prize_pool, prizes, venue_data, start_date, end_date, match_ids, created_by, created_at
) SELECT
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'Coupe de la Ligue - Édition 2026',
  'Inscriptions ouvertes pour la coupe de la ligue. Places limitées.',
  'football', '11v11', 'knockout', 'registration', 'intermediate', 16,
  COALESCE((SELECT jsonb_agg(id) FROM (SELECT id FROM teams LIMIT 3) t), '[]'::jsonb),
  5000, 50000, '[{"position":1,"amount":30000,"label":"1er"},{"position":2,"amount":15000,"label":"2ème"}]'::jsonb,
  '{"id":"","name":"Complexe sportif Nord","address":"","city":"Abidjan"}'::jsonb,
  date_trunc('day', NOW()) + interval '14 days' + interval '9 hours',
  date_trunc('day', NOW()) + interval '21 days' + interval '18 hours',
  '[]'::jsonb,
  (SELECT id FROM users LIMIT 1),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM tournaments WHERE id = 'c1000000-0000-4000-8000-000000000001');

-- 2) Tournoi "En cours" avec matchs (pour voir le déroulé)
INSERT INTO tournaments (
  id, name, description, sport, format, type, status, level, max_teams,
  registered_teams, entry_fee, prize_pool, prizes, venue_data, start_date, end_date, match_ids, created_by, created_at
) SELECT
  'c1000000-0000-4000-8000-000000000002'::uuid,
  'Championnat Futsal Mars 2026',
  'Phase de poules et élimination directe. Suivez les matchs en direct.',
  'football', '5v5', 'knockout', 'in_progress', 'beginner', 8,
  COALESCE((SELECT jsonb_agg(id) FROM (SELECT id FROM teams LIMIT 4) t), '[]'::jsonb),
  0, 0, '[]'::jsonb,
  '{"id":"","name":"Salle Omnisports","address":"","city":"Abidjan"}'::jsonb,
  date_trunc('day', NOW()) - interval '2 days',
  date_trunc('day', NOW()) + interval '5 days',
  '[]'::jsonb,
  (SELECT id FROM users LIMIT 1),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM tournaments WHERE id = 'c1000000-0000-4000-8000-000000000002');

-- 3) Tournoi "Terminé" avec vainqueur
INSERT INTO tournaments (
  id, name, description, sport, format, type, status, level, max_teams,
  registered_teams, entry_fee, prize_pool, prizes, venue_data, start_date, end_date, match_ids, winner_id, created_by, created_at
) SELECT
  'c1000000-0000-4000-8000-000000000003'::uuid,
  'Tournoi Amical Hiver 2025',
  'Tournoi amical terminé. Résultats et classement disponibles.',
  'football', '11v11', 'knockout', 'completed', 'intermediate', 8,
  COALESCE((SELECT jsonb_agg(id) FROM (SELECT id FROM teams LIMIT 4) t), '[]'::jsonb),
  10000, 80000, '[{"position":1,"amount":50000,"label":"Vainqueur"},{"position":2,"amount":30000,"label":"Finaliste"}]'::jsonb,
  '{"id":"","name":"Stade Central","address":"","city":"Abidjan"}'::jsonb,
  date_trunc('day', NOW()) - interval '30 days',
  date_trunc('day', NOW()) - interval '23 days',
  '[]'::jsonb,
  (SELECT id FROM teams LIMIT 1),
  (SELECT id FROM users LIMIT 1),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM tournaments WHERE id = 'c1000000-0000-4000-8000-000000000003');

-- 4) Deuxième tournoi "En cours" (autre nom)
INSERT INTO tournaments (
  id, name, description, sport, format, type, status, level, max_teams,
  registered_teams, entry_fee, prize_pool, prizes, venue_data, start_date, end_date, match_ids, created_by, created_at
) SELECT
  'c1000000-0000-4000-8000-000000000004'::uuid,
  'Open Basketball 3v3 - Poule A',
  'Poule A du tournoi 3v3. Matchs en cours.',
  'basketball', '3v3', 'knockout', 'in_progress', 'intermediate', 6,
  COALESCE((SELECT jsonb_agg(id) FROM (SELECT id FROM teams LIMIT 4) t), '[]'::jsonb),
  2000, 15000, '[]'::jsonb,
  '{"id":"","name":"Terrain extérieur Centre","address":"","city":"Abidjan"}'::jsonb,
  date_trunc('day', NOW()) - interval '1 day',
  date_trunc('day', NOW()) + interval '6 days',
  '[]'::jsonb,
  (SELECT id FROM users LIMIT 1),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM tournaments WHERE id = 'c1000000-0000-4000-8000-000000000004');

-- 5) Créer des matchs pour le tournoi "En cours" (c1000000-...-000002) pour voir le déroulé
-- Nécessite au moins 2 équipes (idéalement 4 pour avoir 4 matchs).
DO $$
DECLARE
  tid UUID := 'c1000000-0000-4000-8000-000000000002';
  uid UUID;
  vid UUID;
  t1 UUID; t2 UUID; t3 UUID; t4 UUID;
  mid UUID;
  match_ids_arr JSONB := '[]'::jsonb;
  nb_matchs INT;
  vd JSONB;
BEGIN
  SELECT jsonb_array_length(COALESCE(match_ids, '[]'::jsonb)) INTO nb_matchs FROM tournaments WHERE id = tid;
  IF COALESCE(nb_matchs, 0) > 0 THEN RETURN; END IF;

  SELECT id INTO uid FROM users LIMIT 1;
  SELECT id INTO vid FROM venues LIMIT 1;
  SELECT (SELECT to_jsonb(row_to_json(v)) FROM (SELECT id, name, address, city FROM venues LIMIT 1) v) INTO vd;
  vd := COALESCE(vd, '{}'::jsonb);
  IF uid IS NULL THEN RETURN; END IF;

  SELECT id INTO t1 FROM teams LIMIT 1 OFFSET 0;
  SELECT id INTO t2 FROM teams LIMIT 1 OFFSET 1;
  SELECT id INTO t3 FROM teams LIMIT 1 OFFSET 2;
  SELECT id INTO t4 FROM teams LIMIT 1 OFFSET 3;
  IF t1 IS NULL OR t2 IS NULL THEN RETURN; END IF;

  -- Match 1 : terminé 2-1 (t1 vs t2)
  INSERT INTO matches (sport, format, type, status, home_team_id, away_team_id, venue_id, venue_data, date_time, duration, level, ambiance, max_players, registered_players, score_home, score_away, created_by)
  VALUES ('football', '5v5', 'tournament', 'completed', t1, t2, vid, vd, NOW() - interval '1 day', 40, 'beginner', 'competitive', 10, '[]'::jsonb, 2, 1, uid)
  RETURNING id INTO mid;
  match_ids_arr := match_ids_arr || to_jsonb(mid::text);

  -- Match 2 : terminé ou à venir selon équipes (t2 vs t1 ou t3 vs t4)
  IF t3 IS NOT NULL AND t4 IS NOT NULL THEN
    INSERT INTO matches (sport, format, type, status, home_team_id, away_team_id, venue_id, venue_data, date_time, duration, level, ambiance, max_players, registered_players, score_home, score_away, created_by)
    VALUES ('football', '5v5', 'tournament', 'completed', t3, t4, vid, vd, NOW() - interval '12 hours', 40, 'beginner', 'competitive', 10, '[]'::jsonb, 0, 0, uid)
    RETURNING id INTO mid;
    match_ids_arr := match_ids_arr || to_jsonb(mid::text);
    -- Match 3 : à venir
    INSERT INTO matches (sport, format, type, status, home_team_id, away_team_id, venue_id, venue_data, date_time, duration, level, ambiance, max_players, registered_players, created_by)
    VALUES ('football', '5v5', 'tournament', 'confirmed', t1, t3, vid, vd, NOW() + interval '1 day', 40, 'beginner', 'competitive', 10, '[]'::jsonb, uid)
    RETURNING id INTO mid;
    match_ids_arr := match_ids_arr || to_jsonb(mid::text);
    -- Match 4 : à venir
    INSERT INTO matches (sport, format, type, status, home_team_id, away_team_id, venue_id, venue_data, date_time, duration, level, ambiance, max_players, registered_players, created_by)
    VALUES ('football', '5v5', 'tournament', 'confirmed', t2, t4, vid, vd, NOW() + interval '2 days', 40, 'beginner', 'competitive', 10, '[]'::jsonb, uid)
    RETURNING id INTO mid;
    match_ids_arr := match_ids_arr || to_jsonb(mid::text);
  ELSE
    -- Seulement 2 équipes : un 2e match à venir (t2 vs t1)
    INSERT INTO matches (sport, format, type, status, home_team_id, away_team_id, venue_id, venue_data, date_time, duration, level, ambiance, max_players, registered_players, created_by)
    VALUES ('football', '5v5', 'tournament', 'confirmed', t2, t1, vid, vd, NOW() + interval '1 day', 40, 'beginner', 'competitive', 10, '[]'::jsonb, uid)
    RETURNING id INTO mid;
    match_ids_arr := match_ids_arr || to_jsonb(mid::text);
  END IF;

  UPDATE tournaments SET match_ids = match_ids_arr WHERE id = tid;
END $$;

-- 6) S'assurer que les équipes sont bien inscrites sur le tournoi "En cours" (000002)
UPDATE tournaments
SET registered_teams = COALESCE((SELECT jsonb_agg(id) FROM (SELECT id FROM teams LIMIT 4) t), registered_teams)
WHERE id = 'c1000000-0000-4000-8000-000000000002'
  AND (registered_teams = '[]'::jsonb OR jsonb_array_length(registered_teams) = 0);

-- Résumé
SELECT id, name, status, start_date::date AS debut, end_date::date AS fin,
  jsonb_array_length(COALESCE(registered_teams, '[]'::jsonb)) AS equipes,
  jsonb_array_length(COALESCE(match_ids, '[]'::jsonb)) AS matchs
FROM tournaments
WHERE id IN (
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000003',
  'c1000000-0000-4000-8000-000000000004'
)
ORDER BY start_date;
