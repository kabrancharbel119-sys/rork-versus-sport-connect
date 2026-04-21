-- ============================================================
-- Fix storage RLS - allow all authenticated users to upload
-- ============================================================

-- Drop all existing policies for our buckets to start clean
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual LIKE '%avatars%' OR qual LIKE '%venue-images%' OR qual LIKE '%team-logos%'
           OR with_check LIKE '%avatars%' OR with_check LIKE '%venue-images%' OR with_check LIKE '%team-logos%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Allow public SELECT on all 3 buckets
CREATE POLICY "storage_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('avatars', 'venue-images', 'team-logos'));

-- Allow authenticated INSERT on all 3 buckets
CREATE POLICY "storage_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('avatars', 'venue-images', 'team-logos'));

-- Allow authenticated UPDATE on all 3 buckets
CREATE POLICY "storage_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('avatars', 'venue-images', 'team-logos'));

-- Allow authenticated DELETE on all 3 buckets
CREATE POLICY "storage_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id IN ('avatars', 'venue-images', 'team-logos'));

-- Also allow service_role full access (bypasses RLS but just in case)
CREATE POLICY "storage_service_role_all"
  ON storage.objects
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verify
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
