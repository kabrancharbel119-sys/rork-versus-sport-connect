-- =============================================================
-- Backfill: Send "Nouveau rôle de gestionnaire" notification to
-- existing tournament managers who were added before the
-- notification feature was implemented.
-- 100% non-destructive, idempotent: only inserts notifications
-- for managers who don't already have one for that tournament.
-- =============================================================

DO $$
DECLARE
  r RECORD;
  v_creator_name TEXT;
  v_count INT := 0;
BEGIN
  FOR r IN
    SELECT
      t.id AS tournament_id,
      t.name AS tournament_name,
      t.created_by,
      m.manager_id::text AS manager_id
    FROM tournaments t
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN t.managers IS NOT NULL AND t.managers <> 'null'::jsonb AND jsonb_typeof(t.managers) = 'array'
        THEN t.managers
        ELSE '[]'::jsonb
      END
    ) AS m(manager_id)
    WHERE m.manager_id IS NOT NULL
      AND m.manager_id <> ''
      AND m.manager_id::text <> t.created_by::text
  LOOP
    -- Skip if this manager already has a tournament manager notification
    -- for this specific tournament
    IF NOT EXISTS (
      SELECT 1
      FROM notifications
      WHERE user_id = r.manager_id::uuid
        AND type = 'tournament'
        AND title = 'Nouveau rôle de gestionnaire'
        AND data->>'route' = '/tournament/' || r.tournament_id || '/manage'
    ) THEN
      -- Try to get the creator's name for a better message
      SELECT COALESCE(full_name, username, 'Un organisateur')
        INTO v_creator_name
      FROM users
      WHERE id = r.created_by;

      INSERT INTO notifications (user_id, type, title, message, data, is_read, created_at)
      VALUES (
        r.manager_id::uuid,
        'tournament',
        'Nouveau rôle de gestionnaire',
        v_creator_name || ' vous a donné la permission de gérer le tournoi "' || r.tournament_name || '".',
        jsonb_build_object('route', '/tournament/' || r.tournament_id || '/manage'),
        false,
        now()
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill: % tournament manager notifications inserted', v_count;
END $$;
