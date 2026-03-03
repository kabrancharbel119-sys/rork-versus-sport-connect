-- ╔═══════════════════════════════════════════════════════════════╗
-- ║     MARQUER LE TOURNOI COMME TERMINÉ MANUELLEMENT            ║
-- ║     Après la finale avec Phoenix FC comme champion           ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- Ce script met à jour le tournoi pour :
--   · Changer le statut en 'completed'
--   · Enregistrer le winner_id (Phoenix FC)
--   · Finaliser le tournoi

-- ─────────────────────────────────────────────
-- ÉTAPE 1 : IDENTIFIER LE VAINQUEUR DE LA FINALE
-- ─────────────────────────────────────────────

-- Afficher le match de finale avec le score
SELECT 
  id as match_id,
  round_label,
  home_team_id,
  away_team_id,
  score_home,
  score_away,
  CASE 
    WHEN score_home > score_away THEN home_team_id
    WHEN score_away > score_home THEN away_team_id
    ELSE NULL
  END as winner_team_id,
  CASE 
    WHEN score_home > score_away THEN 'Équipe domicile gagne'
    WHEN score_away > score_home THEN 'Équipe extérieur gagne'
    ELSE 'Match nul'
  END as resultat
FROM matches
WHERE 
  tournament_id = 'c0000000-0000-4000-8000-000000000064'
  AND round_label = 'Finale';

-- ─────────────────────────────────────────────
-- ÉTAPE 2 : METTRE À JOUR LE TOURNOI
-- ─────────────────────────────────────────────

-- Mettre à jour le tournoi avec le vainqueur et le statut 'completed'
UPDATE tournaments
SET 
  status = 'completed',
  winner_id = (
    SELECT 
      CASE 
        WHEN score_home > score_away THEN home_team_id
        WHEN score_away > score_home THEN away_team_id
        ELSE NULL
      END
    FROM matches
    WHERE 
      tournament_id = 'c0000000-0000-4000-8000-000000000064'
      AND round_label = 'Finale'
    LIMIT 1
  )
WHERE 
  id = 'c0000000-0000-4000-8000-000000000064';

-- ─────────────────────────────────────────────
-- VÉRIFICATION
-- ─────────────────────────────────────────────

-- Vérifier que le tournoi est bien terminé
SELECT 
  id,
  name,
  status,
  winner_id,
  CASE 
    WHEN status = 'completed' THEN '✅ Tournoi terminé'
    ELSE '⚠️ Tournoi encore en cours'
  END as statut_verification
FROM tournaments
WHERE 
  id = 'c0000000-0000-4000-8000-000000000064';

-- Afficher le nom de l'équipe gagnante
SELECT 
  t.name as tournoi,
  t.status,
  teams.name as equipe_gagnante
FROM tournaments t
LEFT JOIN teams ON teams.id = t.winner_id
WHERE 
  t.id = 'c0000000-0000-4000-8000-000000000064';
