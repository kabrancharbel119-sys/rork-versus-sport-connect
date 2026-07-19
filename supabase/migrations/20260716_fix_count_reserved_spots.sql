-- Update count_reserved_spots to only count confirmed teams
-- pending_payment and payment_submitted teams do NOT reserve a spot
-- until payment is actually confirmed (consistent with venue booking logic)
CREATE OR REPLACE FUNCTION count_reserved_spots(p_tournament_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM tournament_teams
    WHERE tournament_id = p_tournament_id
    AND status = 'confirmed'
  );
END;
$$ LANGUAGE plpgsql;
