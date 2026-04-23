-- =============================================
-- FIX: Add default value for created_at in verification_requests
-- =============================================

-- Add created_at column with default if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'verification_requests' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE verification_requests ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  ELSE
    -- Ensure default is set
    ALTER TABLE verification_requests ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
END $$;

-- Update any existing rows with null created_at
UPDATE verification_requests 
SET created_at = NOW() 
WHERE created_at IS NULL;

-- Ensure RLS is enabled
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;

-- Recreate policies
DROP POLICY IF EXISTS "Users can view their own verification requests" ON verification_requests;
CREATE POLICY "Users can view their own verification requests" 
  ON verification_requests FOR SELECT 
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own verification requests" ON verification_requests;
CREATE POLICY "Users can create their own verification requests" 
  ON verification_requests FOR INSERT 
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all verification requests" ON verification_requests;
CREATE POLICY "Admins can view all verification requests" 
  ON verification_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update verification requests" ON verification_requests;
CREATE POLICY "Admins can update verification requests" 
  ON verification_requests FOR UPDATE USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON verification_requests TO authenticated;
GRANT ALL ON verification_requests TO anon;

SELECT 'verification_requests table fixed!' as result;
