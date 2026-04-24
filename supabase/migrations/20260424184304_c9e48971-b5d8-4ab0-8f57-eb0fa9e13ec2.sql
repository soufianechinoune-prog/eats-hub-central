-- ─── Table principale : données de CA Splash360 ─────────────────────────
CREATE TABLE public.splash360_daily_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_splash_id INTEGER NOT NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  granularity TEXT NOT NULL CHECK (granularity IN ('day','week','month','year')),
  platform TEXT NOT NULL CHECK (platform IN ('global','uber_eats','deliveroo')),
  revenue_ttc NUMERIC NOT NULL DEFAULT 0,
  revenue_ht NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  average_basket NUMERIC NOT NULL DEFAULT 0,
  n1_revenue_ttc NUMERIC,
  n1_order_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_splash_id, date, granularity, platform)
);

CREATE INDEX idx_splash360_daily_sales_restaurant ON public.splash360_daily_sales(restaurant_id);
CREATE INDEX idx_splash360_daily_sales_date ON public.splash360_daily_sales(date);
CREATE INDEX idx_splash360_daily_sales_splash_id ON public.splash360_daily_sales(restaurant_splash_id);

ALTER TABLE public.splash360_daily_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view splash360 sales"
ON public.splash360_daily_sales FOR SELECT
TO authenticated
USING (public.is_super_admin());

CREATE TRIGGER update_splash360_daily_sales_updated_at
BEFORE UPDATE ON public.splash360_daily_sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Table de mapping Splash ID ↔ restaurant_id ─────────────────────────
CREATE TABLE public.splash360_restaurant_mapping (
  restaurant_splash_id INTEGER PRIMARY KEY,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  splash_name TEXT,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_splash360_mapping_restaurant ON public.splash360_restaurant_mapping(restaurant_id);

ALTER TABLE public.splash360_restaurant_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view splash360 mapping"
ON public.splash360_restaurant_mapping FOR SELECT
TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can insert splash360 mapping"
ON public.splash360_restaurant_mapping FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can update splash360 mapping"
ON public.splash360_restaurant_mapping FOR UPDATE
TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can delete splash360 mapping"
ON public.splash360_restaurant_mapping FOR DELETE
TO authenticated
USING (public.is_super_admin());