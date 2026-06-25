
CREATE TABLE public.uber_live_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uber_order_id text NOT NULL UNIQUE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  uber_store_id text NOT NULL,
  chain_id uuid REFERENCES public.chains(id) ON DELETE CASCADE,
  status text,
  gross_amount_incl_vat numeric(12,2),
  currency text NOT NULL DEFAULT 'EUR',
  order_placed_at timestamptz NOT NULL DEFAULT now(),
  last_event_at timestamptz NOT NULL DEFAULT now(),
  consolidated boolean NOT NULL DEFAULT false,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_uber_live_orders_resto_placed ON public.uber_live_orders (restaurant_id, order_placed_at DESC);
CREATE INDEX idx_uber_live_orders_chain_placed ON public.uber_live_orders (chain_id, order_placed_at DESC);
CREATE INDEX idx_uber_live_orders_consolidated ON public.uber_live_orders (consolidated, order_placed_at);
CREATE INDEX idx_uber_live_orders_store ON public.uber_live_orders (uber_store_id);

GRANT SELECT ON public.uber_live_orders TO authenticated;
GRANT ALL ON public.uber_live_orders TO service_role;

ALTER TABLE public.uber_live_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their chain live orders"
  ON public.uber_live_orders FOR SELECT
  TO authenticated
  USING (chain_id IS NULL OR public.user_has_chain_access(chain_id));

CREATE POLICY "Service role manages live orders"
  ON public.uber_live_orders FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_uber_live_orders_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_uber_live_orders_touch
  BEFORE UPDATE ON public.uber_live_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_uber_live_orders_updated_at();

-- Mark live orders as consolidated once the official 'orders' table has data for that restaurant/date
CREATE OR REPLACE FUNCTION public.mark_uber_live_orders_consolidated(_restaurant_id uuid, _date_paris date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated_count integer;
BEGIN
  UPDATE public.uber_live_orders
     SET consolidated = true, updated_at = now()
   WHERE restaurant_id = _restaurant_id
     AND (order_placed_at AT TIME ZONE 'Europe/Paris')::date = _date_paris
     AND consolidated = false;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END $$;
