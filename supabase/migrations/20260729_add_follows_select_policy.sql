-- Add SELECT and DELETE policies on follows table so users can read/unfollow
-- Without this, RLS blocks all SELECT queries on the follows table
-- Safe: no DROP, no destructive operations

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'follows' AND policyname = 'follows_select'
  ) THEN
    CREATE POLICY "follows_select" ON public.follows
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'follows' AND policyname = 'follows_delete'
  ) THEN
    CREATE POLICY "follows_delete" ON public.follows
      FOR DELETE TO authenticated
      USING (true);
  END IF;
END$$;
