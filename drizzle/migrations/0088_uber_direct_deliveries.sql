CREATE TABLE public.uber_direct_store_mapping (
  external_store_id text PRIMARY KEY,
  pickup_name text,
  chain_id uuid NOT NULL REFERENCES public.chains(id),
  restaurant_id uuid REFERENCES public.restaurants(id),
  match_method text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.uber_direct_store_mapping TO authenticated;
GRANT ALL ON public.uber_direct_store_mapping TO service_role;
ALTER TABLE public.uber_direct_store_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "udsm read chain" ON public.uber_direct_store_mapping FOR SELECT TO authenticated USING (public.user_has_chain_access(chain_id));

CREATE TABLE public.uber_direct_deliveries (
  id text PRIMARY KEY,
  chain_id uuid NOT NULL REFERENCES public.chains(id),
  external_id text,
  external_store_id text,
  pickup_name text,
  restaurant_id uuid REFERENCES public.restaurants(id),
  status text,
  complete boolean,
  currency text,
  fee_cents integer,
  tip_cents integer,
  basket_value_cents integer,
  products_gross_cents integer,
  discount_cents integer,
  client_delivery_fee_cents integer,
  client_service_fee_cents integer,
  distance_km numeric(8,3),
  delivered_in_min numeric(8,1),
  created_at_uber timestamptz,
  updated_at_uber timestamptz,
  batch_id text,
  dropoff_sequence_number integer,
  undeliverable_reason text,
  refunds jsonb,
  dropoff_city text,
  dropoff_zip text,
  raw_sanitized jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  first_seen_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.uber_direct_deliveries.basket_value_cents IS 'manifest.total_value : montant NET payé par le client pour les produits, remises déduites.';
COMMENT ON COLUMN public.uber_direct_deliveries.discount_cents IS 'max(0, somme prix×qté des manifest_items hors lignes Frais de livraison/service − manifest.total_value).';
COMMENT ON COLUMN public.uber_direct_deliveries.fee_cents IS 'Coût Uber facturé par course.';
CREATE INDEX udd_rest_created ON public.uber_direct_deliveries(restaurant_id, created_at_uber);
CREATE INDEX udd_ext ON public.uber_direct_deliveries(external_id);
GRANT SELECT ON public.uber_direct_deliveries TO authenticated;
GRANT ALL ON public.uber_direct_deliveries TO service_role;
ALTER TABLE public.uber_direct_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "udd read chain" ON public.uber_direct_deliveries FOR SELECT TO authenticated USING (public.user_has_chain_access(chain_id));

CREATE TABLE public.uber_direct_token_cache (
  id integer PRIMARY KEY,
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL
);
GRANT ALL ON public.uber_direct_token_cache TO service_role;
ALTER TABLE public.uber_direct_token_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.uber_direct_sync_runs (
  id bigserial PRIMARY KEY,
  mode text,
  window_start timestamptz,
  window_end timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  fetched integer, upserted integer, pages integer,
  error text
);
GRANT ALL ON public.uber_direct_sync_runs TO service_role;
GRANT USAGE ON SEQUENCE public.uber_direct_sync_runs_id_seq TO service_role;
ALTER TABLE public.uber_direct_sync_runs ENABLE ROW LEVEL SECURITY;