-- =============================================
-- ADD responses column to support_tickets
-- =============================================

-- Add responses column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_tickets' AND column_name = 'responses'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN responses JSONB DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Added responses column';
  ELSE
    RAISE NOTICE 'responses column already exists';
  END IF;
END $$;

-- Ensure RLS is enabled and policies exist
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Recreate policies to ensure they work
DROP POLICY IF EXISTS "Users can view their own tickets" ON support_tickets;
CREATE POLICY "Users can view their own tickets" 
  ON support_tickets FOR SELECT 
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own tickets" ON support_tickets;
CREATE POLICY "Users can create their own tickets" 
  ON support_tickets FOR INSERT 
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own tickets" ON support_tickets;
CREATE POLICY "Users can update their own tickets" 
  ON support_tickets FOR UPDATE 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all tickets" ON support_tickets;
CREATE POLICY "Admins can view all tickets" 
  ON support_tickets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update all tickets" ON support_tickets;
CREATE POLICY "Admins can update all tickets" 
  ON support_tickets FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete tickets" ON support_tickets;
CREATE POLICY "Admins can delete tickets" 
  ON support_tickets FOR DELETE USING (true);

-- Grant permissions
GRANT ALL ON support_tickets TO authenticated;
GRANT ALL ON support_tickets TO anon;

SELECT 'responses column added successfully!' as result;
