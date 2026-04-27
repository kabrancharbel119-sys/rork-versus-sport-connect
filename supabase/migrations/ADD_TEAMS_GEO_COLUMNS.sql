-- Migration: Verify geo columns exist in teams table
-- Created: 2026-01-24
-- Note: location_lat and location_lng columns already exist in schema

-- Add columns if they don't exist (using existing naming convention)
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS location_lat REAL;

ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS location_lng REAL;

-- Add comment for documentation
COMMENT ON COLUMN teams.location_lat IS 'Latitude GPS de la ville de l''équipe';
COMMENT ON COLUMN teams.location_lng IS 'Longitude GPS de la ville de l''équipe';

-- Create index for geo searches (if columns exist)
CREATE INDEX IF NOT EXISTS idx_teams_location ON teams(location_lat, location_lng) WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;
