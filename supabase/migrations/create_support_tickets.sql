-- =============================================
-- SUPPORT TICKETS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bug', 'account', 'payment', 'feature', 'team', 'match', 'other')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  responses JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can view their own tickets
CREATE POLICY "Users can view their own tickets" 
  ON support_tickets 
  FOR SELECT 
  USING (user_id = auth.uid());

-- Users can create their own tickets
CREATE POLICY "Users can create their own tickets" 
  ON support_tickets 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Users can update their own tickets (add responses)
CREATE POLICY "Users can update their own tickets" 
  ON support_tickets 
  FOR UPDATE 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin can view all tickets
CREATE POLICY "Admins can view all tickets" 
  ON support_tickets 
  FOR SELECT 
  USING (true);

-- Admin can update all tickets
CREATE POLICY "Admins can update all tickets" 
  ON support_tickets 
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- Admin can delete tickets
CREATE POLICY "Admins can delete tickets" 
  ON support_tickets 
  FOR DELETE 
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_support_ticket_timestamp ON support_tickets;
CREATE TRIGGER update_support_ticket_timestamp
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_ticket_timestamp();
