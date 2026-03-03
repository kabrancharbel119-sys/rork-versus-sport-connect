-- ╔═══════════════════════════════════════════════════════════════╗
-- ║     GÉNÉRER DES SCORES ALÉATOIRES POUR LE TOUR 3            ║
-- ║     (HUITIÈME DE FINALE - 8 MATCHS)                          ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- Ce script génère des scores aléatoires pour tous les matchs du Tour 3 :
--   · Scores entre 0 et 5 buts
--   · AUCUN match nul (home ≠ away)
--   · Marque tous les matchs comme "completed"

-- ─────────────────────────────────────────────
-- GÉNÉRATION DES SCORES ALÉATOIRES
-- ─────────────────────────────────────────────

UPDATE matches
SET 
  status = 'completed',
  score_home = FLOOR(RANDOM() * 6)::int,  -- Score entre 0 et 5
  score_away = FLOOR(RANDOM() * 6)::int   -- Score entre 0 et 5
WHERE 
  tournament_id = 'c0000000-0000-4000-8000-000000000064'
  AND round_label LIKE 'Huitième%';

-- ─────────────────────────────────────────────
-- CORRECTION DES MATCHS NULS
-- ─────────────────────────────────────────────

-- Si des matchs nuls ont été générés, ajouter +1 au score domicile
UPDATE matches
SET 
  score_home = score_home + 1
WHERE 
  tournament_id = 'c0000000-0000-4000-8000-000000000064'
  AND round_label LIKE 'Huitième%'
  AND score_home = score_away;

-- ─────────────────────────────────────────────
-- VÉRIFICATION
-- ─────────────────────────────────────────────

-- Afficher tous les matchs avec leurs scores
SELECT 
  round_label,
  home_team_id,
  away_team_id,
  score_home,
  score_away,
  CASE 
    WHEN score_home > score_away THEN 'Domicile gagne'
    WHEN score_home < score_away THEN 'Extérieur gagne'
    ELSE 'MATCH NUL (ERREUR!)'
  END as resultat,
  status
FROM matches
WHERE 
  tournament_id = 'c0000000-0000-4000-8000-000000000064'
  AND round_label LIKE 'Huitième%'
ORDER BY round_label;

-- Vérifier qu'il n'y a AUCUN match nul
SELECT 
  COUNT(*) as total_matchs,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as matchs_termines,
  COUNT(CASE WHEN score_home = score_away THEN 1 END) as matchs_nuls
FROM matches
WHERE 
  tournament_id = 'c0000000-0000-4000-8000-000000000064'
  AND round_label LIKE 'Huitième%';

-- Résultat attendu : total_matchs = 8, matchs_termines = 8, matchs_nuls = 0
