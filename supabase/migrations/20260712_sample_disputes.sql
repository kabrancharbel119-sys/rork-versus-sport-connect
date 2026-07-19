-- =============================================================
-- Seed : quelques litiges d'exemple pour tester l'écran admin
-- (app/admin/disputes.tsx) et l'écran de signalement capitaine
-- (app/tournament/[id]/report-dispute.tsx)
-- =============================================================

DO $$
DECLARE
  r RECORD;
  v_count INT := 0;
  v_fallback_user UUID;
BEGIN
  -- Utilisateur de repli si aucun capitaine trouvé (ex: premier admin/utilisateur)
  SELECT id INTO v_fallback_user FROM users ORDER BY created_at ASC LIMIT 1;

  -- On cible jusqu'à 3 tournois distincts ayant au moins une équipe inscrite,
  -- avec le capitaine de cette équipe comme "reporter" (cohérent avec la policy
  -- disputes_insert qui exige que reported_by soit capitaine d'une équipe inscrite).
  FOR r IN (
    SELECT DISTINCT ON (tt.tournament_id)
      tt.tournament_id,
      t.name AS tournament_name,
      tm.captain_id
    FROM tournament_teams tt
    JOIN tournaments t ON t.id = tt.tournament_id
    JOIN teams tm ON tm.id = tt.team_id
    WHERE tm.captain_id IS NOT NULL
    ORDER BY tt.tournament_id, tt.registered_at DESC
    LIMIT 3
  )
  LOOP
    v_count := v_count + 1;

    IF v_count = 1 THEN
      -- Litige MAJEUR ouvert : bloque la libération des fonds du tournoi
      INSERT INTO tournament_disputes (tournament_id, reported_by, severity, reason, status)
      VALUES (
        r.tournament_id,
        r.captain_id,
        'major',
        'L''équipe adverse ne s''est pas présentée au match de poule prévu et l''organisateur n''a proposé aucune reprogrammation malgré plusieurs relances. Nous demandons un remboursement ou une reprogrammation officielle.',
        'open'
      );
    ELSIF v_count = 2 THEN
      -- Litige MINEUR en cours d'examen
      INSERT INTO tournament_disputes (tournament_id, reported_by, severity, reason, status)
      VALUES (
        r.tournament_id,
        r.captain_id,
        'minor',
        'Le terrain annoncé dans les informations du tournoi ne correspond pas à celui utilisé réellement le jour du match, ce qui a causé une confusion pour notre équipe.',
        'investigating'
      );
    ELSIF v_count = 3 THEN
      -- Litige MAJEUR ouvert récent
      INSERT INTO tournament_disputes (tournament_id, reported_by, severity, reason, status)
      VALUES (
        r.tournament_id,
        r.captain_id,
        'major',
        'Des frais d''inscription supplémentaires non annoncés ont été demandés le jour du tournoi. Cela ne correspond pas aux conditions affichées lors de l''inscription en ligne.',
        'open'
      );
    END IF;
  END LOOP;

  -- Filet de sécurité: si aucun tournoi avec équipe inscrite n'existe encore,
  -- on ne force rien (pas de données fictives sans contexte réel).
  IF v_count = 0 THEN
    RAISE NOTICE 'Aucun tournoi avec équipe inscrite trouvé: aucun litige d''exemple créé.';
  END IF;
END $$;
