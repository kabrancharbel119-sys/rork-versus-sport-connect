-- ══════════════════════════════════════════════════════════════
-- MISE À JOUR DU COMPTE ADMIN : Téléphone → Email
-- ══════════════════════════════════════════════════════════════
-- Objectif : Permettre la connexion avec email au lieu du téléphone
-- Ancien : +14385089540 / Kouame2002$
-- Nouveau : kabrancharbel@gmail.com / Kouame2002$
-- ══════════════════════════════════════════════════════════════

-- ÉTAPE 1 : Trouver l'ID du compte admin existant
DO $$
DECLARE
  admin_user_id uuid;
  admin_auth_id uuid;
BEGIN
  -- Chercher le user dans la table public.users par téléphone
  SELECT id INTO admin_user_id
  FROM public.users
  WHERE phone = '+14385089540'
  LIMIT 1;

  IF admin_user_id IS NULL THEN
    RAISE NOTICE 'Aucun utilisateur trouvé avec le téléphone +14385089540';
    RAISE NOTICE 'Recherche par username charbel_kabran...';
    
    SELECT id INTO admin_user_id
    FROM public.users
    WHERE username = 'charbel_kabran'
    LIMIT 1;
  END IF;

  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Compte admin introuvable. Vérifiez que le compte existe.';
  END IF;

  RAISE NOTICE 'Compte admin trouvé : %', admin_user_id;

  -- ÉTAPE 2 : Mettre à jour l'email dans public.users
  UPDATE public.users
  SET 
    email = 'kabrancharbel@gmail.com',
    updated_at = NOW()
  WHERE id = admin_user_id;

  RAISE NOTICE 'Email mis à jour dans public.users';

  -- ÉTAPE 3 : Vérifier si le compte existe dans auth.users
  SELECT id INTO admin_auth_id
  FROM auth.users
  WHERE id = admin_user_id;

  IF admin_auth_id IS NOT NULL THEN
    -- Le compte existe dans auth.users, on met à jour l'email
    UPDATE auth.users
    SET 
      email = 'kabrancharbel@gmail.com',
      raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{email}',
        '"kabrancharbel@gmail.com"'
      ),
      email_confirmed_at = NOW(),
      updated_at = NOW()
    WHERE id = admin_user_id;

    RAISE NOTICE 'Email mis à jour dans auth.users';
  ELSE
    -- Le compte n'existe pas dans auth.users, on le crée
    RAISE NOTICE 'Création du compte dans auth.users...';
    
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
      updated_at
    ) VALUES (
      admin_user_id,
      '00000000-0000-0000-0000-000000000000',
      'kabrancharbel@gmail.com',
      -- Hash bcrypt du mot de passe "Kouame2002$"
      -- Vous devrez peut-être le régénérer via Supabase Dashboard
      crypt('Kouame2002$', gen_salt('bf')),
      NOW(),
      jsonb_build_object(
        'email', 'kabrancharbel@gmail.com',
        'phone', '+14385089540',
        'username', 'charbel_kabran'
      ),
      'authenticated',
      'authenticated',
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Compte créé dans auth.users';
  END IF;

  -- ÉTAPE 4 : Créer une identité email si elle n'existe pas
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    admin_user_id,
    jsonb_build_object(
      'sub', admin_user_id::text,
      'email', 'kabrancharbel@gmail.com'
    ),
    'email',
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (provider, user_id) DO UPDATE
  SET 
    identity_data = jsonb_build_object(
      'sub', admin_user_id::text,
      'email', 'kabrancharbel@gmail.com'
    ),
    updated_at = NOW();

  RAISE NOTICE 'Identité email créée/mise à jour';

  -- ÉTAPE 5 : Afficher les informations du compte
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'MISE À JOUR TERMINÉE !';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Vous pouvez maintenant vous connecter avec :';
  RAISE NOTICE 'Email : kabrancharbel@gmail.com';
  RAISE NOTICE 'Mot de passe : Kouame2002$';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';

END $$;

-- ══════════════════════════════════════════════════════════════
-- VÉRIFICATION POST-MIGRATION
-- ══════════════════════════════════════════════════════════════

-- Vérifier le compte dans public.users
SELECT 
  id,
  email,
  username,
  phone,
  role,
  is_verified,
  is_premium
FROM public.users
WHERE email = 'kabrancharbel@gmail.com' OR phone = '+14385089540';

-- Vérifier le compte dans auth.users
SELECT 
  id,
  email,
  email_confirmed_at,
  role,
  aud
FROM auth.users
WHERE email = 'kabrancharbel@gmail.com';

-- Vérifier les identités
SELECT 
  provider,
  identity_data->>'email' as email,
  created_at
FROM auth.identities
WHERE user_id IN (
  SELECT id FROM public.users WHERE email = 'kabrancharbel@gmail.com'
);
