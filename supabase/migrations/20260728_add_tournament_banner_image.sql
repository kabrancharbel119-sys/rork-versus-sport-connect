-- Add banner_image column to tournaments table
-- Used for tournament banner photo/logo display in cards

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS banner_image TEXT;

COMMENT ON COLUMN tournaments.banner_image IS 'URL of the tournament banner image (photo or logo used as card banner)';
