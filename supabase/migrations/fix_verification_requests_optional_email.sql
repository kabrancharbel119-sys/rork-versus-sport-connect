-- =============================================
-- FIX: Make user_email optional in verification_requests
-- =============================================

-- Add user_email column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'verification_requests' 
    AND column_name = 'user_email'
  ) THEN
    ALTER TABLE verification_requests ADD COLUMN user_email TEXT;
  END IF;
END $$;

-- Make user_email nullable
ALTER TABLE verification_requests ALTER COLUMN user_email DROP NOT NULL;
ALTER TABLE verification_requests ALTER COLUMN user_email SET DEFAULT NULL;
