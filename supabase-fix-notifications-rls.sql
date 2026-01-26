-- =============================================
-- Corriger la RLS sur "notifications" pour permettre
-- aux annonces admin d'être insérées pour tous les users.
--
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- Puis cliquer sur Run (ou Ctrl+Entrée).
-- =============================================

-- Étape 1 : Supprimer TOUTES les politiques existantes sur la table notifications
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname);
    RAISE NOTICE 'Politique supprimée: %', pol.policyname;
  END LOOP;
END $$;

-- Étape 2 : Recréer les 4 politiques nécessaires (tout autoriser pour l’app)
CREATE POLICY "notifications_select"
  ON public.notifications FOR SELECT
  USING (true);

CREATE POLICY "notifications_insert"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "notifications_update"
  ON public.notifications FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "notifications_delete"
  ON public.notifications FOR DELETE
  USING (true);

-- Vérification (décommenter pour lancer après) :
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'notifications';
