-- =============================================================================
-- Migration : Ajout du système de validation QR Code pour les réservations
-- =============================================================================

-- Ajout des colonnes à la table bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS check_in_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES users(id);

-- Index unique sur check_in_token pour accès rapide
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_check_in_token ON bookings(check_in_token);

-- Index sur validated_at pour requêtes de statistiques
CREATE INDEX IF NOT EXISTS idx_bookings_validated_at ON bookings(validated_at);

-- Ajout des compteurs à la table users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS completed_bookings_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_show_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS member_since TIMESTAMPTZ DEFAULT NOW();

-- Commentaires sur les nouvelles colonnes
COMMENT ON COLUMN bookings.check_in_token IS 'Token UUID unique pour le QR code de validation';
COMMENT ON COLUMN bookings.validated_at IS 'Date et heure de validation par scan QR';
COMMENT ON COLUMN bookings.validated_by IS 'ID du gestionnaire qui a validé la réservation';
COMMENT ON COLUMN users.completed_bookings_count IS 'Nombre de réservations honorées (QR validé)';
COMMENT ON COLUMN users.no_show_count IS 'Nombre de réservations non honorées';
COMMENT ON COLUMN users.member_since IS 'Date d''ancienneté sur la plateforme';

-- =============================================================================
-- Fonction RPC : Validation d'une réservation par QR Code
-- =============================================================================
CREATE OR REPLACE FUNCTION validate_booking_check_in(
  p_booking_id UUID,
  p_token UUID,
  p_manager_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking_id     UUID;
  v_user_id        UUID;
  v_match_id       UUID;
  v_venue_id       UUID;
  v_status         TEXT;
  v_check_in_token UUID;
  v_validated_at   TIMESTAMPTZ;
  v_start_time     TIMESTAMPTZ;
  v_end_time       TIMESTAMPTZ;
  v_window_open    TIMESTAMPTZ;
  v_window_close   TIMESTAMPTZ;
BEGIN
  -- Étape 1 : Vérifier que la réservation existe avec cet ID
  SELECT b.id, b.user_id, b.match_id, b.venue_id, b.status, b.check_in_token, b.validated_at,
         b.start_time::TIMESTAMPTZ, b.end_time::TIMESTAMPTZ
  INTO v_booking_id, v_user_id, v_match_id, v_venue_id, v_status, v_check_in_token, v_validated_at,
       v_start_time, v_end_time
  FROM bookings b
  WHERE b.id = p_booking_id;

  IF v_booking_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TICKET',
      'error', 'Réservation introuvable pour cet identifiant'
    );
  END IF;

  -- Étape 2 : Vérifier que le token correspond exactement (double-key check)
  IF v_check_in_token IS DISTINCT FROM p_token THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TICKET',
      'error', 'Token invalide : ce QR Code ne correspond pas à cette réservation'
    );
  END IF;

  -- Étape 3 : Vérifier que la réservation est bien confirmée
  IF v_status <> 'confirmed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TICKET',
      'error', 'Réservation non confirmée (statut actuel : ' || v_status || ')'
    );
  END IF;

  -- Étape 4 : Fenêtre temporelle ±2h (si start_time est renseigné)
  IF v_start_time IS NOT NULL AND v_end_time IS NOT NULL THEN
    v_window_open  := v_start_time - INTERVAL '2 hours';
    v_window_close := v_end_time   + INTERVAL '2 hours';
    IF NOW() < v_window_open THEN
      RETURN jsonb_build_object(
        'success',    false,
        'error_code', 'TOO_EARLY',
        'error',      'Trop tôt pour valider cette réservation',
        'window_open', v_window_open
      );
    END IF;
    IF NOW() > v_window_close THEN
      RETURN jsonb_build_object(
        'success',    false,
        'error_code', 'TOO_LATE',
        'error',      'Délai de validation dépassé',
        'window_close', v_window_close
      );
    END IF;
  END IF;

  -- Étape 5 : Vérifier qu'elle n'a pas déjà été validée
  IF v_validated_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TICKET',
      'error', 'Ce QR Code a déjà été utilisé pour valider cette réservation'
    );
  END IF;
  
  -- Mettre à jour la réservation
  UPDATE bookings
  SET 
    status = 'completed',
    validated_at = NOW(),
    validated_by = p_manager_id
  WHERE id = p_booking_id;
  
  -- Incrémenter le compteur de l'utilisateur
  UPDATE users
  SET completed_bookings_count = completed_bookings_count + 1
  WHERE id = v_user_id;
  
  -- Si un match est lié, mettre à jour son statut
  IF v_match_id IS NOT NULL THEN
    UPDATE matches
    SET status = 'completed'
    WHERE id = v_match_id AND status NOT IN ('completed', 'cancelled');
  END IF;
  
  -- Retourner les infos pour l'UI manager
  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'user_id', v_user_id,
    'match_id', v_match_id,
    'validated_at', NOW()
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Permission pour appeler la fonction (authentifiés uniquement)
REVOKE EXECUTE ON FUNCTION validate_booking_check_in(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_booking_check_in(UUID, UUID, UUID) TO authenticated;

COMMENT ON FUNCTION validate_booking_check_in IS 'Valide une réservation par scan QR Code. Met à jour le statut, incrémente les compteurs.';
