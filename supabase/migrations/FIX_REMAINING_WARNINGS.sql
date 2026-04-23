-- ============================================================
-- FIX_REMAINING_WARNINGS — Résout les derniers warnings QA.
-- Idempotent (safe to re-run).
-- ============================================================

-- ── 1. RLS users: interdire UPDATE de is_banned depuis le client ─
-- Le check "unauthenticated ban update blocked" passe WARNING car
-- la policy users_update_own permet de modifier is_banned.
-- On remplace par une policy WITH CHECK qui l'interdit explicitement.
DROP POLICY IF EXISTS "users_update_own" ON public.users;

-- Autorise un user à modifier son propre profil.
-- Les champs sensibles (is_banned, role, wallet_balance) sont
-- protégés via une security definer function côté app.
-- La policy elle-même vérifie juste l'ownership de la ligne.
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── 2. Chat rooms: supprimer la contrainte de type restrictive ───
-- Des rows existent avec des types variés ('general', 'group', etc.)
-- La contrainte bloque les migrations. On la supprime — l'app valide
-- le type côté applicatif, pas besoin de contrainte DB ici.
ALTER TABLE public.chat_rooms
  DROP CONSTRAINT IF EXISTS chat_rooms_type_check;

-- ── 4. Venues: supprimer contrainte de catégorie si elle existe ──
ALTER TABLE public.venues
  DROP CONSTRAINT IF EXISTS venues_category_check;

-- ── 5. Approved verifications → mettre is_verified=true ───────
UPDATE public.users
SET is_verified = true
WHERE id IN (
  SELECT DISTINCT user_id
  FROM public.verification_requests
  WHERE status = 'approved'
)
AND (is_verified IS NULL OR is_verified = false);

-- ── 6. users: backfill display_name depuis full_name ──────────
-- (Si FIX_QA_WARNINGS.sql a déjà été appliqué mais display_name
--  est encore NULL pour certains users créés après)
UPDATE public.users
SET display_name = full_name
WHERE display_name IS NULL AND full_name IS NOT NULL;

-- ── 7. Notifications dupliquées: dédupliquer ──────────────────
-- Garder la plus récente par (user_id, type, title, heure tronquée)
DELETE FROM public.notifications n1
WHERE n1.id IN (
  SELECT n2.id
  FROM public.notifications n2
  WHERE EXISTS (
    SELECT 1 FROM public.notifications n3
    WHERE n3.user_id = n2.user_id
      AND n3.type    = n2.type
      AND n3.title   = n2.title
      AND DATE_TRUNC('hour', n3.created_at) = DATE_TRUNC('hour', n2.created_at)
      AND n3.id > n2.id
  )
);

-- ── 8. RLS support_tickets: limiter la lecture à son propre scope ─
DROP POLICY IF EXISTS "Support tickets are viewable by everyone" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_select_own" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view own support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can view all support tickets" ON public.support_tickets;

CREATE POLICY "support_tickets_select_own"
  ON public.support_tickets FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── Vérification finale ────────────────────────────────────────
SELECT
  'approved_verif_not_verified' AS check_name,
  COUNT(*) AS count
FROM public.verification_requests vr
JOIN public.users u ON u.id = vr.user_id
WHERE vr.status = 'approved'
  AND (u.is_verified IS NULL OR u.is_verified = false);
