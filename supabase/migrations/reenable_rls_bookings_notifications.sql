-- ============================================
-- RE-ENABLE RLS ON BOOKINGS AND NOTIFICATIONS
-- Fixes Supabase security advisory: rls_disabled_in_public
-- ============================================

-- ─── BOOKINGS ───────────────────────────────────────────────────────────────

-- Drop all existing policies cleanly
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'bookings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON bookings', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Users can see their own bookings
CREATE POLICY "bookings_select_own" ON bookings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Venue managers can see all bookings for their venues
CREATE POLICY "bookings_select_owner" ON bookings
  FOR SELECT TO authenticated
  USING (
    venue_id IN (
      SELECT id FROM venues WHERE owner_id = auth.uid()
    )
  );

-- Any authenticated user can create a booking
CREATE POLICY "bookings_insert" ON bookings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Venue managers can update booking status (approve/reject)
CREATE POLICY "bookings_update_owner" ON bookings
  FOR UPDATE TO authenticated
  USING (
    venue_id IN (
      SELECT id FROM venues WHERE owner_id = auth.uid()
    )
  );

-- Users can update their own bookings (cancel)
CREATE POLICY "bookings_update_own" ON bookings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own bookings
CREATE POLICY "bookings_delete_own" ON bookings
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ─── NOTIFICATIONS ──────────────────────────────────────────────────────────

-- Drop all existing policies cleanly
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'notifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Any authenticated user can send a notification to any other user
-- (needed for booking confirmations, tournament alerts, etc.)
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Users can mark their own notifications as read
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
