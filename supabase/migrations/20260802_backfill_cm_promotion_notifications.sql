-- =============================================================
-- Backfill: Send "📱 Promotion Community Manager" notification
-- to existing CMs who were promoted before the notification
-- system was fixed. Also covers co-captain promotions.
-- 100% non-destructive, idempotent: only inserts notifications
-- for CMs who don't already have one.
-- =============================================================

DO $$
DECLARE
  v_count INTEGER := 0;
  v_team RECORD;
  v_member JSONB;
  v_cm_user_id UUID;
  v_team_name TEXT;
  v_existing INTEGER;
BEGIN
  -- Iterate over all teams
  FOR v_team IN SELECT id, name, members FROM teams LOOP
    v_team_name := v_team.name;

    -- Iterate over members array (JSONB)
    IF v_team.members IS NOT NULL THEN
      FOR v_member IN SELECT * FROM jsonb_array_elements(v_team.members) LOOP
        v_cm_user_id := (v_member->>'userId')::UUID;

        -- Only process CMs
        IF v_member->>'role' = 'cm' AND v_cm_user_id IS NOT NULL THEN
          -- Check if notification already exists
          SELECT COUNT(*) INTO v_existing
          FROM notifications
          WHERE user_id = v_cm_user_id
            AND type = 'team'
            AND title = '📱 Promotion Community Manager'
            AND data->>'route' = '/team-feed/' || v_team.id::text;

          IF v_existing = 0 THEN
            INSERT INTO notifications (user_id, type, title, message, data, is_read, created_at)
            VALUES (
              v_cm_user_id,
              'team',
              '📱 Promotion Community Manager',
              'Vous êtes Community Manager de ' || v_team_name || '. Vous pouvez publier au nom de l''équipe.',
              jsonb_build_object('route', '/team-feed/' || v_team.id::text),
              false,
              now()
            );
            v_count := v_count + 1;
          END IF;
        END IF;

        -- Also backfill co-captain promotions
        IF v_member->>'role' = 'co-captain' AND v_cm_user_id IS NOT NULL THEN
          SELECT COUNT(*) INTO v_existing
          FROM notifications
          WHERE user_id = v_cm_user_id
            AND type = 'team'
            AND title = '⭐ Promotion'
            AND message LIKE '%co-capitaine%' || v_team_name || '%';

          IF v_existing = 0 THEN
            INSERT INTO notifications (user_id, type, title, message, data, is_read, created_at)
            VALUES (
              v_cm_user_id,
              'team',
              '⭐ Promotion',
              'Vous avez été promu co-capitaine de ' || v_team_name || '.',
              jsonb_build_object('route', '/team/' || v_team.id::text),
              false,
              now()
            );
            v_count := v_count + 1;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill: % CM/co-captain promotion notifications inserted', v_count;
END $$;
