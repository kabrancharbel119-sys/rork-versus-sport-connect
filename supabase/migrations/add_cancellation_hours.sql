-- Add cancellation_hours to venues table
-- Default: 24 hours before the slot, players cannot cancel after this deadline
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS cancellation_hours INTEGER NOT NULL DEFAULT 24;

-- Verify
SELECT id, name, cancellation_hours FROM venues LIMIT 5;
