-- =============================================
-- Rendre les tournois visibles par tous dans l'app
-- =============================================
-- Si le tournoi démo n'apparaît pas dans l'app, exécuter ce script
-- dans Supabase : SQL Editor > New query > Coller > Run.
--
-- Cela autorise tous les utilisateurs (connectés ou non) à lire les tournois.
-- =============================================

-- Supprimer une éventuelle politique SELECT restrictive
DROP POLICY IF EXISTS "Tournaments are viewable by everyone" ON tournaments;
DROP POLICY IF EXISTS "tournaments_select_policy" ON tournaments;

-- Autoriser la lecture de tous les tournois
CREATE POLICY "Tournaments are viewable by everyone"
  ON tournaments FOR SELECT
  USING (true);
