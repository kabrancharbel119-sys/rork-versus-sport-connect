-- Add venue_pending to matches status check constraint
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;

ALTER TABLE matches ADD CONSTRAINT matches_status_check
  CHECK (status IN ('venue_pending', 'open', 'confirmed', 'in_progress', 'completed', 'cancelled'));
