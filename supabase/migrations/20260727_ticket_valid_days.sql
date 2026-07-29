-- ============================================================
-- TICKET VALID DAYS: multi-day event ticket scoping
-- Allows ticket types to be valid only on specific days of a multi-day event
-- valid_days = NULL  => valid all days
-- valid_days = ["2026-02-15", "2026-02-17"]  => valid only on those dates
-- ============================================================

ALTER TABLE public.ticket_types
  ADD COLUMN IF NOT EXISTS valid_days JSONB DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.ticket_types.valid_days IS
  'NULL = valid all event days. Array of date strings (YYYY-MM-DD) = valid only on those days.';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
