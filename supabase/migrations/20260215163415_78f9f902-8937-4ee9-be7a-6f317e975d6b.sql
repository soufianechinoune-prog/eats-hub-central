
-- Create payout_adjustments table
CREATE TABLE public.payout_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid REFERENCES public.restaurants(id),
  uber_store_id text NOT NULL,
  restaurant_name text,
  payout_reference_id text NOT NULL,
  payout_date date,
  description text,
  category text NOT NULL DEFAULT 'other_fee',
  amount numeric NOT NULL DEFAULT 0,
  raw_columns jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint for deduplication
ALTER TABLE public.payout_adjustments
  ADD CONSTRAINT payout_adjustments_unique_key UNIQUE (payout_reference_id, description, uber_store_id);

-- Enable RLS
ALTER TABLE public.payout_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as orders - allow all for authenticated users)
CREATE POLICY "Allow authenticated read on payout_adjustments"
  ON public.payout_adjustments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on payout_adjustments"
  ON public.payout_adjustments FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on payout_adjustments"
  ON public.payout_adjustments FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on payout_adjustments"
  ON public.payout_adjustments FOR DELETE
  TO authenticated USING (true);

-- Allow service role full access (for edge functions)
CREATE POLICY "Allow service role full access on payout_adjustments"
  ON public.payout_adjustments FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Add extra_columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS extra_columns jsonb;
