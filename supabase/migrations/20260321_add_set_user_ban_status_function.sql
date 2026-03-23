-- Create RPC function to set user ban status (bypasses PostgREST schema cache)
-- This function uses JSONB parameter to avoid parameter ordering issues
CREATE OR REPLACE FUNCTION set_user_ban_status(params JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_is_banned BOOLEAN;
  v_banned_until TIMESTAMPTZ;
  v_ban_reason TEXT;
BEGIN
  -- Extract parameters from JSONB
  v_user_id := (params->>'user_id')::UUID;
  v_is_banned := (params->>'is_banned')::BOOLEAN;
  v_banned_until := (params->>'banned_until')::TIMESTAMPTZ;
  v_ban_reason := params->>'ban_reason';
  
  -- Update user ban status
  UPDATE public.users
  SET 
    is_banned = v_is_banned,
    banned_until = CASE WHEN v_is_banned THEN v_banned_until ELSE NULL END,
    ban_reason = CASE WHEN v_is_banned THEN v_ban_reason ELSE NULL END
  WHERE id = v_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', v_user_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'is_banned', v_is_banned,
    'banned_until', v_banned_until,
    'ban_reason', v_ban_reason
  );
END;
$$;

-- Grant execute permission to authenticated users (admin check should be done in app layer)
GRANT EXECUTE ON FUNCTION set_user_ban_status(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_ban_status(JSONB) TO anon;
