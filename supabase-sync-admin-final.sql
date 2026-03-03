-- ══════════════════════════════════════════════════════════════
-- SYNCHRONISER LE COMPTE ADMIN (Version Finale - Sans Changer l'ID)
-- ══════════════════════════════════════════════════════════════
-- Solution : Copier les données de l'ancien profil vers le nouveau
-- UUID Supabase Auth : f6bd9245-a4ec-4e0b-a37d-4a1bb88a6055
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- UUID du compte Supabase Auth créé pour kabrancharbel@gmail.com
  new_auth_id uuid := 'f6bd9245-a4ec-4e0b-a37d-4a1bb88a6055';
  old_user_id uuid;
  old_user_record RECORD;
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'SYNCHRONISATION DU COMPTE ADMIN';
  RAISE NOTICE '════════════════════════════════════════════════════════════';

  -- Trouver l'ancien compte admin
  SELECT * INTO old_user_record
  FROM public.users
  WHERE phone = '+14385089540' OR username = 'charbel_kabran'
  ORDER BY created_at ASC
  LIMIT 1;

  IF old_user_record.id IS NULL THEN
    RAISE NOTICE 'Aucun ancien compte trouvé. Création d''un nouveau profil admin...';
    
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
      bio,
      avatar,
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
      '',
      NULL,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      username = EXCLUDED.username,
      role = EXCLUDED.role,
      is_verified = EXCLUDED.is_verified,
      is_premium = EXCLUDED.is_premium,
      phone = EXCLUDED.phone,
      updated_at = NOW();

    RAISE NOTICE '✅ Nouveau profil admin créé';
  ELSE
    old_user_id := old_user_record.id;
    RAISE NOTICE 'Ancien compte trouvé : %', old_user_id;
    RAISE NOTICE 'Username : %', old_user_record.username;

    -- Vérifier si le nouveau profil existe déjà
    IF EXISTS (SELECT 1 FROM public.users WHERE id = new_auth_id) THEN
      RAISE NOTICE 'Le profil avec le nouvel UUID existe déjà';
      
      -- Mettre à jour le profil existant avec les données de l'ancien
      UPDATE public.users
      SET 
        email = 'kabrancharbel@gmail.com',
        username = COALESCE(old_user_record.username, username),
        full_name = COALESCE(old_user_record.full_name, full_name),
        phone = COALESCE(old_user_record.phone, phone),
        city = COALESCE(old_user_record.city, city),
        country = COALESCE(old_user_record.country, country),
        bio = COALESCE(old_user_record.bio, bio),
        avatar = COALESCE(old_user_record.avatar, avatar),
        role = 'admin',
        is_verified = true,
        is_premium = true,
        referral_code = COALESCE(old_user_record.referral_code, referral_code),
        stats = COALESCE(old_user_record.stats, stats),
        reputation = COALESCE(old_user_record.reputation, reputation),
        wallet_balance = COALESCE(old_user_record.wallet_balance, wallet_balance),
        teams = COALESCE(old_user_record.teams, teams),
        followers = COALESCE(old_user_record.followers, followers),
        following = COALESCE(old_user_record.following, following),
        sports = COALESCE(old_user_record.sports, sports),
        updated_at = NOW()
      WHERE id = new_auth_id;

      RAISE NOTICE '✅ Profil mis à jour avec les données de l''ancien compte';
      
      -- Si les IDs sont différents, supprimer l'ancien profil
      IF old_user_id != new_auth_id THEN
        RAISE NOTICE 'Suppression de l''ancien profil : %', old_user_id;
        
        -- Mettre à jour les références avant de supprimer
        -- Matches créés par l'admin
        UPDATE matches SET created_by = new_auth_id WHERE created_by = old_user_id;
        RAISE NOTICE '  → Matches mis à jour';
        
        -- Tournois créés par l'admin
        UPDATE tournaments SET created_by = new_auth_id WHERE created_by = old_user_id;
        RAISE NOTICE '  → Tournois mis à jour';
        
        -- Notifications
        UPDATE notifications SET user_id = new_auth_id WHERE user_id = old_user_id;
        RAISE NOTICE '  → Notifications mises à jour';
        
        -- Messages de chat
        UPDATE chat_messages SET sender_id = new_auth_id WHERE sender_id = old_user_id;
        RAISE NOTICE '  → Messages de chat mis à jour';
        
        -- Supprimer l'ancien profil
        DELETE FROM public.users WHERE id = old_user_id;
        RAISE NOTICE '✅ Ancien profil supprimé';
      END IF;
    ELSE
      -- Créer un nouveau profil avec les données de l'ancien
      INSERT INTO public.users (
        id,
        email,
        username,
        full_name,
        phone,
        city,
        country,
        bio,
        avatar,
        role,
        is_verified,
        is_premium,
        referral_code,
        stats,
        reputation,
        wallet_balance,
        teams,
        followers,
        following,
        sports,
        created_at,
        updated_at
      ) VALUES (
        new_auth_id,
        'kabrancharbel@gmail.com',
        old_user_record.username,
        old_user_record.full_name,
        old_user_record.phone,
        old_user_record.city,
        old_user_record.country,
        old_user_record.bio,
        old_user_record.avatar,
        'admin',
        true,
        true,
        old_user_record.referral_code,
        old_user_record.stats,
        old_user_record.reputation,
        old_user_record.wallet_balance,
        old_user_record.teams,
        old_user_record.followers,
        old_user_record.following,
        old_user_record.sports,
        old_user_record.created_at,
        NOW()
      );

      RAISE NOTICE '✅ Nouveau profil créé avec les données de l''ancien';
      
      -- Mettre à jour toutes les références
      RAISE NOTICE 'Migration des données référencées...';
      
      UPDATE matches SET created_by = new_auth_id WHERE created_by = old_user_id;
      RAISE NOTICE '  → Matches mis à jour';
      
      UPDATE tournaments SET created_by = new_auth_id WHERE created_by = old_user_id;
      RAISE NOTICE '  → Tournois mis à jour';
      
      UPDATE notifications SET user_id = new_auth_id WHERE user_id = old_user_id;
      RAISE NOTICE '  → Notifications mises à jour';
      
      UPDATE chat_messages SET sender_id = new_auth_id WHERE sender_id = old_user_id;
      RAISE NOTICE '  → Messages de chat mis à jour';
      
      -- Supprimer l'ancien profil
      DELETE FROM public.users WHERE id = old_user_id;
      RAISE NOTICE '✅ Ancien profil supprimé';
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

-- Vérifier le profil final
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
WHERE email = 'kabrancharbel@gmail.com';

-- Vérifier que les IDs correspondent
SELECT 
  'public.users' as table_name,
  id,
  email,
  username
FROM public.users
WHERE email = 'kabrancharbel@gmail.com'
UNION ALL
SELECT 
  'auth.users' as table_name,
  id,
  email,
  NULL as username
FROM auth.users
WHERE email = 'kabrancharbel@gmail.com';
