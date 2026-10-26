CREATE TABLE public.splash_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id text NOT NULL UNIQUE,
  event_type text NOT NULL CHECK (event_type IN ('stock','prices','catalog','orders')),
  station_credentials_id uuid REFERENCES public.splash_restaurant_credentials(id),
  restaurant_id uuid REFERENCES public.restaurants(id),
  chain_id uuid REFERENCES public.chains(id),
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','unmapped','processed')),
  CHECK ((station_credentials_id IS NULL AND restaurant_id IS NULL AND chain_id IS NULL) OR (station_credentials_id IS NOT NULL AND restaurant_id IS NOT NULL AND chain_id IS NOT NULL))
);
GRANT ALL ON public.splash_webhook_events TO service_role;
REVOKE ALL ON public.splash_webhook_events FROM anon, authenticated;
ALTER TABLE public.splash_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX splash_webhook_events_pending_idx ON public.splash_webhook_events(status, received_at);
COMMENT ON TABLE public.splash_webhook_events IS 'Service-only durable inbox for signature-verified Splash events. No headers, secrets or station client IDs stored. Keep webhook IDs at least 48 hours. Unmapped stations remain private until verified mapping. Does not overwrite price reference grids or revenue.';