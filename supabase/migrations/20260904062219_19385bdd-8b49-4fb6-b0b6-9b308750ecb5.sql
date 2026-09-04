ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS uber_auth_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS uber_auth_error text;