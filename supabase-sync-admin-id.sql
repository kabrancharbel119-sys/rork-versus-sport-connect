-- ══════════════════════════════════════════════════════════════
-- SYNCHRONISER L'ID DU COMPTE ADMIN
-- ══════════════════════════════════════════════════════════════
-- À exécuter APRÈS avoir créé le compte dans Supabase Auth Dashboard
-- 
-- Instructions :
-- 1. Créer le compte dans Dashboard → Authentication → Users
--    Email: kabrancharbel@gmail.com
--    Password: Kouame2002$
--    Auto Confirm: ✅
-- 
-- 2. Copier l'UUID du compte créé
-- 
-- 3. Remplacer 'VOTRE_UUID_ICI' ci-dessous par l'UUID copié
-- 
-- 4. Exécuter ce script
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- UUID du compte Supabase Auth créé pour kabrancharbel@gmail.com
  new_auth_id uuid := 'f6bd9245-a4ec-4e0b-a37d-4a1bb88a6055';
  old_user_id uuid;
  old_username text;
BEGIN

  -- Trouver l'ancien compte admin dans public.users
  SELECT id, username INTO old_user_id, old_username
  FROM public.users
  WHERE phone = '+14385089540' OR username = 'charbel_kabran'
  ORDER BY created_at ASC
  LIMIT 1;

  IF old_user_id IS NULL THEN
    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE 'ATTENTION : Ancien compte admin introuvable !';
    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE 'Création d''un nouveau profil admin...';
    
    -- Créer un nouveau profil admin
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
      created_at,
      updated_at
    ) VALUES (
      new_auth_id,
      'kabrancharbel@gmail.com',
      'charbel_kabran',
      'Charbel Kabran',
      '+14385089540',
      'Abidjan',
      'Côte d''Ivoire',
      'admin',
      true,
      true,
      'VSADMIN',
      jsonb_build_object(
        'matchesPlayed', 0,
        'wins', 0,
        'losses', 0,
        'draws', 0,
        'goalsScored', 0,
        'assists', 0,
        'mvpCount', 0,
        'fairPlayScore', 0,
        'tournamentsWon', 0,
        'cashPrizesTotal', 0
      ),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      is_verified = EXCLUDED.is_verified,
      is_premium = EXCLUDED.is_premium,
      updated_at = NOW();

    RAISE NOTICE 'Nouveau profil admin créé avec succès !';
  ELSE
    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE 'Ancien compte admin trouvé';
    RAISE NOTICE 'ID actuel : %', old_user_id;
    RAISE NOTICE 'Username : %', old_username;
    RAISE NOTICE '════════════════════════════════════════════════════════════';

    -- Vérifier si le nouvel ID existe déjà
    IF EXISTS (SELECT 1 FROM public.users WHERE id = new_auth_id) THEN
      RAISE NOTICE 'Le nouvel UUID existe déjà dans public.users';
      RAISE NOTICE 'Mise à jour du profil existant...';
      
      UPDATE public.users
      SET 
        email = 'kabrancharbel@gmail.com',
        username = COALESCE(username, old_username),
        phone = '+14385089540',
        role = 'admin',
        is_verified = true,
        is_premium = true,
        updated_at = NOW()
      WHERE id = new_auth_id;
      
      -- Supprimer l'ancien profil si différent
      IF old_user_id != new_auth_id THEN
        DELETE FROM public.users WHERE id = old_user_id;
        RAISE NOTICE 'Ancien profil supprimé : %', old_user_id;
      END IF;
    ELSE
      -- Mettre à jour l'ID de l'ancien profil
      UPDATE public.users
      SET 
        id = new_auth_id,
        email = 'kabrancharbel@gmail.com',
        role = 'admin',
        is_verified = true,
        is_premium = true,
        updated_at = NOW()
      WHERE id = old_user_id;

      RAISE NOTICE 'ID du profil mis à jour : % → %', old_user_id, new_auth_id;
    END IF;
  END IF;

  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ SYNCHRONISATION TERMINÉE !';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Vous pouvez maintenant vous connecter avec :';
  RAISE NOTICE 'Email : kabrancharbel@gmail.com';
  RAISE NOTICE 'Mot de passe : Kouame2002$';
  RAISE NOTICE '════════════════════════════════════════════════════════════';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE '❌ ERREUR : %', SQLERRM;
    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE;
END $$;

-- ══════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ══════════════════════════════════════════════════════════════

-- Vérifier le profil dans public.users
SELECT 
  id,
  email,
  username,
  phone,
  role,
  is_verified,
  is_premium,
  created_at
FROM public.users
WHERE email = 'kabrancharbel@gmail.com' OR phone = '+14385089540';

-- Vérifier le compte dans auth.users
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'kabrancharbel@gmail.com';

-- Vérifier que les IDs correspondent
SELECT 
  CASE 
    WHEN u.id = a.id THEN '✅ IDs synchronisés'
    ELSE '❌ IDs différents : public.users=' || u.id || ' / auth.users=' || a.id
  END as status
FROM public.users u
CROSS JOIN auth.users a
WHERE u.email = 'kabrancharbel@gmail.com' 
  AND a.email = 'kabrancharbel@gmail.com';
