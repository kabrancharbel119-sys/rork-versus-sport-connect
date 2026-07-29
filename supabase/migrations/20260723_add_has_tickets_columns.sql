-- Add has_tickets column to tournaments and matches tables
-- Allows organizers to opt-in to the ticketing system at creation time

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'has_tickets'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN has_tickets boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'has_tickets'
  ) THEN
    ALTER TABLE matches ADD COLUMN has_tickets boolean NOT NULL DEFAULT false;
  END IF;
END $$;
