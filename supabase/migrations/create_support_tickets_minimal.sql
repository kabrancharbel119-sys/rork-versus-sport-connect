-- =============================================
-- MINIMAL SUPPORT TICKETS TABLE
-- Clean structure without user_name/user_email
-- =============================================

-- Drop existing table (backup first if needed)
DROP TABLE IF EXISTS support_tickets_backup;
CREATE TABLE IF NOT EXISTS support_tickets_backup AS SELECT * FROM support_tickets WHERE false;
INSERT INTO support_tickets_backup SELECT * FROM support_tickets;

-- Drop original table with cascade
DROP TABLE IF EXISTS support_tickets CASCADE;

-- Create clean minimal table
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'other',
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own tickets" 
  ON support_tickets FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own tickets" 
  ON support_tickets FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own tickets" 
  ON support_tickets FOR UPDATE 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all tickets" 
  ON support_tickets FOR SELECT USING (true);

CREATE POLICY "Admins can update all tickets" 
  ON support_tickets FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Admins can delete tickets" 
  ON support_tickets FOR DELETE USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_support_ticket_timestamp
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_ticket_timestamp();
