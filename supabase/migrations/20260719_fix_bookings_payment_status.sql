-- =============================================
-- FIX: Ensure payment_status column and check constraint are correct
-- =============================================
-- The check constraint on bookings.payment_status must allow:
--   not_required, pending, paid, refunded, failed
-- This migration drops any existing constraint and recreates it properly.

-- 1. Ensure the column exists with correct type and default
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'not_required';

-- 2. Backfill any NULL values (shouldn't exist due to NOT NULL, but just in case)
UPDATE public.bookings SET payment_status = 'not_required' WHERE payment_status IS NULL;

-- 3. Drop any existing check constraint on payment_status (name may vary)
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check1;

-- 4. Recreate the correct check constraint
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('not_required', 'pending', 'paid', 'refunded', 'failed'));

-- 5. Ensure other payment columns exist
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
