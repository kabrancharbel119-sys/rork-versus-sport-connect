-- =============================================
-- PLAN B : Désactiver complètement la RLS sur "notifications"
-- À n’utiliser que si le script principal n’a pas résolu le blocage.
--
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- =============================================

-- Désactive la RLS sur la table notifications (aucune politique n’est alors appliquée)
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- Pour revenir en arrière plus tard et réactiver la RLS :
-- ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
-- Puis ré-exécuter supabase-fix-notifications-rls.sql
