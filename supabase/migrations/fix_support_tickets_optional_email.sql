-- =============================================
-- FIX: Make user_email optional in support_tickets
-- =============================================

-- Add user_email column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' 
    AND column_name = 'user_email'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN user_email TEXT;
  END IF;
END $$;

-- Make user_email nullable (in case it was created as NOT NULL)
ALTER TABLE support_tickets ALTER COLUMN user_email DROP NOT NULL;
ALTER TABLE support_tickets ALTER COLUMN user_email SET DEFAULT NULL;

-- Also make user_name optional since we can get it from users table
-- But keep it for display convenience
