-- ============================================
-- FIX NOTIFICATIONS RLS POLICY
-- Allow users to send notifications to other users
-- ============================================

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can only insert notifications for themselves" ON notifications;

-- Enable RLS on notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert notifications for ANY user (needed for booking notifications)
-- This allows the booking system to send notifications to venue owners
DROP POLICY IF EXISTS "Users can send notifications" ON notifications;
CREATE POLICY "Users can send notifications" ON notifications
  FOR INSERT
  WITH CHECK (true);  -- Allow any authenticated user to send notifications

-- Policy: Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;
