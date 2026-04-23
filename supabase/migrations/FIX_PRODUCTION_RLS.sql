-- ============================================================
-- FIX PRODUCTION RLS POLICIES
-- Remplace les policies permissives (USING true) par des
-- policies correctement scopées pour la production.
-- ============================================================

-- ============================================================
-- TABLE: users
-- Problème: UPDATE role arbitraire possible depuis le client
-- ============================================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_update_all" ON public.users;

-- Les utilisateurs ne peuvent mettre à jour QUE leur propre ligne
-- et ne peuvent PAS changer leur role, is_banned, wallet_balance
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Interdire l'escalade de rôle côté client (le rôle ne peut être
    -- changé que via une fonction server-side / service_role)
  );

-- Admins peuvent tout mettre à jour via service_role (bypass RLS)
-- Donc pas besoin de policy admin ici — utiliser service_role côté backend.

-- ============================================================
-- TABLE: matches
-- Problème: DELETE arbitraire possible
-- ============================================================
DROP POLICY IF EXISTS "matches_delete_all" ON public.matches;
DROP POLICY IF EXISTS "matches_delete_own" ON public.matches;
DROP POLICY IF EXISTS "matches_delete" ON public.matches;

-- Seul le créateur peut supprimer un match (et seulement si pas commencé)
CREATE POLICY "matches_delete_own"
  ON public.matches FOR DELETE
  USING (
    created_by = auth.uid()
    AND status IN ('pending', 'upcoming', 'open', 'cancelled')
  );

-- ============================================================
-- TABLE: tournament_payments
-- Problème: UPDATE status=approved possible depuis le client
-- ============================================================
DROP POLICY IF EXISTS "tournament_payments_update_all" ON public.tournament_payments;
DROP POLICY IF EXISTS "tournament_payments_update_own" ON public.tournament_payments;
DROP POLICY IF EXISTS "tournament_payments_update_submit" ON public.tournament_payments;
DROP POLICY IF EXISTS "tournament_payments_update" ON public.tournament_payments;

-- Les équipes peuvent seulement soumettre leur preuve (status: pending→submitted)
CREATE POLICY "tournament_payments_update_submit"
  ON public.tournament_payments FOR UPDATE
  USING (team_id IN (
    SELECT id FROM public.teams WHERE captain_id = auth.uid()
  ))
  WITH CHECK (
    status = 'submitted'
    AND team_id IN (
      SELECT id FROM public.teams WHERE captain_id = auth.uid()
    )
  );

-- ============================================================
-- TABLE: bookings
-- Problème: UPDATE status=confirmed possible depuis le client
-- ============================================================
DROP POLICY IF EXISTS "bookings_update_all" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_own" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_cancel_own" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_venue_owner" ON public.bookings;

-- Le demandeur peut annuler sa propre réservation
CREATE POLICY "bookings_update_cancel_own"
  ON public.bookings FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'cancelled'
  );

-- Le propriétaire du venue peut confirmer/refuser
CREATE POLICY "bookings_update_venue_owner"
  ON public.bookings FOR UPDATE
  USING (
    venue_id IN (
      SELECT id FROM public.venues WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    venue_id IN (
      SELECT id FROM public.venues WHERE owner_id = auth.uid()
    )
    AND status IN ('confirmed', 'cancelled')
  );

-- ============================================================
-- TABLE: tournament_payout_requests
-- Problème: INSERT/UPDATE sans vérification d'ownership
-- ============================================================
DROP POLICY IF EXISTS "payout_requests_insert_all" ON public.tournament_payout_requests;
DROP POLICY IF EXISTS "payout_requests_update_all" ON public.tournament_payout_requests;
DROP POLICY IF EXISTS "payout_requests_insert_organizer" ON public.tournament_payout_requests;

-- Seul l'organisateur du tournoi peut créer une demande de payout
CREATE POLICY "payout_requests_insert_organizer"
  ON public.tournament_payout_requests FOR INSERT
  WITH CHECK (
    tournament_id IN (
      SELECT id FROM public.tournaments WHERE created_by = auth.uid()
    )
  );

-- NOTE: user_trophies policies sont définies dans create_user_trophies.sql
-- Appliquer d'abord: supabase/migrations/create_user_trophies.sql

-- ============================================================
-- Vérification: lister les policies actives sur les tables critiques
-- ============================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('users', 'matches', 'tournament_payments', 'bookings', 'tournament_payout_requests', 'user_trophies')
ORDER BY tablename, policyname;
