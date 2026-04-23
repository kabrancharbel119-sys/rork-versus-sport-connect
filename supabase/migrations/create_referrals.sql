-- =============================================
-- REFERRALS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  referral_code TEXT NOT NULL,
  reward_amount INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure unique referral (one user can only be referred once)
  UNIQUE(referred_id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

-- Enable RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Users can view their own referrals (as referrer or referred)
CREATE POLICY "Users can view their own referrals" 
  ON referrals 
  FOR SELECT 
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

-- Only system can create referrals (via API/triggers)
CREATE POLICY "System can create referrals" 
  ON referrals 
  FOR INSERT 
  WITH CHECK (true);

-- Admin can view all referrals
CREATE POLICY "Admins can view all referrals" 
  ON referrals 
  FOR ALL 
  USING (true);

-- Function to generate referral code on user creation
CREATE OR REPLACE FUNCTION generate_user_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate code from user id (last 6 chars uppercase)
  NEW.referral_code := 'VS' || UPPER(RIGHT(NEW.id::text, 6));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add referral_code column to users if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'referral_code') THEN
    ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE;
  END IF;
END $$;

-- Create trigger to auto-generate referral code for new users
DROP TRIGGER IF EXISTS set_user_referral_code ON users;
CREATE TRIGGER set_user_referral_code
  BEFORE INSERT ON users
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION generate_user_referral_code();

-- Update existing users with NULL referral_code
UPDATE users 
SET referral_code = 'VS' || UPPER(RIGHT(id::text, 6))
WHERE referral_code IS NULL;
