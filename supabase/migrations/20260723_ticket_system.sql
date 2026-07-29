-- ============================================================
-- SYSTÈME DE BILLETTERIE COMPLET
-- Vente de tickets pour matchs et tournois
-- ============================================================

-- ============================================================
-- TABLE: ticket_types (catégories de billets créées par l'organisateur)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('match', 'tournament')),
  event_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  quantity_total INTEGER NOT NULL CHECK (quantity_total > 0),
  quantity_sold INTEGER NOT NULL DEFAULT 0 CHECK (quantity_sold >= 0),
  sales_start TIMESTAMPTZ,
  sales_end TIMESTAMPTZ,
  max_per_user INTEGER NOT NULL DEFAULT 10 CHECK (max_per_user > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quantity_sold_lte_total CHECK (quantity_sold <= quantity_total)
);

CREATE INDEX IF NOT EXISTS idx_ticket_types_event ON public.ticket_types(event_type, event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_creator ON public.ticket_types(created_by);

-- ============================================================
-- TABLE: tickets (billets achetés)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_type_id UUID NOT NULL REFERENCES public.ticket_types(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('match', 'tournament')),
  event_id UUID NOT NULL,
  buyer_id UUID NOT NULL REFERENCES public.users(id),
  holder_name TEXT,
  price_paid INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'valid', 'used', 'cancelled', 'refunded')),
  ticket_code TEXT NOT NULL UNIQUE,
  qr_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  payment_transaction_id TEXT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  validated_by UUID REFERENCES public.users(id),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_buyer ON public.tickets(buyer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON public.tickets(event_type, event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_type ON public.tickets(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr_token ON public.tickets(qr_token);
CREATE INDEX IF NOT EXISTS idx_tickets_code ON public.tickets(ticket_code);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- ticket_types: lisible par tous, gérable par le créateur
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ticket_types' AND policyname = 'ticket_types_select_all') THEN
    CREATE POLICY "ticket_types_select_all" ON public.ticket_types FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ticket_types' AND policyname = 'ticket_types_insert_own') THEN
    CREATE POLICY "ticket_types_insert_own" ON public.ticket_types FOR INSERT TO authenticated
      WITH CHECK (created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ticket_types' AND policyname = 'ticket_types_update_own') THEN
    CREATE POLICY "ticket_types_update_own" ON public.ticket_types FOR UPDATE TO authenticated
      USING (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ticket_types' AND policyname = 'ticket_types_delete_own') THEN
    CREATE POLICY "ticket_types_delete_own" ON public.ticket_types FOR DELETE TO authenticated
      USING (
        (created_by = auth.uid() AND quantity_sold = 0)
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
      );
  END IF;

  -- tickets: visible par l'acheteur, l'organisateur du type de billet, et les admins
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tickets' AND policyname = 'tickets_select_own_or_organizer') THEN
    CREATE POLICY "tickets_select_own_or_organizer" ON public.tickets FOR SELECT TO authenticated
      USING (
        buyer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.ticket_types tt
          WHERE tt.id = tickets.ticket_type_id AND tt.created_by = auth.uid()
        )
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
      );
  END IF;
END $$;

-- ============================================================
-- RPC: purchase_tickets — achat atomique (SECURITY DEFINER)
-- Décrémente le stock, génère les billets avec codes uniques
-- ============================================================
CREATE OR REPLACE FUNCTION public.purchase_tickets(
  p_ticket_type_id UUID,
  p_buyer_id UUID,
  p_quantity INTEGER,
  p_initial_status TEXT DEFAULT 'valid',
  p_payment_transaction_id TEXT DEFAULT NULL
)
RETURNS SETOF public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type public.ticket_types%ROWTYPE;
  v_already_bought INTEGER;
  v_i INTEGER;
  v_code TEXT;
  v_ticket public.tickets%ROWTYPE;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;
  IF p_initial_status NOT IN ('pending_payment', 'valid') THEN
    RAISE EXCEPTION 'Statut initial invalide';
  END IF;

  -- Verrouiller la ligne du type de billet (évite la survente en concurrence)
  SELECT * INTO v_type FROM public.ticket_types
  WHERE id = p_ticket_type_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Type de billet introuvable';
  END IF;
  IF NOT v_type.is_active THEN
    RAISE EXCEPTION 'La vente de ce billet est fermée';
  END IF;
  IF v_type.sales_start IS NOT NULL AND NOW() < v_type.sales_start THEN
    RAISE EXCEPTION 'La vente n''a pas encore commencé';
  END IF;
  IF v_type.sales_end IS NOT NULL AND NOW() > v_type.sales_end THEN
    RAISE EXCEPTION 'La vente est terminée';
  END IF;
  IF v_type.quantity_sold + p_quantity > v_type.quantity_total THEN
    RAISE EXCEPTION 'Stock insuffisant: % billet(s) restant(s)', v_type.quantity_total - v_type.quantity_sold;
  END IF;

  -- Limite par utilisateur (billets non annulés)
  SELECT COUNT(*) INTO v_already_bought FROM public.tickets
  WHERE ticket_type_id = p_ticket_type_id
    AND buyer_id = p_buyer_id
    AND status NOT IN ('cancelled', 'refunded');
  IF v_already_bought + p_quantity > v_type.max_per_user THEN
    RAISE EXCEPTION 'Limite de % billet(s) par personne atteinte', v_type.max_per_user;
  END IF;

  -- Décrémenter le stock
  UPDATE public.ticket_types
  SET quantity_sold = quantity_sold + p_quantity, updated_at = NOW()
  WHERE id = p_ticket_type_id;

  -- Générer les billets
  FOR v_i IN 1..p_quantity LOOP
    v_code := 'VS-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));
    INSERT INTO public.tickets (
      ticket_type_id, event_type, event_id, buyer_id, price_paid,
      status, ticket_code, payment_transaction_id,
      paid_at
    ) VALUES (
      p_ticket_type_id, v_type.event_type, v_type.event_id, p_buyer_id, v_type.price,
      p_initial_status, v_code, p_payment_transaction_id,
      CASE WHEN p_initial_status = 'valid' THEN NOW() ELSE NULL END
    )
    RETURNING * INTO v_ticket;
    RETURN NEXT v_ticket;
  END LOOP;
  RETURN;
END;
$$;

-- ============================================================
-- RPC: confirm_ticket_payment — confirmer les billets après paiement
-- (appelé par le webhook backend ou le polling client)
-- ============================================================
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
  RETURN v_count;
END;
$$;

-- ============================================================
-- RPC: cancel_pending_tickets — annuler les billets non payés
-- (échec de paiement) et restituer le stock
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_pending_tickets(
  p_payment_transaction_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_type_id UUID;
BEGIN
  v_count := 0;
  FOR v_type_id IN
    SELECT ticket_type_id FROM public.tickets
    WHERE payment_transaction_id = p_payment_transaction_id AND status = 'pending_payment'
  LOOP
    UPDATE public.ticket_types
    SET quantity_sold = GREATEST(quantity_sold - 1, 0), updated_at = NOW()
    WHERE id = v_type_id;
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.tickets
  SET status = 'cancelled', cancelled_at = NOW()
  WHERE payment_transaction_id = p_payment_transaction_id AND status = 'pending_payment';

  RETURN v_count;
END;
$$;

-- ============================================================
-- RPC: validate_ticket — scan à l'entrée (organisateur)
-- Marque le billet comme utilisé. Retourne les infos du billet.
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_ticket(
  p_qr_token UUID,
  p_validator_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_type public.ticket_types%ROWTYPE;
  v_is_authorized BOOLEAN;
  v_buyer_name TEXT;
BEGIN
  SELECT * INTO v_ticket FROM public.tickets WHERE qr_token = p_qr_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Billet introuvable');
  END IF;

  SELECT * INTO v_type FROM public.ticket_types WHERE id = v_ticket.ticket_type_id;

  -- Seul l'organisateur (créateur des billets) ou un admin peut valider
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_validator_id AND (id = v_type.created_by OR role IN ('admin', 'manager'))
  ) INTO v_is_authorized;
  IF NOT v_is_authorized THEN
    RETURN json_build_object('success', false, 'error', 'Non autorisé à valider ce billet');
  END IF;

  IF v_ticket.status = 'used' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Billet déjà utilisé le ' || TO_CHAR(v_ticket.used_at, 'DD/MM/YYYY à HH24:MI'),
      'ticket_code', v_ticket.ticket_code
    );
  END IF;
  IF v_ticket.status != 'valid' THEN
    RETURN json_build_object('success', false, 'error', 'Billet non valide (statut: ' || v_ticket.status || ')');
  END IF;

  UPDATE public.tickets
  SET status = 'used', used_at = NOW(), validated_by = p_validator_id
  WHERE id = v_ticket.id;

  SELECT COALESCE(full_name, username, 'Inconnu') INTO v_buyer_name
  FROM public.users WHERE id = v_ticket.buyer_id;

  RETURN json_build_object(
    'success', true,
    'ticket_code', v_ticket.ticket_code,
    'ticket_type_name', v_type.name,
    'buyer_name', v_buyer_name,
    'price_paid', v_ticket.price_paid
  );
END;
$$;

-- Permissions d'exécution des RPC
GRANT EXECUTE ON FUNCTION public.purchase_tickets(UUID, UUID, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_ticket_payment(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pending_tickets(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_ticket(UUID, UUID) TO authenticated;
