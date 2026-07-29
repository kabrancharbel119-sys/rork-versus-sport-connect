-- Auto-follow charbel_admin2 when a new user is created
-- Safe script: no destructive operations, only INSERT and CREATE

-- Step 1: Create or replace the trigger function (CREATE OR REPLACE is safe)
CREATE OR REPLACE FUNCTION public.auto_follow_charbel_admin()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  admin_id uuid := '5262a708-285c-4478-881e-75d7451571ef';
  new_username text;
BEGIN
  -- Don't auto-follow if the new user IS charbel_admin2
  IF NEW.id = admin_id THEN
    RETURN NEW;
  END IF;

  -- Insert the follow relationship (ON CONFLICT = no error if already exists)
  INSERT INTO public.follows (follower_id, following_id)
  VALUES (NEW.id, admin_id)
  ON CONFLICT DO NOTHING;

  -- Only increment counters and notify if the row was actually inserted
  IF FOUND THEN
    PERFORM public.increment_followers(admin_id);
    PERFORM public.increment_following(NEW.id);

    -- Get the new user's name for the notification
    new_username := COALESCE(NEW.full_name, NEW.username, 'Un nouvel utilisateur');

    -- Send a notification to charbel_admin2
    INSERT INTO public.notifications (user_id, type, title, message, data, is_read, created_at)
    VALUES (
      admin_id,
      'follow',
      'Nouvel abonné',
      new_username || ' s''est abonné à votre compte',
      jsonb_build_object('follower_id', NEW.id, 'follower_name', new_username),
      false,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Step 2: Create the trigger only if it doesn't exist (safe, no DROP)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_follow_charbel_admin'
  ) THEN
    CREATE TRIGGER trg_auto_follow_charbel_admin
      AFTER INSERT ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.auto_follow_charbel_admin();
  END IF;
END;
$$;

-- Step 3: Backfill — existing users who don't yet follow charbel_admin2
--         Only inserts missing follows, never deletes or modifies existing rows
DO $$
DECLARE
  admin_id uuid := '5262a708-285c-4478-881e-75d7451571ef';
  u RECORD;
  inserted_count int := 0;
BEGIN
  FOR u IN
    SELECT usr.id, usr.full_name, usr.username
    FROM public.users usr
    WHERE usr.id != admin_id
    AND NOT EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = usr.id AND f.following_id = admin_id
    )
  LOOP
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (u.id, admin_id)
    ON CONFLICT DO NOTHING;

    IF FOUND THEN
      PERFORM public.increment_followers(admin_id);
      PERFORM public.increment_following(u.id);

      -- Send a notification to charbel_admin2 for backfilled follows
      INSERT INTO public.notifications (user_id, type, title, message, data, is_read, created_at)
      VALUES (
        admin_id,
        'follow',
        'Nouvel abonné',
        COALESCE(u.full_name, u.username, 'Un utilisateur') || ' s''est abonné à votre compte',
        jsonb_build_object('follower_id', u.id, 'follower_name', COALESCE(u.full_name, u.username)),
        false,
        now()
      );

      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % new follows added for charbel_admin2', inserted_count;
END;
$$;

-- Step 4: Backfill notifications for ALL existing follows to charbel_admin2
--         that don't already have a 'follow' notification (from before this script)
DO $$
DECLARE
  admin_id uuid := '5262a708-285c-4478-881e-75d7451571ef';
  f RECORD;
  notif_count int := 0;
BEGIN
  FOR f IN
    SELECT usr.id AS follower_id,
           COALESCE(usr.full_name, usr.username, 'Un utilisateur') AS follower_name
    FROM public.follows fl
    JOIN public.users usr ON usr.id = fl.follower_id
    WHERE fl.following_id = admin_id
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = admin_id
        AND n.type = 'follow'
        AND n.data->>'follower_id' = fl.follower_id
    )
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, data, is_read, created_at)
    VALUES (
      admin_id,
      'follow',
      'Nouvel abonné',
      f.follower_name || ' s''est abonné à votre compte',
      jsonb_build_object('follower_id', f.follower_id, 'follower_name', f.follower_name),
      false,
      now()
    );

    notif_count := notif_count + 1;
  END LOOP;

  RAISE NOTICE 'Notification backfill complete: % notifications added for charbel_admin2', notif_count;
END;
$$;
