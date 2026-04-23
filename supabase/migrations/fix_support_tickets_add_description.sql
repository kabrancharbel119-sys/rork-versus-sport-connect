-- =============================================
-- FIX: Add missing description column to support_tickets
-- =============================================

-- Add description column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN description TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- Also ensure other columns exist
DO $$ 
BEGIN
  -- Add responses column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' 
    AND column_name = 'responses'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN responses JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Add priority column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' 
    AND column_name = 'priority'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal';
  END IF;
END $$;
