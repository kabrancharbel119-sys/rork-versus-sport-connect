-- =============================================================
-- Fix: allow any authenticated user to send a notification to
-- another user via a SECURITY DEFINER function.
-- This bypasses RLS safely without weakening INSERT policies.
-- 100% non-destructive: CREATE OR REPLACE, no DROP of existing data.
-- =============================================================

CREATE OR REPLACE FUNCTION send_notification_to_user(
  p_target_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  -- Only authenticated users can call this function
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  INSERT INTO notifications (user_id, type, title, message, data, is_read, created_at)
  VALUES (p_target_user_id, p_type, p_title, p_message, p_data, false, now())
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION send_notification_to_user(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
