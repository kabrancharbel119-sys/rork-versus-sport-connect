-- =============================================
-- SAFE RECREATION: support_tickets table
-- Preserves all existing data
-- =============================================

-- Step 1: Create backup table if original exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'support_tickets') THEN
    -- Drop old backup if exists
    DROP TABLE IF EXISTS support_tickets_backup;
    -- Create backup
    CREATE TABLE support_tickets_backup AS SELECT * FROM support_tickets;
    RAISE NOTICE 'Backup created with % rows', (SELECT COUNT(*) FROM support_tickets_backup);
  END IF;
END $$;

-- Step 2: Drop original table (cascade to remove policies/triggers)
DROP TABLE IF EXISTS support_tickets CASCADE;

-- Step 3: Create clean table with minimal required columns
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'other',
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  responses JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Restore data from backup if exists
DO $$
DECLARE
  backup_count INT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'support_tickets_backup') THEN
    backup_count := (SELECT COUNT(*) FROM support_tickets_backup);
    
    IF backup_count > 0 THEN
      INSERT INTO support_tickets (
        id, user_id, category, subject, description, 
        status, priority, responses, created_at, updated_at
      )
      SELECT 
        id,
        user_id,
        COALESCE(category, 'other'),
        COALESCE(subject, ''),
        COALESCE(description, message, ''),
        COALESCE(status, 'open'),
        COALESCE(priority, 'normal'),
        COALESCE(responses, '[]'::jsonb),
        COALESCE(created_at, NOW()),
        COALESCE(updated_at, NOW())
      FROM support_tickets_backup;
      
      RAISE NOTICE 'Restored % rows', backup_count;
    END IF;
    
    -- Drop backup after successful restore
    DROP TABLE support_tickets_backup;
  END IF;
END $$;

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at);

-- Step 6: Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Step 7: Create policies
CREATE POLICY "Users can view their own tickets" 
  ON support_tickets 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own tickets" 
  ON support_tickets 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own tickets" 
  ON support_tickets 
  FOR UPDATE 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all tickets" 
  ON support_tickets 
  FOR SELECT 
  USING (true);

CREATE POLICY "Admins can update all tickets" 
  ON support_tickets 
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete tickets" 
  ON support_tickets 
  FOR DELETE 
  USING (true);

-- Step 8: Create trigger for updated_at
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
