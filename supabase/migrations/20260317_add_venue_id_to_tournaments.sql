-- Add venue_id column to tournaments table for direct venue linking
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_tournaments_venue_id ON tournaments(venue_id);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
