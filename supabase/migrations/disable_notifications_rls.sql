-- ============================================
-- DISABLE RLS ON NOTIFICATIONS (TEMPORARY FIX)
-- This allows the booking notification system to work
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can send notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can only insert notifications for themselves" ON notifications;

-- Disable RLS completely on notifications table
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'notifications';
