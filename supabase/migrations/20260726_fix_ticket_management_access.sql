-- ============================================================
-- Fix ticket management access control
-- Only the event creator (or tournament managers) can manage tickets
-- Admins can monitor (read) but cannot create/update/delete
-- Uses ALTER POLICY to safely modify existing policies (no drops)
-- ============================================================

-- 1. Restrict UPDATE to creator only (remove admin/manager access)
ALTER POLICY "ticket_types_update_own" ON public.ticket_types
  USING (
    created_by = auth.uid()
  );

-- 2. Restrict DELETE to creator only, and only if no tickets sold
ALTER POLICY "ticket_types_delete_own" ON public.ticket_types
  USING (
    created_by = auth.uid() AND quantity_sold = 0
  );

-- 3. Fix tickets SELECT: buyer, creator, tournament managers, or admin (read-only)
ALTER POLICY "tickets_select_own_or_organizer" ON public.tickets
  USING (
    buyer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.ticket_types tt
      WHERE tt.id = tickets.ticket_type_id AND tt.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.ticket_types tt
      JOIN public.tournaments t ON t.id = tt.event_id AND tt.event_type = 'tournament'
      WHERE tt.id = tickets.ticket_type_id
        AND t.managers IS NOT NULL
        AND auth.uid()::text = ANY (SELECT * FROM jsonb_array_elements_text(t.managers))
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';
