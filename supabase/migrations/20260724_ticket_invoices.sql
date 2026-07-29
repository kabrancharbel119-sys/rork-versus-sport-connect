-- ============================================================
-- EXTENSION DU SYSTÈME DE FACTURES EXISTANT POUR LES BILLETS
-- Ajoute le context_type 'ticket_purchase' et un trigger automatique
-- ============================================================

-- 1. Étendre le CHECK constraint de context_type pour inclure 'ticket_purchase'
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_context_type_check;

ALTER TABLE public.invoices ADD CONSTRAINT invoices_context_type_check
  CHECK (context_type IN (
    'booking', 'tournament_registration', 'venue_advance',
    'logistics_advance', 'organizer_release', 'ticket_purchase'
  ));

-- 2. Changer context_id de UUID vers TEXT pour supporter les références de billets (TICKET-...)
ALTER TABLE public.invoices ALTER COLUMN context_id TYPE TEXT USING context_id::TEXT;
ALTER TABLE public.invoices ALTER COLUMN context_id DROP NOT NULL;

-- 3. Ajouter des colonnes utiles pour les factures de billets
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS event_id UUID;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS event_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payer_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payee_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Fonction: créer une facture automatiquement quand des billets sont confirmés
--    Appelée après confirm_ticket_payment ou via le webhook backend
CREATE OR REPLACE FUNCTION public.create_invoice_for_ticket_purchase(
  p_payment_transaction_id TEXT,
  p_provider_reference TEXT DEFAULT NULL
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_invoice_number TEXT;
  v_buyer_id UUID;
  v_buyer_name TEXT;
  v_organizer_id UUID;
  v_organizer_name TEXT;
  v_event_type TEXT;
  v_event_id UUID;
  v_event_name TEXT;
  v_total INTEGER;
  v_description TEXT;
  v_items_json JSONB;
  v_ticket_type_name TEXT;
  v_ticket_price INTEGER;
  v_ticket_qty INTEGER;
BEGIN
  -- Vérifier qu'une facture n'existe pas déjà
  SELECT * INTO v_invoice FROM public.invoices
  WHERE context_type = 'ticket_purchase' AND context_id::TEXT = p_payment_transaction_id
  LIMIT 1;

  IF FOUND THEN
    RETURN v_invoice;
  END IF;

  -- Récupérer les infos du paiement
  SELECT
    buyer_id,
    event_type,
    event_id,
    COALESCE(SUM(price_paid), 0) as total
  INTO v_buyer_id, v_event_type, v_event_id, v_total
  FROM public.tickets
  WHERE payment_transaction_id = p_payment_transaction_id
    AND status = 'valid'
  GROUP BY buyer_id, event_type, event_id
  LIMIT 1;

  IF v_buyer_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Nom de l'acheteur
  SELECT COALESCE(full_name, username, 'Utilisateur') INTO v_buyer_name
  FROM public.users WHERE id = v_buyer_id;

  -- Nom de l'événement et organisateur
  IF v_event_type = 'tournament' THEN
    SELECT name, created_by INTO v_event_name, v_organizer_id
    FROM public.tournaments WHERE id = v_event_id;
  ELSIF v_event_type = 'match' THEN
    SELECT name, created_by INTO v_event_name, v_organizer_id
    FROM public.matches WHERE id = v_event_id;
  END IF;

  -- Nom de l'organisateur
  IF v_organizer_id IS NOT NULL THEN
    SELECT COALESCE(full_name, username, 'Organisateur') INTO v_organizer_name
    FROM public.users WHERE id = v_organizer_id;
  END IF;

  -- Construire les lignes de la facture (items)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'description', sub.name,
      'quantity', sub.qty,
      'unit_price', sub.price,
      'total', sub.price * sub.qty
    )
  ), '[]'::jsonb) INTO v_items_json
  FROM (
    SELECT
      tt.name,
      tt.price,
      COUNT(*) as qty
    FROM public.tickets t
    JOIN public.ticket_types tt ON tt.id = t.ticket_type_id
    WHERE t.payment_transaction_id = p_payment_transaction_id
      AND t.status = 'valid'
    GROUP BY tt.name, tt.price
  ) sub;

  v_description := 'Achat de billets - ' || COALESCE(v_event_name, 'Événement');

  -- Générer le numéro de facture
  v_invoice_number := public.generate_invoice_number('INV');

  INSERT INTO public.invoices (
    invoice_number, document_type, context_type, context_id,
    amount, currency, payer_id, beneficiary_id, description,
    payment_method, payment_transaction_id, status, issued_at, paid_at,
    metadata, payer_name, payee_name, event_name, event_type, event_id, reason
  ) VALUES (
    v_invoice_number, 'invoice', 'ticket_purchase', p_payment_transaction_id,
    v_total, 'XOF', v_buyer_id, v_organizer_id, v_description,
    'geniuspay', COALESCE(p_provider_reference, p_payment_transaction_id), 'paid', NOW(), NOW(),
    jsonb_build_object(
      'items', v_items_json,
      'payment_reference', p_payment_transaction_id,
      'provider_reference', p_provider_reference
    ),
    v_buyer_name, v_organizer_name, v_event_name, v_event_type, v_event_id,
    'Achat de billets pour ' || COALESCE(v_event_name, 'Événement')
  )
  RETURNING * INTO v_invoice;

  RETURN v_invoice;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_invoice_for_ticket_purchase(TEXT, TEXT) TO authenticated;

-- 4. Mettre à jour confirm_ticket_payment pour créer aussi la facture
CREATE OR REPLACE FUNCTION public.confirm_ticket_payment(
  p_payment_transaction_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.tickets
  SET status = 'valid', paid_at = NOW()
  WHERE payment_transaction_id = p_payment_transaction_id
    AND status = 'pending_payment';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Créer la facture si des billets ont été confirmés
  IF v_count > 0 THEN
    PERFORM public.create_invoice_for_ticket_purchase(p_payment_transaction_id);
  END IF;

  RETURN v_count;
END;
$$;

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
