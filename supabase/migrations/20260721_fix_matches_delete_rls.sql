-- Fix: Allow match creator OR admins to delete matches regardless of status
-- The previous policy (FIX_PRODUCTION_RLS.sql) restricted deletes to
-- status IN ('pending', 'upcoming', 'open', 'cancelled'), blocking
-- deletion of matches with status 'confirmed' or 'venue_pending'.

DO $$
BEGIN
  -- Drop old policies only if they exist
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'matches' AND policyname = 'matches_delete_own'
  ) THEN
    DROP POLICY "matches_delete_own" ON public.matches;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'matches' AND policyname = 'matches_delete_all'
  ) THEN
    DROP POLICY "matches_delete_all" ON public.matches;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'matches' AND policyname = 'matches_delete'
  ) THEN
    DROP POLICY "matches_delete" ON public.matches;
  END IF;
END $$;

-- Creator or admin/manager can delete matches (any status)
CREATE POLICY "matches_delete_own"
  ON public.matches FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );
