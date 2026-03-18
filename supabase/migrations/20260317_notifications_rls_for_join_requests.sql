-- Ensure notifications RLS supports cross-user team request notifications
-- Needed so requester can create a notification for captain on join requests

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Remove potentially conflicting policies from prior migrations
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can send notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;

-- Users only see their own notifications
CREATE POLICY "notifications_select_own"
  ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated users can insert notifications for any recipient
-- Required for workflows like: requester -> captain notification
CREATE POLICY "notifications_insert_any_authenticated"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update only their own notifications
CREATE POLICY "notifications_update_own"
  ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete only their own notifications
CREATE POLICY "notifications_delete_own"
  ON notifications
  FOR DELETE
  USING (auth.uid() = user_id);
