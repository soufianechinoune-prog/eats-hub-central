-- Table pour les données CA & Commandes mensuelles
CREATE TABLE public.monthly_revenue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  revenue_ttc NUMERIC NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  working_days INTEGER,
  average_basket NUMERIC GENERATED ALWAYS AS (
    CASE WHEN order_count > 0 THEN revenue_ttc / order_count ELSE 0 END
  ) STORED,
  revenue_per_day NUMERIC GENERATED ALWAYS AS (
    CASE WHEN working_days > 0 THEN revenue_ttc / working_days ELSE 0 END
  ) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, year, month)
);

-- Table pour les données de conversion mensuelles
CREATE TABLE public.monthly_conversion (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  visits INTEGER NOT NULL DEFAULT 0,
  menu_views INTEGER NOT NULL DEFAULT 0,
  add_to_cart INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  view_rate NUMERIC GENERATED ALWAYS AS (
    CASE WHEN visits > 0 THEN (menu_views::NUMERIC / visits) * 100 ELSE 0 END
  ) STORED,
  cart_rate NUMERIC GENERATED ALWAYS AS (
    CASE WHEN menu_views > 0 THEN (add_to_cart::NUMERIC / menu_views) * 100 ELSE 0 END
  ) STORED,
  conversion_rate NUMERIC GENERATED ALWAYS AS (
    CASE WHEN add_to_cart > 0 THEN (orders::NUMERIC / add_to_cart) * 100 ELSE 0 END
  ) STORED,
  overall_rate NUMERIC GENERATED ALWAYS AS (
    CASE WHEN visits > 0 THEN (orders::NUMERIC / visits) * 100 ELSE 0 END
  ) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, year, month)
);

-- Table pour les frais et marketing mensuels
CREATE TABLE public.monthly_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  uber_fee NUMERIC NOT NULL DEFAULT 0,
  marketing_fee NUMERIC NOT NULL DEFAULT 0,
  offers_cost NUMERIC NOT NULL DEFAULT 0,
  ads_cost NUMERIC NOT NULL DEFAULT 0,
  error_adjustments NUMERIC NOT NULL DEFAULT 0,
  other_fees NUMERIC NOT NULL DEFAULT 0,
  net_payout NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, year, month)
);

-- Enable RLS
ALTER TABLE public.monthly_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_conversion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users
CREATE POLICY "authenticated_users_all_monthly_revenue" 
ON public.monthly_revenue 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_users_all_monthly_conversion" 
ON public.monthly_conversion 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_users_all_monthly_fees" 
ON public.monthly_fees 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_monthly_revenue_updated_at
BEFORE UPDATE ON public.monthly_revenue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_conversion_updated_at
BEFORE UPDATE ON public.monthly_conversion
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_fees_updated_at
BEFORE UPDATE ON public.monthly_fees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();