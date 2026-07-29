-- Add banner_image column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_image text;
