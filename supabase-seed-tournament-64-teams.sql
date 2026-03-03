-- ╔═══════════════════════════════════════════════════════════════╗
-- ║     TOURNOI TEST 64 ÉQUIPES - BRACKET COMPLET                ║
-- ║     Pour tester la gestion de tournoi du début à la fin      ║
-- ╚═══════════════════════════════════════════════════════════════╝
--
-- Ce script crée :
--   · 1 tournoi knockout 64 équipes
--   · 64 équipes de test
--   · Premier tour (32 matchs) à l'état "confirmed" (prêts à jouer)
--   · Organisateur : kabrancharbel2@gmail.com
--
-- Exécuter dans Supabase : Dashboard > SQL Editor > New query > Coller > Run.

-- ─────────────────────────────────────────────
-- 1. NETTOYAGE : supprimer ancien tournoi test si présent
-- ─────────────────────────────────────────────

DELETE FROM matches WHERE tournament_id = 'c0000000-0000-4000-8000-000000000064';
DELETE FROM team_members WHERE team_id IN (
  SELECT id FROM teams WHERE id >= 'e1000000-0000-4000-8000-000000000001'
                        AND id <= 'e1000000-0000-4000-8000-000000000064'
);
DELETE FROM teams WHERE id >= 'e1000000-0000-4000-8000-000000000001'
                   AND id <= 'e1000000-0000-4000-8000-000000000064';
DELETE FROM tournaments WHERE id = 'c0000000-0000-4000-8000-000000000064';


-- ─────────────────────────────────────────────
-- 2. CRÉER 64 ÉQUIPES DE TEST
-- ─────────────────────────────────────────────

DO $$
DECLARE
  team_names TEXT[] := ARRAY[
    'Les Aigles FC', 'Strikers United', 'Racing Club', 'Dynamo Sport',
    'Phoenix FC', 'Thunder FC', 'Victory Eleven', 'Alliance Sport',
    'Lions de Yopougon', 'Étoiles d''Abidjan', 'Guerriers FC', 'Titans Sport',
    'Olympique Cocody', 'AS Treichville', 'Sporting Marcory', 'FC Koumassi',
    'Académie JMJ', 'Espoir FC', 'Renaissance Sport', 'Progrès United',
    'Jeunesse Sportive', 'Avenir FC', 'Élan Sportif', 'Union Athlétique',
    'Stade d''Abidjan', 'Athletic Club', 'Royal FC', 'Imperial Sport',
    'Prestige United', 'Excellence FC', 'Elite Sport', 'Champions League',
    'Galaxy FC', 'Cosmos Sport', 'Stellar United', 'Nebula FC',
    'Meteor Sport', 'Comet FC', 'Orbit United', 'Pulsar Sport',
    'Velocity FC', 'Momentum Sport', 'Impact United', 'Force FC',
    'Power Sport', 'Energy FC', 'Voltage United', 'Spark Sport',
    'Blaze FC', 'Inferno Sport', 'Flame United', 'Fire FC',
    'Storm Sport', 'Cyclone FC', 'Tornado United', 'Hurricane Sport',
    'Wave FC', 'Tide Sport', 'Ocean United', 'Marine FC',
    'Mountain Sport', 'Summit FC', 'Peak United', 'Altitude Sport'
  ];
  i INT;
  team_id UUID;
  captain_id UUID;
BEGIN
  -- Récupérer l'utilisateur kabrancharbel2@gmail.com
  SELECT id INTO captain_id FROM users WHERE email = 'kabrancharbel2@gmail.com' LIMIT 1;
  
  IF captain_id IS NULL THEN
    SELECT id INTO captain_id FROM users WHERE role = 'admin' LIMIT 1;
  END IF;
  
  IF captain_id IS NULL THEN
    SELECT id INTO captain_id FROM users LIMIT 1;
  END IF;

  -- Créer 64 équipes
  FOR i IN 1..64 LOOP
    team_id := ('e1000000-0000-4000-8000-0000000000' || LPAD(i::text, 2, '0'))::uuid;
    
    INSERT INTO teams (
      id, name, sport, format, level, ambiance,
      city, country, description, captain_id, created_at
    ) VALUES (
      team_id,
      team_names[i],
      'football',
      '11v11',
      CASE 
        WHEN i % 3 = 0 THEN 'advanced'
        WHEN i % 3 = 1 THEN 'intermediate'
        ELSE 'beginner'
      END,
      CASE 
        WHEN i % 2 = 0 THEN 'competitive'
        ELSE 'casual'
      END,
      CASE 
        WHEN i % 4 = 0 THEN 'Abidjan'
        WHEN i % 4 = 1 THEN 'Yopougon'
        WHEN i % 4 = 2 THEN 'Cocody'
        ELSE 'Marcory'
      END,
      'Côte d''Ivoire',
      'Équipe test pour tournoi 64 équipes - ' || team_names[i],
      captain_id,
      NOW() - (random() * interval '180 days')
    );
    
    -- Ajouter le capitaine comme membre
    INSERT INTO team_members (team_id, user_id, role, joined_at)
    VALUES (team_id, captain_id, 'captain', NOW());
    
  END LOOP;

  RAISE NOTICE '✓ 64 équipes créées avec succès';
END $$;


-- ─────────────────────────────────────────────
-- 3. CRÉER LE TOURNOI 64 ÉQUIPES
-- ─────────────────────────────────────────────

DO $$
DECLARE
  organizer_id UUID;
  venue_id UUID;
  venue_data JSONB;
  registered_teams_array JSONB;
BEGIN
  -- Récupérer l'organisateur
  SELECT id INTO organizer_id FROM users WHERE email = 'kabrancharbel2@gmail.com' LIMIT 1;
  IF organizer_id IS NULL THEN
    SELECT id INTO organizer_id FROM users WHERE role = 'admin' LIMIT 1;
  END IF;
  IF organizer_id IS NULL THEN
    SELECT id INTO organizer_id FROM users LIMIT 1;
  END IF;

  -- Récupérer un lieu
  SELECT id INTO venue_id FROM venues LIMIT 1;
  SELECT COALESCE(
    (SELECT jsonb_build_object('id', v.id, 'name', v.name, 'address', v.address, 'city', v.city)
       FROM venues v LIMIT 1),
    '{"name": "Stade Félix Houphouët-Boigny", "address": "Boulevard de la République", "city": "Abidjan"}'::jsonb
  ) INTO venue_data;

  -- Construire le tableau des 64 équipes inscrites
  SELECT jsonb_agg(id::text ORDER BY id)
  INTO registered_teams_array
  FROM teams
  WHERE id >= 'e1000000-0000-4000-8000-000000000001'
    AND id <= 'e1000000-0000-4000-8000-000000000064';

  -- Créer le tournoi
  INSERT INTO tournaments (
    id, name, description, sport, format, type, status, level,
    max_teams, registered_teams, entry_fee, prize_pool, prizes,
    venue_data, start_date, end_date, match_ids,
    sponsor_name, sponsor_logo, created_by, created_at
  ) VALUES (
    'c0000000-0000-4000-8000-000000000064'::uuid,
    'Grand Tournoi 64 Équipes - Test Complet',
    'Tournoi knockout complet avec 64 équipes pour tester la gestion de tournoi du début à la fin. '
      || 'Premier tour (32 matchs) prêt à être joué. Gérez les scores, avancez dans le bracket, '
      || 'et désignez le champion final !',
    'football',
    '11v11',
    'knockout',
    'in_progress',  -- Phase de bracket (étape 1)
    'intermediate',
    64,
    registered_teams_array,
    25000,  -- Frais d'inscription (FCFA)
    2000000,  -- Prize pool total (FCFA)
    '[
      {"position": 1, "amount": 1000000, "label": "Champion"},
      {"position": 2, "amount": 500000, "label": "Finaliste"},
      {"position": 3, "amount": 300000, "label": "3e place"},
      {"position": 4, "amount": 200000, "label": "4e place"}
    ]'::jsonb,
    venue_data,
    date_trunc('day', NOW()) + interval '1 day' + interval '9 hours',
    date_trunc('day', NOW()) + interval '15 days' + interval '20 hours',
    '[]'::jsonb,
    'VS Sport Pro',
    NULL,
    organizer_id,
    NOW()
  );

  RAISE NOTICE '✓ Tournoi 64 équipes créé avec succès';
END $$;


-- ─────────────────────────────────────────────
-- 4. GÉNÉRER LE PREMIER TOUR (32 MATCHS)
-- ─────────────────────────────────────────────

DO $$
DECLARE
  tid UUID := 'c0000000-0000-4000-8000-000000000064';
  organizer_id UUID;
  venue_id UUID;
  venue_data JSONB;
  team_ids UUID[];
  match_id UUID;
  all_match_ids JSONB := '[]'::jsonb;
  i INT;
  home_team UUID;
  away_team UUID;
  match_time TIMESTAMPTZ;
BEGIN
  -- Récupérer l'organisateur
  SELECT id INTO organizer_id FROM users WHERE email = 'kabrancharbel2@gmail.com' LIMIT 1;
  IF organizer_id IS NULL THEN
    SELECT id INTO organizer_id FROM users WHERE role = 'admin' LIMIT 1;
  END IF;
  IF organizer_id IS NULL THEN
    SELECT id INTO organizer_id FROM users LIMIT 1;
  END IF;

  -- Récupérer le lieu
  SELECT id INTO venue_id FROM venues LIMIT 1;
  SELECT COALESCE(
    (SELECT jsonb_build_object('id', v.id, 'name', v.name, 'address', v.address, 'city', v.city)
       FROM venues v LIMIT 1),
    '{"name": "Stade Félix Houphouët-Boigny", "address": "Boulevard de la République", "city": "Abidjan"}'::jsonb
  ) INTO venue_data;

  -- Récupérer les 64 équipes dans l'ordre
  SELECT array_agg(id ORDER BY id)
  INTO team_ids
  FROM teams
  WHERE id >= 'e1000000-0000-4000-8000-000000000001'
    AND id <= 'e1000000-0000-4000-8000-000000000064';

  -- Créer 32 matchs du premier tour (Round of 64)
  -- Seed 1 vs 64, 2 vs 63, 3 vs 62, etc.
  FOR i IN 1..32 LOOP
    home_team := team_ids[i];
    away_team := team_ids[65 - i];
    
    -- Étaler les matchs sur 2 jours
    match_time := date_trunc('day', NOW()) + interval '1 day' 
                  + interval '9 hours' 
                  + ((i - 1) / 8) * interval '1 day'
                  + ((i - 1) % 8) * interval '2 hours';

    INSERT INTO matches (
      title, match_type, sport, format, type, status,
      home_team_id, away_team_id, venue_id, venue_data,
      start_time, date_time, duration, level, ambiance, max_players,
      registered_players, score_home, score_away,
      tournament_id, round_label, created_by
    ) VALUES (
      'R64-' || i || ' · Match ' || i || ' du premier tour',
      'tournament', 'football', '11v11', 'tournament', 'confirmed',
      home_team, away_team, venue_id, venue_data,
      match_time, match_time,
      90, 'intermediate', 'competitive', 22,
      '[]'::jsonb, NULL, NULL,
      tid, 'Tour de 64', organizer_id
    ) RETURNING id INTO match_id;

    all_match_ids := all_match_ids || jsonb_build_array(match_id::text);
  END LOOP;

  -- Lier tous les matchs au tournoi
  UPDATE tournaments SET match_ids = all_match_ids WHERE id = tid;

  RAISE NOTICE '✓ 32 matchs du premier tour créés (status: confirmed)';
  RAISE NOTICE '  → Prêts à être joués et scorés !';
END $$;


-- ─────────────────────────────────────────────
-- 5. VÉRIFICATION : résumé du tournoi
-- ─────────────────────────────────────────────

SELECT
  t.name AS tournoi,
  t.status,
  t.sport || ' ' || t.format AS discipline,
  t.type AS format_tournoi,
  to_char(t.start_date, 'DD/MM/YYYY HH24h') AS debut,
  to_char(t.end_date, 'DD/MM/YYYY HH24h') AS fin,
  jsonb_array_length(t.registered_teams) AS equipes_inscrites,
  jsonb_array_length(t.match_ids) AS matchs_crees,
  to_char(t.prize_pool, 'FM999G999') || ' FCFA' AS cagnotte,
  t.sponsor_name AS sponsor
FROM tournaments t
WHERE t.id = 'c0000000-0000-4000-8000-000000000064';

-- Résumé des matchs par round
SELECT
  m.round_label AS phase,
  COUNT(*) AS nombre_matchs,
  COUNT(*) FILTER (WHERE m.status = 'confirmed') AS confirmes,
  COUNT(*) FILTER (WHERE m.status = 'in_progress') AS en_cours,
  COUNT(*) FILTER (WHERE m.status = 'completed') AS termines
FROM matches m
WHERE m.tournament_id = 'c0000000-0000-4000-8000-000000000064'
GROUP BY m.round_label
ORDER BY 
  CASE m.round_label
    WHEN 'Tour de 64' THEN 1
    WHEN 'Tour de 32' THEN 2
    WHEN 'Huitième de finale' THEN 3
    WHEN 'Quart de finale' THEN 4
    WHEN 'Demi-finale' THEN 5
    WHEN 'Finale' THEN 6
    ELSE 7
  END;

-- Liste des premiers matchs
SELECT
  m.title,
  th.name AS domicile,
  ta.name AS exterieur,
  m.status AS etat,
  to_char(m.start_time, 'DD/MM HH24:MI') AS coup_envoi
FROM matches m
  LEFT JOIN teams th ON th.id = m.home_team_id
  LEFT JOIN teams ta ON ta.id = m.away_team_id
WHERE m.tournament_id = 'c0000000-0000-4000-8000-000000000064'
  AND m.round_label = 'Tour de 64'
ORDER BY m.start_time
LIMIT 10;


-- ─────────────────────────────────────────────
-- 6. INSTRUCTIONS DE TEST
-- ─────────────────────────────────────────────

SELECT '
╔═══════════════════════════════════════════════════════════════╗
║           TOURNOI 64 ÉQUIPES - GUIDE DE TEST                 ║
╚═══════════════════════════════════════════════════════════════╝

✓ Tournoi créé avec succès !

📋 DÉTAILS :
   • 64 équipes inscrites
   • 32 matchs du premier tour (Tour de 64) créés
   • Status : in_progress (phase de bracket)
   • Tous les matchs sont "confirmed" (prêts à jouer)

🎯 SCÉNARIO DE TEST COMPLET :

1️⃣  PHASE 1 - PREMIER TOUR (32 matchs)
   → Ouvrir l''app > Tournois > "Grand Tournoi 64 Équipes"
   → Aller dans "Gérer le tournoi"
   → Voir les 32 matchs du Tour de 64
   → Saisir les scores pour chaque match
   → Valider les résultats

2️⃣  PHASE 2 - DEUXIÈME TOUR (16 matchs)
   → Le système devrait créer automatiquement les 16 matchs
   → Ou utiliser le bouton "Générer le tour suivant"
   → Saisir les scores des 16 matchs

3️⃣  PHASE 3 - HUITIÈMES DE FINALE (8 matchs)
   → Continuer à scorer les matchs
   → Avancer dans le bracket

4️⃣  PHASE 4 - QUARTS DE FINALE (4 matchs)
   → 4 matchs à scorer

5️⃣  PHASE 5 - DEMI-FINALES (2 matchs)
   → 2 matchs à scorer

6️⃣  PHASE 6 - FINALE (1 match)
   → Match final
   → Désigner le champion

7️⃣  PHASE 7 - CLÔTURE
   → Marquer le tournoi comme "completed"
   → Vérifier le classement final
   → Distribuer les prix

📊 STATISTIQUES À VÉRIFIER :
   • Bracket complet et cohérent
   • Scores enregistrés correctement
   • Équipes éliminées au bon moment
   • Vainqueur final désigné
   • Historique des matchs complet

🔧 COMMANDES UTILES :
   • Voir tous les matchs : SELECT * FROM matches WHERE tournament_id = ''c0000000-0000-4000-8000-000000000064'';
   • Réinitialiser : Exécuter ce script à nouveau
   • Supprimer : Voir section 1 du script

Bon test ! 🚀
' AS guide;


-- ─────────────────────────────────────────────
-- 7. NETTOYAGE (décommenter si besoin de réinitialiser)
-- ─────────────────────────────────────────────
-- Pour supprimer le tournoi et recommencer :
--
-- DELETE FROM matches WHERE tournament_id = 'c0000000-0000-4000-8000-000000000064';
-- DELETE FROM team_members WHERE team_id IN (
--   SELECT id FROM teams WHERE id >= 'e1000000-0000-4000-8000-000000000001'
--                         AND id <= 'e1000000-0000-4000-8000-000000000064'
-- );
-- DELETE FROM teams WHERE id >= 'e1000000-0000-4000-8000-000000000001'
--                    AND id <= 'e1000000-0000-4000-8000-000000000064';
-- DELETE FROM tournaments WHERE id = 'c0000000-0000-4000-8000-000000000064';
