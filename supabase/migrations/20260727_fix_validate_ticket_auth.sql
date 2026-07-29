-- ============================================================
-- Fix validate_ticket authorization + event scoping
-- - Allow creator, tournament managers, and admin (monitoring) to validate
-- - Remove generic 'manager' role check
-- - Verify ticket belongs to the expected event (p_expected_event_id)
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_ticket(
  p_qr_token UUID,
  p_validator_id UUID,
  p_expected_event_id UUID DEFAULT NULL,
  p_expected_event_type TEXT DEFAULT NULL
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

  -- Vérifier que le billet appartient à l'événement attendu
  IF p_expected_event_id IS NOT NULL THEN
    IF v_ticket.event_id != p_expected_event_id
       OR (p_expected_event_type IS NOT NULL AND v_ticket.event_type != p_expected_event_type) THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Ce billet n''appartient pas à cet événement',
        'ticket_code', v_ticket.ticket_code,
        'event_name', COALESCE(v_event_name, 'Événement')
      );
    END IF;
  END IF;

  -- Authorized: ticket type creator, tournament managers, or admin
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_validator_id
      AND (
        u.id = v_type.created_by
        OR u.role = 'admin'
        OR (
          v_type.event_type = 'tournament'
          AND EXISTS (
            SELECT 1 FROM public.tournaments t
            WHERE t.id = v_type.event_id
              AND t.managers IS NOT NULL
              AND auth.uid()::text = ANY (SELECT * FROM jsonb_array_elements_text(t.managers))
          )
        )
      )
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

  -- Vérifier que le billet est valide pour le jour courant (si valid_days est défini)
  IF v_type.valid_days IS NOT NULL THEN
    DECLARE
      v_today TEXT;
      v_is_valid_day BOOLEAN;
    BEGIN
      v_today := TO_CHAR(NOW() AT TIME ZONE 'Africa/Abidjan', 'YYYY-MM-DD');
      v_is_valid_day := EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(v_type.valid_days) AS d
        WHERE d = v_today
      );
      IF NOT v_is_valid_day THEN
        RETURN json_build_object(
          'success', false,
          'error', 'Ce billet n''est pas valide pour aujourd''hui (' || v_today || '). Jours valides: ' ||
            array_to_string(ARRAY(SELECT jsonb_array_elements_text(v_type.valid_days)), ', '),
          'ticket_code', v_ticket.ticket_code,
          'ticket_type_name', v_type.name,
          'event_name', COALESCE(v_event_name, 'Événement')
        );
      END IF;
    END;
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

GRANT EXECUTE ON FUNCTION public.validate_ticket(UUID, UUID, UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
