-- ============================================================
-- Supabase Storage: Create buckets + RLS policies for images
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Create buckets (public = accessible without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars',      'avatars',      true),
  ('venue-images', 'venue-images', true),
  ('team-logos',   'team-logos',   true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================================
-- 2. AVATARS bucket policies
-- ============================================================

-- Allow anyone to read avatars (public bucket)
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Allow authenticated users to upload their own avatar
DROP POLICY IF EXISTS "avatars_auth_upload" ON storage.objects;
CREATE POLICY "avatars_auth_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated users to update/replace their avatar
DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
CREATE POLICY "avatars_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars');

-- Allow authenticated users to delete their avatar
DROP POLICY IF EXISTS "avatars_auth_delete" ON storage.objects;
CREATE POLICY "avatars_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars');

-- ============================================================
-- 3. VENUE-IMAGES bucket policies
-- ============================================================

-- Allow anyone to read venue images
DROP POLICY IF EXISTS "venue_images_public_read" ON storage.objects;
CREATE POLICY "venue_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'venue-images');

-- Allow authenticated users to upload venue images
DROP POLICY IF EXISTS "venue_images_auth_upload" ON storage.objects;
CREATE POLICY "venue_images_auth_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'venue-images');

-- Allow authenticated users to update venue images
DROP POLICY IF EXISTS "venue_images_auth_update" ON storage.objects;
CREATE POLICY "venue_images_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'venue-images');

-- Allow authenticated users to delete venue images
DROP POLICY IF EXISTS "venue_images_auth_delete" ON storage.objects;
CREATE POLICY "venue_images_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'venue-images');

-- ============================================================
-- 4. TEAM-LOGOS bucket policies
-- ============================================================

-- Allow anyone to read team logos
DROP POLICY IF EXISTS "team_logos_public_read" ON storage.objects;
CREATE POLICY "team_logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'team-logos');

-- Allow authenticated users to upload team logos
DROP POLICY IF EXISTS "team_logos_auth_upload" ON storage.objects;
CREATE POLICY "team_logos_auth_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'team-logos');

-- Allow authenticated users to update team logos
DROP POLICY IF EXISTS "team_logos_auth_update" ON storage.objects;
CREATE POLICY "team_logos_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'team-logos');

-- Allow authenticated users to delete team logos
DROP POLICY IF EXISTS "team_logos_auth_delete" ON storage.objects;
CREATE POLICY "team_logos_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'team-logos');

-- ============================================================
-- 5. Clean up old blob: / local URIs stored in database
-- ============================================================

DO $$
BEGIN
  -- Remove invalid local URIs from venues.images array
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'venues'
  ) THEN
    UPDATE public.venues
    SET images = (
      SELECT COALESCE(
        array_agg(img) FILTER (WHERE img LIKE 'http%'),
        ARRAY[]::text[]
      )
      FROM unnest(images) AS img
    )
    WHERE images IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(images) AS img
        WHERE img NOT LIKE 'http%'
      );
  END IF;

  -- Clear invalid avatar URIs from users table (column: avatar)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar'
  ) THEN
    UPDATE public.users
    SET avatar = NULL
    WHERE avatar IS NOT NULL
      AND avatar NOT LIKE 'http%';
  END IF;

  -- Clear invalid avatar URIs from users table (column: avatar_url, fallback)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar_url'
  ) THEN
    UPDATE public.users
    SET avatar_url = NULL
    WHERE avatar_url IS NOT NULL
      AND avatar_url NOT LIKE 'http%';
  END IF;
END $$;
