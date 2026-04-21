-- ============================================================
-- Create storage buckets + RLS policies
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Create buckets as public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',      'avatars',      true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('venue-images', 'venue-images', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('team-logos',   'team-logos',   true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "avatars_public_read"       ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_upload"       ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_update"       ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_delete"       ON storage.objects;
DROP POLICY IF EXISTS "venue_images_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "venue_images_auth_upload"  ON storage.objects;
DROP POLICY IF EXISTS "venue_images_auth_update"  ON storage.objects;
DROP POLICY IF EXISTS "venue_images_auth_delete"  ON storage.objects;
DROP POLICY IF EXISTS "team_logos_public_read"    ON storage.objects;
DROP POLICY IF EXISTS "team_logos_auth_upload"    ON storage.objects;
DROP POLICY IF EXISTS "team_logos_auth_update"    ON storage.objects;
DROP POLICY IF EXISTS "team_logos_auth_delete"    ON storage.objects;

-- 3. Avatars policies
CREATE POLICY "avatars_public_read"   ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_upload"   ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_update"   ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_delete"   ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');

-- 4. Venue-images policies
CREATE POLICY "venue_images_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'venue-images');
CREATE POLICY "venue_images_auth_upload"  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'venue-images');
CREATE POLICY "venue_images_auth_update"  ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'venue-images');
CREATE POLICY "venue_images_auth_delete"  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'venue-images');

-- 5. Team-logos policies
CREATE POLICY "team_logos_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'team-logos');
CREATE POLICY "team_logos_auth_upload"  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'team-logos');
CREATE POLICY "team_logos_auth_update"  ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'team-logos');
CREATE POLICY "team_logos_auth_delete"  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'team-logos');
