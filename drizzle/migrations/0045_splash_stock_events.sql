CREATE TABLE public.splash_stock_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  splash_api_key text,
  item_id text NOT NULL,
  item_kind text,
  status text NOT NULL,
  raw jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.splash_stock_events TO authenticated;
GRANT ALL ON public.splash_stock_events TO service_role;
ALTER TABLE public.splash_stock_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read stock events" ON public.splash_stock_events
FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE INDEX idx_splash_stock_events_item ON public.splash_stock_events (splash_api_key, item_id, received_at DESC);