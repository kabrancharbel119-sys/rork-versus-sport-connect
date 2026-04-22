-- Add co_captain_ids column to teams table if it doesn't exist
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS co_captain_ids JSONB DEFAULT '[]'::jsonb;
