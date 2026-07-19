-- Add confirmed_at column to tournament_teams for tracking payment confirmation timestamp
ALTER TABLE tournament_teams ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
