-- ══════════════════════════════════════════════════════════════
-- CRÉER UN NOUVEAU COMPTE ADMIN
-- ══════════════════════════════════════════════════════════════
-- Email : kabrancharbel1@gmail.com
-- Mot de passe : Kouame2002$
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  new_admin_id uuid := gen_random_uuid();
BEGIN
  -- 1. Créer le compte dans auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    new_admin_id,
    '00000000-0000-0000-0000-000000000000',
    'kabrancharbel1@gmail.com',
    crypt('Kouame2002$', gen_salt('bf')),
    NOW(),
    jsonb_build_object(
      'email', 'kabrancharbel1@gmail.com',
      'username', 'charbel_admin'
    ),
    'authenticated',
    'authenticated',
    NOW(),
    NOW(),
    '',
    ''
  );

  -- 2. Créer l'identité email
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_admin_id,
    jsonb_build_object(
      'sub', new_admin_id::text,
      'email', 'kabrancharbel1@gmail.com',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    'kabrancharbel1@gmail.com',
    NOW(),
    NOW(),
    NOW()
  );

  -- 3. Créer le profil dans public.users
  INSERT INTO public.users (
    id,
    email,
    username,
    full_name,
    phone,
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
    created_at,
    updated_at
  ) VALUES (
    new_admin_id,
    'kabrancharbel1@gmail.com',
    'charbel_admin',
    'Charbel Kabran',
    NULL,
    'Abidjan',
    'Côte d''Ivoire',
    'admin',
    true,
    true,
    'VSADMIN2',
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
    NOW(),
    NOW()
  );

  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ NOUVEAU COMPTE ADMIN CRÉÉ !';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'ID : %', new_admin_id;
  RAISE NOTICE 'Email : kabrancharbel1@gmail.com';
  RAISE NOTICE 'Mot de passe : Kouame2002$';
  RAISE NOTICE 'Username : charbel_admin';
  RAISE NOTICE '════════════════════════════════════════════════════════════';

END $$;

-- ══════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ══════════════════════════════════════════════════════════════

-- Vérifier le compte dans auth.users
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'kabrancharbel1@gmail.com';

-- Vérifier le profil dans public.users
SELECT 
  id,
  email,
  username,
  role,
  is_verified,
  is_premium,
  created_at
FROM public.users
WHERE email = 'kabrancharbel1@gmail.com';

-- Vérifier que les IDs correspondent
SELECT 
  CASE 
    WHEN a.id = p.id THEN '✅ IDs synchronisés'
    ELSE '❌ IDs différents'
  END as status,
  a.id as auth_id,
  p.id as public_id
FROM auth.users a
CROSS JOIN public.users p
WHERE a.email = 'kabrancharbel1@gmail.com' 
  AND p.email = 'kabrancharbel1@gmail.com';
