-- ============================================
-- DISABLE RLS ON BOOKINGS (TEMPORARY FIX)
-- This allows venue managers to see all bookings for their venues
-- ============================================

-- Drop all existing policies on bookings
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can insert own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can delete own bookings" ON bookings;
DROP POLICY IF EXISTS "Venue owners can view bookings" ON bookings;
DROP POLICY IF EXISTS "Venue owners can update bookings" ON bookings;

-- Disable RLS completely on bookings table
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'bookings';

-- Show all bookings to verify data exists
SELECT id, venue_id, user_id, date, status, created_at
FROM bookings
ORDER BY created_at DESC
LIMIT 10;
