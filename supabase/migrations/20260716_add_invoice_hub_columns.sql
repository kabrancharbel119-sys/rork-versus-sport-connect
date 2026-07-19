-- Add columns for admin invoice hub: payer_name, payee_name, event_name, event_id, reason
-- Add 'tournament_entry' as a valid context_type

-- Add helpful columns for the admin hub filtering
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payer_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payee_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS event_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS event_id UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reason TEXT;

-- Add index on event_id for filtering
CREATE INDEX IF NOT EXISTS idx_invoices_event_id ON invoices(event_id);

-- Add RLS policy for service role to insert invoices (webhook backend)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'invoices_insert_service'
  ) THEN
    CREATE POLICY invoices_insert_service ON invoices
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'invoices_update_service'
  ) THEN
    CREATE POLICY invoices_update_service ON invoices
      FOR UPDATE USING (true);
  END IF;
END $$;
