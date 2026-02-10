
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS csv_verified boolean DEFAULT false;
