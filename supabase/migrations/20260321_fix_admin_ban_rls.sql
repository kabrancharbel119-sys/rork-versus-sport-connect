-- Fix RLS: restore original permissive policies
-- Auth is handled at the app level, not through Supabase RLS

-- Clean up restrictive policies added by mistake
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "admins_update_any_user" ON public.users;
DROP POLICY IF EXISTS "admins_select_all_users" ON public.users;

-- Restore original permissive policies
DROP POLICY IF EXISTS "Users can be updated" ON public.users;
CREATE POLICY "Users can be updated" ON public.users FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users are viewable by everyone" ON public.users;
CREATE POLICY "Users are viewable by everyone" ON public.users FOR SELECT USING (true);
