-- ╔═══════════════════════════════════════════════════════════════╗
-- ║        COUPE VS SPORT - ABIDJAN 2026  (Seed démo)          ║
-- ║        Bracket knockout complet · 8 équipes                ║
-- ╚═══════════════════════════════════════════════════════════════╝
--
-- Exécuter dans Supabase : Dashboard > SQL Editor > New query > Coller > Run.
--
-- Prérequis :
--   1. supabase-seed-test-teams.sql exécuté (8 équipes)
--   2. Au moins 1 utilisateur (admin de préférence)
--   3. Migration tournament_id / round_label appliquée
--
-- ┌─────────────────────── BRACKET ───────────────────────┐
-- │                                                       │
-- │  QUARTS DE FINALE        DEMI-FINALES      FINALE     │
-- │                                                       │
-- │  (1) Les Aigles FC  3 ┐                               │
-- │                       ├─ Les Aigles FC 2 ┐            │
-- │  (8) Alliance Sport 0 ┘                  │            │
-- │                                          ├─ Aigles ?  │
-- │  (4) Dynamo Sport   0 ┐                  │            │
-- │                       ├─ Phoenix FC    1 ┘            │
-- │  (5) Phoenix FC     3 ┘                               │
-- │                                          FINALE       │
-- │  (2) Strikers Utd   2 ┐                  à créer !    │
-- │                       ├─ Strikers  🔴 1-1             │
-- │  (7) Victory Eleven 1 ┘     vs                        │
-- │                          Thunder   🔴 1-1             │
-- │  (3) Racing Club    1 ┐                               │
-- │                       ├─ Thunder FC                   │
-- │  (6) Thunder FC     2 ┘                               │
-- │                                                       │
-- │  ✓ = terminé   🔴 = EN COURS (live!)   ? = à créer   │
-- └───────────────────────────────────────────────────────┘
--
-- Ce script crée :
--   · 1 tournoi knockout 8 équipes en cours
--   · 4 quarts de finale terminés (scores variés, dont 1 upset)
--   · 1 demi-finale terminée (Aigles 2-1 Phoenix)
--   · 1 demi-finale EN COURS à 1-1 (Strikers vs Thunder) ← à terminer !
--   · La FINALE n'existe pas encore → à créer par le testeur
--
-- Scénario de test recommandé :
--   1. Ouvrir l'app > Tournois > « Coupe VS Sport »
--   2. Consulter le bracket : 4 QF terminés, 1 SF terminée
--   3. Ouvrir la SF2 en cours (1-1) → saisir le score final
--   4. Créer le match de FINALE entre le vainqueur SF2 et Les Aigles FC
--   5. Saisir le score de la finale
--   6. Déclarer le vainqueur du tournoi
-- ╔═══════════════════════════════════════════════════════════════╝


-- ─────────────────────────────────────────────
-- 0. SCHEMA : colonnes manquantes + contraintes
-- ─────────────────────────────────────────────

-- Tournaments
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

-- Matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Match';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_type TEXT DEFAULT 'friendly';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS sport TEXT DEFAULT 'football';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'friendly';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS format TEXT DEFAULT '11v11';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS date_time TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE matches ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE matches ADD COLUMN IF NOT EXISTS venue_data JSONB;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS venue_id UUID;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 90;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'intermediate';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS ambiance TEXT DEFAULT 'competitive';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 22;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS registered_players JSONB DEFAULT '[]'::jsonb;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_home INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_away INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS round_label TEXT;

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;
UPDATE matches SET status = 'open'
  WHERE status IS NULL
     OR status NOT IN ('open', 'confirmed', 'in_progress', 'completed', 'cancelled');
ALTER TABLE matches ADD CONSTRAINT matches_status_check
  CHECK (status IN ('open', 'confirmed', 'in_progress', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id);


-- ─────────────────────────────────────────────
-- 1. NETTOYAGE : supprimer l'ancien tournoi démo si présent
-- ─────────────────────────────────────────────

DELETE FROM matches  WHERE tournament_id = 'b0000000-0000-4000-8000-000000000001';
DELETE FROM tournaments WHERE id = 'b0000000-0000-4000-8000-000000000001';


-- ─────────────────────────────────────────────
-- 2. TOURNOI : Coupe VS Sport - Abidjan 2026
-- ─────────────────────────────────────────────

INSERT INTO tournaments (
  id, name, description, sport, format, type, status, level,
  max_teams, registered_teams, entry_fee, prize_pool, prizes,
  venue_data, start_date, end_date, match_ids,
  sponsor_name, sponsor_logo, created_by, created_at
) SELECT
  'b0000000-0000-4000-8000-000000000001'::uuid,
  'Coupe VS Sport - Abidjan 2026',
  'Grand tournoi knockout 8 équipes à Abidjan. Les quarts de finale sont terminés '
    || 'et une demi-finale est en cours ! Finalisez le bracket et désignez le champion.',
  'football',
  '11v11',
  'knockout',
  'in_progress',
  'intermediate',
  8,
  -- Les 8 équipes de test
  '["d1000000-0000-4000-8000-000000000001",
    "d1000000-0000-4000-8000-000000000002",
    "d1000000-0000-4000-8000-000000000003",
    "d1000000-0000-4000-8000-000000000004",
    "d1000000-0000-4000-8000-000000000005",
    "d1000000-0000-4000-8000-000000000006",
    "d1000000-0000-4000-8000-000000000007",
    "d1000000-0000-4000-8000-000000000008"]'::jsonb,
  15000,            -- Frais d'inscription (FCFA)
  500000,           -- Prize pool total (FCFA)
  '[
    {"position": 1, "amount": 300000, "label": "Champion"},
    {"position": 2, "amount": 120000, "label": "Finaliste"},
    {"position": 3, "amount":  50000, "label": "3e place"},
    {"position": 4, "amount":  30000, "label": "4e place"}
  ]'::jsonb,
  '{"name": "Stade Robert Champroux", "address": "Boulevard de Marseille", "city": "Abidjan"}'::jsonb,
  date_trunc('day', NOW()) - interval '3 days' + interval '14 hours',
  date_trunc('day', NOW()) + interval '4 days' + interval '18 hours',
  '[]'::jsonb,
  'VS Sport',
  NULL,
  COALESCE(
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
    (SELECT id FROM users LIMIT 1)
  ),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM tournaments WHERE id = 'b0000000-0000-4000-8000-000000000001'
);


-- ─────────────────────────────────────────────
-- 3. MATCHS DU BRACKET
-- ─────────────────────────────────────────────
--
-- Bracket knockout :
--
--   QF1  Les Aigles FC (1)  3 - 0  Alliance Sport (8)    ✓ terminé
--   QF2  Strikers United (2)  2 - 1  Victory Eleven (7)  ✓ terminé
--   QF3  Racing Club (3)  1 - 2  Thunder FC (6)          ✓ terminé (upset!)
--   QF4  Dynamo Sport (4)  0 - 3  Phoenix FC (5)         ✓ terminé
--
--   SF1  Les Aigles FC  2 - 1  Phoenix FC                ✓ terminé
--   SF2  Strikers United  1 - 1  Thunder FC              🔴 EN COURS
--
--   FINALE  Les Aigles FC  vs  ???                        ⬜ à créer

DO $$
DECLARE
  tid  UUID := 'b0000000-0000-4000-8000-000000000001';
  uid  UUID;
  vid  UUID;
  vd   JSONB;

  -- Équipes (UUIDs fixes du seed test-teams)
  aigles   UUID := 'd1000000-0000-4000-8000-000000000001';
  strikers UUID := 'd1000000-0000-4000-8000-000000000002';
  racing   UUID := 'd1000000-0000-4000-8000-000000000003';
  dynamo   UUID := 'd1000000-0000-4000-8000-000000000004';
  phoenix  UUID := 'd1000000-0000-4000-8000-000000000005';
  thunder  UUID := 'd1000000-0000-4000-8000-000000000006';
  victory  UUID := 'd1000000-0000-4000-8000-000000000007';
  alliance UUID := 'd1000000-0000-4000-8000-000000000008';

  -- IDs des matchs
  qf1_id UUID;
  qf2_id UUID;
  qf3_id UUID;
  qf4_id UUID;
  sf1_id UUID;
  sf2_id UUID;

  all_match_ids JSONB;
  nb_matchs INT;
BEGIN
  -- Vérifier qu'on n'a pas déjà des matchs liés
  SELECT jsonb_array_length(COALESCE(match_ids, '[]'::jsonb))
    INTO nb_matchs
    FROM tournaments WHERE id = tid;
  IF COALESCE(nb_matchs, 0) > 0 THEN
    RAISE NOTICE 'Tournoi déjà peuplé (% matchs). Aucun match ajouté.', nb_matchs;
    RETURN;
  END IF;

  -- Créateur = admin ou premier user
  SELECT COALESCE(
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
    (SELECT id FROM users LIMIT 1)
  ) INTO uid;
  IF uid IS NULL THEN
    RAISE NOTICE 'Aucun utilisateur trouvé. Abandon.';
    RETURN;
  END IF;

  -- Lieu
  SELECT id INTO vid FROM venues LIMIT 1;
  SELECT COALESCE(
    (SELECT jsonb_build_object('id', v.id, 'name', v.name, 'address', v.address, 'city', v.city)
       FROM venues v LIMIT 1),
    '{"name": "Stade Robert Champroux", "address": "Boulevard de Marseille", "city": "Abidjan"}'::jsonb
  ) INTO vd;

  -- ── QUART DE FINALE 1 : Aigles 3 - 0 Alliance ──
  INSERT INTO matches (
    title, match_type, sport, format, type, status,
    home_team_id, away_team_id, venue_id, venue_data,
    start_time, date_time, duration, level, ambiance, max_players,
    registered_players, score_home, score_away,
    tournament_id, round_label, created_by
  ) VALUES (
    'QF1 · Les Aigles FC vs Alliance Sport',
    'tournament', 'football', '11v11', 'tournament', 'completed',
    aigles, alliance, vid, vd,
    date_trunc('day', NOW()) - interval '3 days' + interval '14 hours',
    date_trunc('day', NOW()) - interval '3 days' + interval '14 hours',
    90, 'intermediate', 'competitive', 22,
    '[]'::jsonb, 3, 0,
    tid, 'Quart de finale', uid
  ) RETURNING id INTO qf1_id;

  -- ── QUART DE FINALE 2 : Strikers 2 - 1 Victory ──
  INSERT INTO matches (
    title, match_type, sport, format, type, status,
    home_team_id, away_team_id, venue_id, venue_data,
    start_time, date_time, duration, level, ambiance, max_players,
    registered_players, score_home, score_away,
    tournament_id, round_label, created_by
  ) VALUES (
    'QF2 · Strikers United vs Victory Eleven',
    'tournament', 'football', '11v11', 'tournament', 'completed',
    strikers, victory, vid, vd,
    date_trunc('day', NOW()) - interval '3 days' + interval '16 hours 30 minutes',
    date_trunc('day', NOW()) - interval '3 days' + interval '16 hours 30 minutes',
    90, 'intermediate', 'competitive', 22,
    '[]'::jsonb, 2, 1,
    tid, 'Quart de finale', uid
  ) RETURNING id INTO qf2_id;

  -- ── QUART DE FINALE 3 : Racing 1 - 2 Thunder (upset!) ──
  INSERT INTO matches (
    title, match_type, sport, format, type, status,
    home_team_id, away_team_id, venue_id, venue_data,
    start_time, date_time, duration, level, ambiance, max_players,
    registered_players, score_home, score_away,
    tournament_id, round_label, created_by
  ) VALUES (
    'QF3 · Racing Club vs Thunder FC',
    'tournament', 'football', '11v11', 'tournament', 'completed',
    racing, thunder, vid, vd,
    date_trunc('day', NOW()) - interval '2 days' + interval '14 hours',
    date_trunc('day', NOW()) - interval '2 days' + interval '14 hours',
    90, 'intermediate', 'competitive', 22,
    '[]'::jsonb, 1, 2,
    tid, 'Quart de finale', uid
  ) RETURNING id INTO qf3_id;

  -- ── QUART DE FINALE 4 : Dynamo 0 - 3 Phoenix ──
  INSERT INTO matches (
    title, match_type, sport, format, type, status,
    home_team_id, away_team_id, venue_id, venue_data,
    start_time, date_time, duration, level, ambiance, max_players,
    registered_players, score_home, score_away,
    tournament_id, round_label, created_by
  ) VALUES (
    'QF4 · Dynamo Sport vs Phoenix FC',
    'tournament', 'football', '11v11', 'tournament', 'completed',
    dynamo, phoenix, vid, vd,
    date_trunc('day', NOW()) - interval '2 days' + interval '16 hours 30 minutes',
    date_trunc('day', NOW()) - interval '2 days' + interval '16 hours 30 minutes',
    90, 'intermediate', 'competitive', 22,
    '[]'::jsonb, 0, 3,
    tid, 'Quart de finale', uid
  ) RETURNING id INTO qf4_id;

  -- ── DEMI-FINALE 1 : Aigles 2 - 1 Phoenix (hier 15h) ──
  INSERT INTO matches (
    title, match_type, sport, format, type, status,
    home_team_id, away_team_id, venue_id, venue_data,
    start_time, date_time, duration, level, ambiance, max_players,
    registered_players, score_home, score_away,
    tournament_id, round_label, created_by
  ) VALUES (
    'SF1 · Les Aigles FC vs Phoenix FC',
    'tournament', 'football', '11v11', 'tournament', 'completed',
    aigles, phoenix, vid, vd,
    date_trunc('day', NOW()) - interval '1 day' + interval '15 hours',
    date_trunc('day', NOW()) - interval '1 day' + interval '15 hours',
    90, 'intermediate', 'competitive', 22,
    '[]'::jsonb, 2, 1,
    tid, 'Demi-finale', uid
  ) RETURNING id INTO sf1_id;

  -- ── DEMI-FINALE 2 : Strikers 1 - 1 Thunder (EN COURS !) ──
  INSERT INTO matches (
    title, match_type, sport, format, type, status,
    home_team_id, away_team_id, venue_id, venue_data,
    start_time, date_time, duration, level, ambiance, max_players,
    registered_players, score_home, score_away,
    tournament_id, round_label, created_by
  ) VALUES (
    'SF2 · Strikers United vs Thunder FC',
    'tournament', 'football', '11v11', 'tournament', 'in_progress',
    strikers, thunder, vid, vd,
    NOW() - interval '50 minutes', NOW() - interval '50 minutes',
    90, 'intermediate', 'competitive', 22,
    '[]'::jsonb, 1, 1,
    tid, 'Demi-finale', uid
  ) RETURNING id INTO sf2_id;

  -- ── Lier tous les matchs au tournoi ──
  all_match_ids := jsonb_build_array(
    qf1_id::text, qf2_id::text, qf3_id::text, qf4_id::text,
    sf1_id::text, sf2_id::text
  );
  UPDATE tournaments SET match_ids = all_match_ids WHERE id = tid;

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE '✓ Tournoi démo peuplé avec succès !';
  RAISE NOTICE '  4 quarts de finale  (terminés)';
  RAISE NOTICE '  1 demi-finale       (terminée : Aigles 2-1 Phoenix)';
  RAISE NOTICE '  1 demi-finale       (EN COURS : Strikers 1-1 Thunder)';
  RAISE NOTICE '  → FINALE à créer par le testeur dans l''app !';
  RAISE NOTICE '────────────────────────────────────────────';
END $$;


-- ─────────────────────────────────────────────
-- 4. VÉRIFICATION : résumé du tournoi + bracket
-- ─────────────────────────────────────────────

-- 4a) Info tournoi
SELECT
  t.name                                        AS tournoi,
  t.status,
  t.sport || ' ' || t.format                    AS discipline,
  t.type                                        AS format_tournoi,
  to_char(t.start_date, 'DD/MM/YYYY HH24h')    AS debut,
  to_char(t.end_date,   'DD/MM/YYYY HH24h')    AS fin,
  jsonb_array_length(t.registered_teams)         AS equipes,
  jsonb_array_length(t.match_ids)                AS matchs,
  to_char(t.prize_pool, 'FM999G999') || ' FCFA' AS cagnotte,
  t.sponsor_name                                AS sponsor
FROM tournaments t
WHERE t.id = 'b0000000-0000-4000-8000-000000000001';

-- 4b) Bracket détaillé avec vainqueur de chaque match
SELECT
  m.round_label                                             AS phase,
  m.title,
  th.name                                                   AS domicile,
  COALESCE(m.score_home::text, '-')
    || ' - ' ||
  COALESCE(m.score_away::text, '-')                         AS score,
  ta.name                                                   AS exterieur,
  CASE m.status
    WHEN 'completed'   THEN '✓ Terminé'
    WHEN 'in_progress' THEN '🔴 EN COURS'
    WHEN 'confirmed'   THEN '⏳ A venir'
    ELSE m.status
  END                                                       AS etat,
  CASE
    WHEN m.status = 'completed' AND m.score_home > m.score_away THEN th.name
    WHEN m.status = 'completed' AND m.score_away > m.score_home THEN ta.name
    WHEN m.status = 'completed' AND m.score_home = m.score_away THEN 'Nul'
    WHEN m.status = 'in_progress' THEN '...'
    ELSE ''
  END                                                       AS vainqueur,
  to_char(m.start_time, 'DD/MM HH24:MI')                   AS coup_envoi
FROM matches m
  LEFT JOIN teams th ON th.id = m.home_team_id
  LEFT JOIN teams ta ON ta.id = m.away_team_id
WHERE m.tournament_id = 'b0000000-0000-4000-8000-000000000001'
ORDER BY
  CASE m.round_label
    WHEN 'Quart de finale' THEN 1
    WHEN 'Demi-finale'     THEN 2
    WHEN 'Finale'          THEN 3
    ELSE 4
  END,
  m.start_time;

-- 4c) Résumé rapide du bracket
SELECT
  'Quarts: '
    || (SELECT count(*) FROM matches WHERE tournament_id = 'b0000000-0000-4000-8000-000000000001' AND round_label = 'Quart de finale' AND status = 'completed')
    || '/4 terminés, Demis: '
    || (SELECT count(*) FROM matches WHERE tournament_id = 'b0000000-0000-4000-8000-000000000001' AND round_label = 'Demi-finale' AND status = 'completed')
    || '/2 terminées, '
    || (SELECT count(*) FROM matches WHERE tournament_id = 'b0000000-0000-4000-8000-000000000001' AND round_label = 'Demi-finale' AND status = 'in_progress')
    || ' en cours. Finale: à créer !'
  AS progression;


-- ─────────────────────────────────────────────
-- 5. NETTOYAGE (décommenter si besoin)
-- ─────────────────────────────────────────────
-- Pour supprimer le tournoi démo et tous ses matchs :
--
-- DELETE FROM matches     WHERE tournament_id = 'b0000000-0000-4000-8000-000000000001';
-- DELETE FROM tournaments WHERE id = 'b0000000-0000-4000-8000-000000000001';
