-- =============================================================
-- Seed : 5 factures d'exemple pour le gestionnaire konan@gmail.com
-- =============================================================

DO $$
DECLARE
  konan_id UUID;
  sample_stats JSONB := jsonb_build_object(
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
  );
  user_cols TEXT[];
  insert_cols TEXT;
  insert_vals TEXT;
BEGIN
  -- 1. Chercher l'utilisateur dans public.users
  SELECT id INTO konan_id FROM users WHERE email = 'konan@gmail.com';

  -- 2. Sinon, chercher dans auth.users
  IF konan_id IS NULL THEN
    SELECT id INTO konan_id FROM auth.users WHERE email = 'konan@gmail.com';
  END IF;

  -- 3. Sinon, générer un UUID
  IF konan_id IS NULL THEN
    konan_id := gen_random_uuid();
  END IF;

  -- 4. S'assurer que public.users a bien ce compte
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = konan_id) THEN
    -- On construit l'INSERT uniquement avec les colonnes existantes
    SELECT array_agg(column_name)
    INTO user_cols
    FROM information_schema.columns
    WHERE table_name = 'users' AND table_schema = 'public';

    insert_cols := 'id, email';
    insert_vals := format('''%s'', ''konan@gmail.com''', konan_id);

    IF 'username' = ANY(user_cols) THEN
      insert_cols := insert_cols || ', username';
      insert_vals := insert_vals || ', ''konan_manager'''; 
    END IF;
    IF 'full_name' = ANY(user_cols) THEN
      insert_cols := insert_cols || ', full_name';
      insert_vals := insert_vals || ', ''Konan Gestionnaire''';
    END IF;
    IF 'role' = ANY(user_cols) THEN
      insert_cols := insert_cols || ', role';
      insert_vals := insert_vals || ', ''venue_manager''';
    END IF;
    IF 'stats' = ANY(user_cols) THEN
      insert_cols := insert_cols || ', stats';
      insert_vals := insert_vals || ', ''' || sample_stats::text || '''::jsonb';
    END IF;
    IF 'sports' = ANY(user_cols) THEN
      insert_cols := insert_cols || ', sports';
      insert_vals := insert_vals || ', ''[]''::jsonb';
    END IF;
    IF 'teams' = ANY(user_cols) THEN
      insert_cols := insert_cols || ', teams';
      insert_vals := insert_vals || ', ''[]''::jsonb';
    END IF;
    IF 'reputation' = ANY(user_cols) THEN
      insert_cols := insert_cols || ', reputation';
      insert_vals := insert_vals || ', 0';
    END IF;
    IF 'wallet_balance' = ANY(user_cols) THEN
      insert_cols := insert_cols || ', wallet_balance';
      insert_vals := insert_vals || ', 0';
    END IF;
    IF 'is_verified' = ANY(user_cols) THEN
      insert_cols := insert_cols || ', is_verified';
      insert_vals := insert_vals || ', false';
    END IF;
    IF 'is_premium' = ANY(user_cols) THEN
      insert_cols := insert_cols || ', is_premium';
      insert_vals := insert_vals || ', false';
    END IF;
    IF 'is_profile_visible' = ANY(user_cols) THEN
      insert_cols := insert_cols || ', is_profile_visible';
      insert_vals := insert_vals || ', true';
    END IF;
    IF 'can_create_ranked_matches' = ANY(user_cols) THEN
      insert_cols := insert_cols || ', can_create_ranked_matches';
      insert_vals := insert_vals || ', false';
    END IF;
    IF 'bio' = ANY(user_cols) THEN
      insert_cols := insert_cols || ', bio';
      insert_vals := insert_vals || ', ''''';
    END IF;
    IF 'availability' = ANY(user_cols) THEN
      insert_cols := insert_cols || ', availability';
      insert_vals := insert_vals || ', ''[]''::jsonb';
    END IF;
    IF 'member_since' = ANY(user_cols) THEN
      insert_cols := insert_cols || ', member_since';
      insert_vals := insert_vals || ', NOW()';
    END IF;
    IF 'created_at' = ANY(user_cols) THEN
      insert_cols := insert_cols || ', created_at';
      insert_vals := insert_vals || ', NOW()';
    END IF;

    -- Exécuter l'INSERT dynamique
    EXECUTE format(
      'INSERT INTO public.users (%s) VALUES (%s) ON CONFLICT (id) DO NOTHING',
      insert_cols, insert_vals
    );
  END IF;

  -- 5. Insérer 5 factures d'exemple
  INSERT INTO invoices (invoice_number, document_type, context_type, context_id, amount, currency, payer_id, beneficiary_id, description, payment_method, payment_transaction_id, status, issued_at, paid_at, metadata)
  VALUES
    (generate_invoice_number('INV'), 'invoice', 'booking', gen_random_uuid(), 15000, 'XOF', konan_id, konan_id, 'Réservation Stade Municipal Konan - 11 juillet 2026', 'in_app', 'TXN-' || gen_random_uuid()::text, 'paid', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', jsonb_build_object('venue_name', 'Stade Municipal Konan', 'booking_id', gen_random_uuid())),
    (generate_invoice_number('INV'), 'invoice', 'booking', gen_random_uuid(), 22000, 'XOF', konan_id, konan_id, 'Réservation Complexe Alpha - 12 juillet 2026', 'in_app', 'TXN-' || gen_random_uuid()::text, 'paid', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', jsonb_build_object('venue_name', 'Complexe Alpha', 'booking_id', gen_random_uuid())),
    (generate_invoice_number('INV'), 'invoice', 'booking', gen_random_uuid(), 18000, 'XOF', konan_id, konan_id, 'Réservation Terrain C - 13 juillet 2026', 'in_app', 'TXN-' || gen_random_uuid()::text, 'paid', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', jsonb_build_object('venue_name', 'Terrain C', 'booking_id', gen_random_uuid())),
    (generate_invoice_number('INV'), 'invoice', 'booking', gen_random_uuid(), 30000, 'XOF', konan_id, konan_id, 'Réservation Gymnase Elite - 14 juillet 2026', 'in_app', 'TXN-' || gen_random_uuid()::text, 'issued', NOW() - INTERVAL '2 days', NULL, jsonb_build_object('venue_name', 'Gymnase Elite', 'booking_id', gen_random_uuid())),
    (generate_invoice_number('INV'), 'invoice', 'booking', gen_random_uuid(), 12000, 'XOF', konan_id, konan_id, 'Réservation Mini-Terrain Beach - 15 juillet 2026', 'in_app', 'TXN-' || gen_random_uuid()::text, 'paid', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', jsonb_build_object('venue_name', 'Mini-Terrain Beach', 'booking_id', gen_random_uuid()));

END $$;
