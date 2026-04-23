-- =============================================
-- VERIFICATION REQUESTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS verification_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_avatar TEXT,
  document_type TEXT DEFAULT 'identity' CHECK (document_type IN ('identity', 'passport', 'license', 'other')),
  document_url TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_created_at ON verification_requests(created_at);

-- Enable RLS
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view their own verification requests" 
  ON verification_requests 
  FOR SELECT 
  USING (user_id = auth.uid());

-- Users can create their own requests
CREATE POLICY "Users can create their own verification requests" 
  ON verification_requests 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Admin can view all verification requests
CREATE POLICY "Admins can view all verification requests" 
  ON verification_requests 
  FOR SELECT 
  USING (true);

-- Admin can update all verification requests (approve/reject)
CREATE POLICY "Admins can update all verification requests" 
  ON verification_requests 
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- Admin can delete verification requests
CREATE POLICY "Admins can delete verification requests" 
  ON verification_requests 
  FOR DELETE 
  USING (true);
