-- ══════════════════════════════════════════════════════════════
-- CRÉER LE PROFIL ADMIN POUR kabrancharbel2@gmail.com
-- ══════════════════════════════════════════════════════════════
-- Email : kabrancharbel2@gmail.com
-- Mot de passe : Kouame2002$
-- 
-- INSTRUCTIONS :
-- 1. Aller dans Supabase Dashboard → Authentication → Users
-- 2. Cliquer sur kabrancharbel2@gmail.com
-- 3. Copier l'UUID
-- 4. Remplacer 'VOTRE_UUID_ICI' ci-dessous par l'UUID copié
-- 5. Exécuter ce script dans SQL Editor
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.users (
  id,
  email,
  username,
  full_name,
  city,
  country,
  role,
  is_verified,
  is_premium,
  referral_code,
  stats,
  bio,
  reputation,
  wallet_balance,
  sports,
  teams,
  followers,
  following,
  created_at,
  updated_at
) VALUES (
  '5262a708-285c-4478-881e-75d7451571ef',  -- UUID du compte kabrancharbel2@gmail.com
  'kabrancharbel2@gmail.com',
  'charbel_admin2',
  'Charbel Kabran',
  'Abidjan',
  'Côte d''Ivoire',
  'admin',
  true,
  true,
  'VSADMIN3',
  jsonb_build_object(
    'matchesPlayed', 0,
    'wins', 0,
    'losses', 0,
    'draws', 0,
    'goalsScored', 0,
    'assists', 0,
    'mvpCount', 0,
    'fairPlayScore', 5,
    'tournamentsWon', 0,
    'cashPrizesTotal', 0
  ),
  '',
  5.0,
  0.00,
  '[]'::jsonb,
  ARRAY[]::text[],
  0,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  role = EXCLUDED.role,
  is_verified = EXCLUDED.is_verified,
  is_premium = EXCLUDED.is_premium,
  updated_at = NOW();

-- ══════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ══════════════════════════════════════════════════════════════

-- Vérifier le profil créé
SELECT 
  id,
  email,
  username,
  role,
  is_verified,
  is_premium
FROM public.users
WHERE email = 'kabrancharbel2@gmail.com';

-- Vérifier que les IDs correspondent
SELECT 
  CASE 
    WHEN a.id = p.id THEN '✅ IDs synchronisés - Login OK'
    WHEN a.id IS NULL THEN '❌ Compte auth.users manquant'
    WHEN p.id IS NULL THEN '❌ Profil public.users manquant'
    ELSE '❌ IDs différents - Login échouera'
  END as status,
  a.id as auth_id,
  a.email as auth_email,
  a.email_confirmed_at IS NOT NULL as email_confirmed,
  p.id as public_id,
  p.email as public_email,
  p.role
FROM auth.users a
FULL OUTER JOIN public.users p ON a.id = p.id
WHERE a.email = 'kabrancharbel2@gmail.com' OR p.email = 'kabrancharbel2@gmail.com';
