-- ╔═══════════════════════════════════════════════════════════════╗
-- ║     METTRE À JOUR LES DATES DU TOUR 2 (TOUR DE 32)          ║
-- ║     Remplacer toutes les dates par le 2 mars 2026            ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- Ce script met à jour tous les matchs du Tour de 32 pour :
--   · Changer la date au 2 mars 2026
--   · Répartir les matchs sur la journée avec des intervalles de 2h
--   · Commencer à 10h00 du matin

-- ─────────────────────────────────────────────
-- MISE À JOUR DES DATES DU TOUR DE 32
-- ─────────────────────────────────────────────

-- Créer une table temporaire avec les nouveaux horaires
WITH match_schedule AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY date_time) - 1 as match_index
  FROM matches
  WHERE 
    tournament_id = 'c0000000-0000-4000-8000-000000000064'
    AND round_label LIKE 'Tour de 32%'
)
UPDATE matches
SET 
  date_time = '2026-03-02 10:00:00'::timestamp + (match_schedule.match_index * interval '2 hours'),
  start_time = '2026-03-02 10:00:00'::timestamp + (match_schedule.match_index * interval '2 hours')
FROM match_schedule
WHERE 
  matches.id = match_schedule.id;

-- ─────────────────────────────────────────────
-- VÉRIFICATION
-- ─────────────────────────────────────────────

-- Afficher tous les matchs du Tour de 32 avec leurs nouvelles dates
SELECT 
  round_label,
  home_team_id,
  away_team_id,
  date_time,
  start_time,
  status
FROM matches
WHERE 
  tournament_id = 'c0000000-0000-4000-8000-000000000064'
  AND round_label LIKE 'Tour de 32%'
ORDER BY date_time;

-- Résumé par heure
SELECT 
  DATE_TRUNC('hour', date_time) as heure,
  COUNT(*) as nombre_matchs
FROM matches
WHERE 
  tournament_id = 'c0000000-0000-4000-8000-000000000064'
  AND round_label LIKE 'Tour de 32%'
GROUP BY DATE_TRUNC('hour', date_time)
ORDER BY heure;
