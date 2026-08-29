CREATE TABLE public.uber_conversion_funnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NULL REFERENCES public.restaurants(id) ON DELETE SET NULL,
  chain_id uuid NULL,
  uber_store_uuid text NOT NULL,
  store_name text NOT NULL,
  window_label text,
  visits int,
  menu_views int,
  cart_adds int,
  orders int,
  conversion_rate int,
  status text,
  collected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uber_conversion_funnel_store_window_key
  ON public.uber_conversion_funnel (uber_store_uuid, COALESCE(window_label, ''));

CREATE INDEX idx_uber_conversion_funnel_restaurant ON public.uber_conversion_funnel (restaurant_id);
CREATE INDEX idx_uber_conversion_funnel_chain ON public.uber_conversion_funnel (chain_id);

GRANT SELECT ON public.uber_conversion_funnel TO authenticated;
GRANT ALL ON public.uber_conversion_funnel TO service_role;

ALTER TABLE public.uber_conversion_funnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read funnel with chain access"
ON public.uber_conversion_funnel
FOR SELECT
TO authenticated
USING (public.is_super_admin() OR (chain_id IS NOT NULL AND public.user_has_chain_access(chain_id)));

CREATE TRIGGER update_uber_conversion_funnel_updated_at
BEFORE UPDATE ON public.uber_conversion_funnel
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();