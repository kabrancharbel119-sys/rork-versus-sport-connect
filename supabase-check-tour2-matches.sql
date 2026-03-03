-- ╔═══════════════════════════════════════════════════════════════╗
-- ║     VÉRIFIER LES MATCHS DU TOUR 2 (TOUR DE 32)              ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- Compter tous les matchs du Tour de 32
SELECT 
  COUNT(*) as total_matchs_tour_32,
  COUNT(DISTINCT round_label) as nombre_labels_differents
FROM matches
WHERE 
  tournament_id = 'c0000000-0000-4000-8000-000000000064'
  AND round_label LIKE 'Tour de 32%';

-- Lister tous les labels du Tour de 32
SELECT 
  round_label,
  COUNT(*) as nombre_matchs
FROM matches
WHERE 
  tournament_id = 'c0000000-0000-4000-8000-000000000064'
  AND round_label LIKE 'Tour de 32%'
GROUP BY round_label
ORDER BY round_label;

-- Afficher tous les matchs du Tour de 32
SELECT 
  id,
  round_label,
  home_team_id,
  away_team_id,
  date_time,
  status
FROM matches
WHERE 
  tournament_id = 'c0000000-0000-4000-8000-000000000064'
  AND round_label LIKE 'Tour de 32%'
ORDER BY round_label;

-- Vérifier s'il y a des matchs du Tour de 32 qui n'ont pas été créés
-- (devrait y avoir 16 matchs pour un Tour de 32)
SELECT 
  CASE 
    WHEN COUNT(*) = 16 THEN 'OK - 16 matchs présents'
    WHEN COUNT(*) < 16 THEN CONCAT('MANQUANT - Seulement ', COUNT(*), ' matchs sur 16')
    ELSE CONCAT('TROP - ', COUNT(*), ' matchs au lieu de 16')
  END as statut
FROM matches
WHERE 
  tournament_id = 'c0000000-0000-4000-8000-000000000064'
  AND round_label LIKE 'Tour de 32%';
