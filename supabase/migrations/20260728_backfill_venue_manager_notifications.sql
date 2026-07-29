-- =============================================================
-- Backfill: Send "Bienvenue Gestionnaire" notification to
-- existing venue_managers who never received it.
-- 100% non-destructive, idempotent: only inserts notifications
-- for users who don't already have one with the same title.
-- =============================================================

DO $$
DECLARE
  r RECORD;
  v_count INT := 0;
BEGIN
  FOR r IN
    SELECT id
    FROM users
    WHERE role = 'venue_manager'
  LOOP
    -- Skip if user already has a venue manager welcome notification
    IF NOT EXISTS (
      SELECT 1
      FROM notifications
      WHERE user_id = r.id
        AND title IN (
          'Bienvenue Gestionnaire !',
          'Vous êtes maintenant Gestionnaire'
        )
    ) THEN
      INSERT INTO notifications (user_id, type, title, message, data, is_read, created_at)
      VALUES (
        r.id,
        'system',
        'Bienvenue Gestionnaire !',
        'Votre compte gestionnaire a été créé. Vous pouvez maintenant ajouter vos terrains et gérer vos réservations depuis votre espace dédié.',
        jsonb_build_object('route', '/(manager-tabs)'),
        false,
        now()
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill: % venue manager welcome notifications inserted', v_count;
END $$;
