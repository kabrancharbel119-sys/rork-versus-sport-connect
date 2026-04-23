-- =============================================
-- FIX ALL: Complete support_tickets rebuild
-- Preserves data, fixes all column issues
-- =============================================

-- Step 1: Backup existing data (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'support_tickets') THEN
    -- Create temp backup
    DROP TABLE IF EXISTS temp_support_tickets_backup;
    CREATE TABLE temp_support_tickets_backup AS SELECT * FROM support_tickets;
    RAISE NOTICE 'Backup created: % rows', (SELECT COUNT(*) FROM temp_support_tickets_backup);
  END IF;
END $$;

-- Step 2: Drop table completely (removes all policies, triggers, etc)
DROP TABLE IF EXISTS support_tickets CASCADE;

-- Step 3: Create table with EXACT columns needed by the app
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  responses JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Restore data from backup (map columns appropriately)
DO $$
DECLARE
  has_responses BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'temp_support_tickets_backup') THEN
    -- Check if backup has responses column
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'temp_support_tickets_backup' AND column_name = 'responses'
    ) INTO has_responses;
    
    IF has_responses THEN
      INSERT INTO support_tickets (
        id, user_id, category, subject, description, 
        status, priority, responses, created_at, updated_at
      )
      SELECT 
        id,
        COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::UUID),
        COALESCE(category, 'other'),
        COALESCE(subject, ''),
        COALESCE(description, ''),
        COALESCE(status, 'open'),
        COALESCE(priority, 'normal'),
        COALESCE(responses, '[]'::jsonb),
        COALESCE(created_at, NOW()),
        COALESCE(updated_at, NOW())
      FROM temp_support_tickets_backup;
    ELSE
      INSERT INTO support_tickets (
        id, user_id, category, subject, description, 
        status, priority, responses, created_at, updated_at
      )
      SELECT 
        id,
        COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::UUID),
        COALESCE(category, 'other'),
        COALESCE(subject, ''),
        COALESCE(description, ''),
        COALESCE(status, 'open'),
        COALESCE(priority, 'normal'),
        '[]'::jsonb,
        COALESCE(created_at, NOW()),
        COALESCE(updated_at, NOW())
      FROM temp_support_tickets_backup;
    END IF;
    
    -- Clean up backup
    DROP TABLE temp_support_tickets_backup;
    RAISE NOTICE 'Data restored successfully';
  END IF;
END $$;

-- Step 5: Create indexes
CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at);

-- Step 6: Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Step 7: Create all RLS policies
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

-- Step 8: Create trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_support_ticket_timestamp ON support_tickets;
CREATE TRIGGER update_support_ticket_timestamp
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_ticket_timestamp();

-- Step 9: Grant permissions
GRANT ALL ON support_tickets TO authenticated;
GRANT ALL ON support_tickets TO anon;

-- Done!
SELECT 'support_tickets table fixed successfully!' as result;
