-- Migration: Add country column to venues table
-- Created: 2026-01-24

-- Add country column to venues table
ALTER TABLE venues 
ADD COLUMN IF NOT EXISTS country TEXT;

-- Add latitude/longitude columns if they don't exist (for completeness)
ALTER TABLE venues 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;

ALTER TABLE venues 
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add comment for documentation
COMMENT ON COLUMN venues.country IS 'Pays du lieu (ex: Côte d''Ivoire, France)';
COMMENT ON COLUMN venues.latitude IS 'Latitude GPS du lieu';
COMMENT ON COLUMN venues.longitude IS 'Longitude GPS du lieu';

-- Create index for country searches
CREATE INDEX IF NOT EXISTS idx_venues_country ON venues(country) WHERE country IS NOT NULL;

-- Create index for geo searches
CREATE INDEX IF NOT EXISTS idx_venues_location ON venues(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
