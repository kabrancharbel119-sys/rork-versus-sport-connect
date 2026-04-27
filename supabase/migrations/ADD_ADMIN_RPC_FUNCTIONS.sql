-- ============================================================
-- RPC : admin_set_user_verified
-- Permet à un admin de modifier is_verified sans passer par la RLS
-- ============================================================
CREATE OR REPLACE FUNCTION admin_set_user_verified(
  p_user_id UUID,
  p_verified BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth.uid() est infalsifiable : fourni par Supabase côté serveur
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Accès refusé : administrateur requis';
  END IF;

  UPDATE users
  SET is_verified = p_verified
  WHERE id = p_user_id;
END;
$$;

-- ============================================================
-- RPC : admin_send_notification
-- Permet à un admin d'insérer une notification pour n'importe quel user
-- ============================================================
CREATE OR REPLACE FUNCTION admin_send_notification(
  p_target_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth.uid() est infalsifiable : fourni par Supabase côté serveur
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Accès refusé : administrateur requis';
  END IF;

  INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
  VALUES (p_target_user_id, p_type, p_title, p_message, false, now());
END;
$$;
