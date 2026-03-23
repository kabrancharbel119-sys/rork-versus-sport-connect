ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS banned_until timestamptz,
  ADD COLUMN IF NOT EXISTS ban_reason text;

CREATE INDEX IF NOT EXISTS users_banned_until_idx ON public.users (banned_until);
