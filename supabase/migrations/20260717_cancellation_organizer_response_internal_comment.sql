-- Migration: Add organizer_response and internal_comment columns
-- organizer_response: visible to the organizer (admin's reply)
-- internal_comment: visible only to admins (private note)

-- Add new columns
ALTER TABLE tournament_cancellation_requests
  ADD COLUMN IF NOT EXISTS organizer_response TEXT,
  ADD COLUMN IF NOT EXISTS internal_comment TEXT;

-- Migrate existing admin_note data to organizer_response
UPDATE tournament_cancellation_requests
SET organizer_response = admin_note
WHERE admin_note IS NOT NULL AND organizer_response IS NULL;

-- Note: we keep admin_note column for backward compatibility but new code uses organizer_response
