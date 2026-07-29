-- ============================================================
-- AMÉLIORATION DU SYSTÈME DE VALIDATION DES BILLETS
-- - validate_ticket retourne plus d'infos (event_name, event_date, holder_name, event_type)
-- - Nouvelle fonction: get_organizer_scan_history pour l'historique des scans
-- ============================================================

-- 1. Améliorer validate_ticket pour retourner plus d'informations
CREATE OR REPLACE FUNCTION public.validate_ticket(
  p_qr_token UUID,
  p_validator_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_type public.ticket_types%ROWTYPE;
  v_is_authorized BOOLEAN;
  v_buyer_name TEXT;
  v_event_name TEXT;
  v_event_date TIMESTAMPTZ;
  v_event_location TEXT;
BEGIN
  SELECT * INTO v_ticket FROM public.tickets WHERE qr_token = p_qr_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Billet introuvable');
  END IF;

  SELECT * INTO v_type FROM public.ticket_types WHERE id = v_ticket.ticket_type_id;

  -- Seul l'organisateur (créateur des billets) ou un admin peut valider
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_validator_id AND (id = v_type.created_by OR role IN ('admin', 'manager'))
  ) INTO v_is_authorized;
  IF NOT v_is_authorized THEN
    RETURN json_build_object('success', false, 'error', 'Non autorisé à valider ce billet');
  END IF;

  -- Récupérer les infos de l'événement
  IF v_ticket.event_type = 'tournament' THEN
    SELECT name, start_date, venue_data->>'city' INTO v_event_name, v_event_date, v_event_location
    FROM public.tournaments WHERE id = v_ticket.event_id;
  ELSIF v_ticket.event_type = 'match' THEN
    SELECT sport, date_time, venue_data->>'city' INTO v_event_name, v_event_date, v_event_location
    FROM public.matches WHERE id = v_ticket.event_id;
  END IF;

  IF v_ticket.status = 'used' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Billet déjà utilisé le ' || TO_CHAR(v_ticket.used_at, 'DD/MM/YYYY à HH24:MI'),
      'ticket_code', v_ticket.ticket_code,
      'ticket_type_name', v_type.name,
      'event_name', COALESCE(v_event_name, 'Événement'),
      'used_at', v_ticket.used_at,
      'validated_by', v_ticket.validated_by
    );
  END IF;
  IF v_ticket.status != 'valid' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Billet non valide (statut: ' || v_ticket.status || ')',
      'ticket_code', v_ticket.ticket_code,
      'ticket_type_name', v_type.name,
      'event_name', COALESCE(v_event_name, 'Événement')
    );
  END IF;

  UPDATE public.tickets
  SET status = 'used', used_at = NOW(), validated_by = p_validator_id
  WHERE id = v_ticket.id;

  SELECT COALESCE(full_name, username, 'Inconnu') INTO v_buyer_name
  FROM public.users WHERE id = v_ticket.buyer_id;

  RETURN json_build_object(
    'success', true,
    'ticket_id', v_ticket.id,
    'ticket_code', v_ticket.ticket_code,
    'ticket_type_name', v_type.name,
    'ticket_type_description', v_type.description,
    'buyer_name', v_buyer_name,
    'buyer_id', v_ticket.buyer_id,
    'holder_name', v_ticket.holder_name,
    'price_paid', v_ticket.price_paid,
    'event_type', v_ticket.event_type,
    'event_id', v_ticket.event_id,
    'event_name', COALESCE(v_event_name, 'Événement'),
    'event_date', v_event_date,
    'event_location', COALESCE(v_event_location, ''),
    'purchased_at', v_ticket.purchased_at,
    'validated_at', NOW()
  );
END;
$$;

-- 2. Fonction: historique des scans pour un organisateur
CREATE OR REPLACE FUNCTION public.get_organizer_scan_history(
  p_organizer_id UUID,
  p_event_type TEXT DEFAULT NULL,
  p_event_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'ticket_code', t.ticket_code,
    'ticket_type_name', tt.name,
    'buyer_name', COALESCE(u.full_name, u.username, 'Inconnu'),
    'holder_name', t.holder_name,
    'price_paid', t.price_paid,
    'status', t.status,
    'event_type', t.event_type,
    'event_id', t.event_id,
    'used_at', t.used_at,
    'validated_at', t.used_at,
    'purchased_at', t.purchased_at
  ) ORDER BY t.used_at DESC NULLS LAST), '[]'::jsonb) INTO v_result
  FROM public.tickets t
  JOIN public.ticket_types tt ON tt.id = t.ticket_type_id
  JOIN public.users u ON u.id = t.buyer_id
  WHERE tt.created_by = p_organizer_id
    AND t.status IN ('used', 'valid')
    AND (p_event_type IS NULL OR t.event_type = p_event_type)
    AND (p_event_id IS NULL OR t.event_id = p_event_id);

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organizer_scan_history(UUID, TEXT, UUID) TO authenticated;

-- 3. Reload schema cache
NOTIFY pgrst, 'reload schema';
