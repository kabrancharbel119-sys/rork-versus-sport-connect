-- Fix définitif : supprimer toutes les politiques existantes et recréer des politiques permissives

-- 1. Supprimer toutes les politiques existantes sur storage.objects
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- 2. Désactiver puis réactiver RLS pour repartir proprement
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Politique unique : accès total pour les buckets d'images
CREATE POLICY "allow_all_image_buckets"
ON storage.objects
FOR ALL
TO public
USING (
    bucket_id IN ('avatars', 'venue-images', 'team-logos', 'cv-uploads', 'card-backgrounds')
)
WITH CHECK (
    bucket_id IN ('avatars', 'venue-images', 'team-logos', 'cv-uploads', 'card-backgrounds')
);
