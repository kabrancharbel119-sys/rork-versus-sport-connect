-- Add payment_requested_at column to bookings
-- This tracks when the manager explicitly requests payment from the client
-- 100% non-destructive: uses IF NOT EXISTS, DO blocks for conditional logic
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_requested_at TIMESTAMPTZ;

-- Enable Realtime on bookings table (only if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
  END IF;
END $$;

-- Set replica identity to FULL (safe — can be run multiple times)
ALTER TABLE bookings REPLICA IDENTITY FULL;

