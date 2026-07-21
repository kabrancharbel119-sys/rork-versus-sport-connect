-- =============================================================
-- Add booking_code column: a short, human-readable, unique code
-- for each booking (e.g. VS-AB12CD). Used for manual entry when
-- QR scanner doesn't work, and displayed on invoices.
-- 100% non-destructive: uses IF NOT EXISTS everywhere, no DROP.
-- =============================================================

-- 1. Add column if it doesn't exist
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_code TEXT;

-- 2. Backfill existing rows that don't have a code (only touches NULL rows)
DO $$
DECLARE
  r RECORD;
  new_code TEXT;
BEGIN
  FOR r IN SELECT id FROM bookings WHERE booking_code IS NULL LOOP
    LOOP
      new_code := 'VS-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || r.id::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));
      -- Check for collision before assigning
      IF NOT EXISTS (SELECT 1 FROM bookings WHERE booking_code = new_code) THEN
        UPDATE bookings SET booking_code = new_code WHERE id = r.id AND booking_code IS NULL;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 3. Add unique index if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS bookings_booking_code_key ON bookings (booking_code);

-- 4. Create function (CREATE OR REPLACE is safe — only updates the function definition)
CREATE OR REPLACE FUNCTION generate_booking_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
BEGIN
  IF NEW.booking_code IS NULL OR NEW.booking_code = '' THEN
    LOOP
      new_code := 'VS-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NEW.id::TEXT || NOW()::TEXT) FROM 1 FOR 6));
      IF NOT EXISTS (SELECT 1 FROM bookings WHERE booking_code = new_code) THEN
        NEW.booking_code := new_code;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger only if it doesn't already exist (no DROP)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'bookings_code_trigger'
      AND tgrelid = 'public.bookings'::regclass
  ) THEN
    CREATE TRIGGER bookings_code_trigger
      BEFORE INSERT ON public.bookings
      FOR EACH ROW
      EXECUTE FUNCTION generate_booking_code();
  END IF;
END $$;

