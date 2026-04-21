-- Fix bookings RLS so venue managers can see bookings for their venues

-- Drop all existing policies on bookings
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
