-- =============================================================
-- DEPRECATED — DO NOT RUN.
-- This migration performs destructive DELETE operations on the
-- `bookings` table. It has been superseded by a safe, non-destructive
-- alternative implemented directly in the app layer:
--   lib/api/venues.ts -> venuesApi.getOwnerBookings()
-- That function now merges duplicate per-day tournament bookings
-- into a single display entry in memory, without touching the
-- database. No data is deleted or modified. Keep this file for
-- reference only.
-- =============================================================

-- =============================================================
-- FIX: Consolidate duplicate per-day tournament bookings into a
-- single booking per tournament (matches the new app behavior
-- where a tournament creates exactly ONE booking for its venue
-- manager, covering the whole tournament period).
--
-- Root cause: an older version of tournamentsApi.create() created
-- one booking row per day of the tournament. This migration merges
-- all bookings sharing the same tournament_id into a single row:
--   - date       = earliest date among the group
--   - start_time = earliest start_time among the group
--   - end_time   = latest end_time among the group
--   - total_amount = sum of all total_amount in the group
--   - status     = 'confirmed' if any row is confirmed, else
--                  'pending' if any row is pending, else the
--                  status of the kept row
-- The kept row is the one with the earliest created_at.
-- All other rows for that tournament_id are deleted.
-- Safe to run multiple times (idempotent: no-op if already 1:1).
-- =============================================================

DO $$
DECLARE
  t_id UUID;
  keep_id UUID;
  min_date DATE;
  min_start TIMESTAMPTZ;
  max_end TIMESTAMPTZ;
  sum_amount NUMERIC;
  agg_status TEXT;
BEGIN
  FOR t_id IN
    SELECT tournament_id
    FROM public.bookings
    WHERE tournament_id IS NOT NULL
    GROUP BY tournament_id
    HAVING COUNT(*) > 1
  LOOP
    -- Pick the row to keep: earliest created_at
    SELECT id INTO keep_id
    FROM public.bookings
    WHERE tournament_id = t_id
    ORDER BY created_at ASC
    LIMIT 1;

    SELECT
      MIN(date),
      MIN(start_time),
      MAX(end_time),
      COALESCE(SUM(total_amount), 0)
    INTO min_date, min_start, max_end, sum_amount
    FROM public.bookings
    WHERE tournament_id = t_id;

    SELECT CASE
      WHEN bool_or(status = 'confirmed') THEN 'confirmed'
      WHEN bool_or(status = 'pending') THEN 'pending'
      ELSE (SELECT status FROM public.bookings WHERE id = keep_id)
    END INTO agg_status
    FROM public.bookings
    WHERE tournament_id = t_id;

    -- Re-point any invoices referencing the bookings we are about to delete
    -- to the row we keep (context_type = 'booking').
    UPDATE public.invoices
    SET context_id = keep_id
    WHERE context_type = 'booking'
      AND context_id IN (
        SELECT id FROM public.bookings
        WHERE tournament_id = t_id AND id <> keep_id
      );

    -- Delete all other bookings for this tournament
    DELETE FROM public.bookings
    WHERE tournament_id = t_id AND id <> keep_id;

    -- Update the kept booking with consolidated values
    UPDATE public.bookings
    SET
      date = min_date,
      start_time = min_start,
      end_time = max_end,
      total_amount = sum_amount,
      status = agg_status
    WHERE id = keep_id;
  END LOOP;
END $$;
