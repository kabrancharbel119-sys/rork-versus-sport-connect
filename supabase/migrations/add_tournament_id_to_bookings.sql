-- Add tournament_id column to bookings table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'bookings' AND column_name = 'tournament_id') THEN
    ALTER TABLE bookings ADD COLUMN tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL;
    RAISE NOTICE 'Column tournament_id added to bookings';
  ELSE
    RAISE NOTICE 'Column tournament_id already exists in bookings';
  END IF;
END $$;

-- Add total_amount as alias if only total_price exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'bookings' AND column_name = 'total_amount') THEN
    ALTER TABLE bookings ADD COLUMN total_amount INTEGER NOT NULL DEFAULT 0;
    RAISE NOTICE 'Column total_amount added to bookings';
  ELSE
    RAISE NOTICE 'Column total_amount already exists in bookings';
  END IF;
END $$;

-- Add index
CREATE INDEX IF NOT EXISTS idx_bookings_tournament_id ON bookings(tournament_id);

-- Add venue_pending to tournaments status if constrained
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_status_check;
ALTER TABLE tournaments ADD CONSTRAINT tournaments_status_check
  CHECK (status IN ('venue_pending', 'registration', 'in_progress', 'completed', 'cancelled'));
