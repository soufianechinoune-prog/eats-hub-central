CREATE TABLE public.splash_product_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  chain_id uuid NOT NULL,
  month date NOT NULL,
  product_id text NOT NULL,
  product_name text NOT NULL,
  quantity_total integer NOT NULL DEFAULT 0,
  revenue_excl_vat numeric NOT NULL DEFAULT 0,
  revenue_incl_vat numeric NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, month, product_id)
);

CREATE INDEX idx_spm_chain_month ON public.splash_product_monthly (chain_id, month);
CREATE INDEX idx_spm_restaurant_month ON public.splash_product_monthly (restaurant_id, month);

GRANT SELECT ON public.splash_product_monthly TO authenticated;
GRANT ALL ON public.splash_product_monthly TO service_role;

ALTER TABLE public.splash_product_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view product sales of their chains"
ON public.splash_product_monthly
FOR SELECT
TO authenticated
USING (public.user_has_chain_access(chain_id));

CREATE TRIGGER update_splash_product_monthly_updated_at
BEFORE UPDATE ON public.splash_product_monthly
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();