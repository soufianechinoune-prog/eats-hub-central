-- Create daily_sales_uber table for official Uber "Sales Over Time" data
CREATE TABLE public.daily_sales_uber (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  revenue_ttc NUMERIC NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  average_basket NUMERIC NOT NULL DEFAULT 0,
  period_type TEXT NOT NULL DEFAULT 'current',
  platform TEXT NOT NULL DEFAULT 'uber_eats',
  currency TEXT DEFAULT 'EUR',
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(restaurant_id, date, platform, period_type)
);

-- Enable RLS
ALTER TABLE public.daily_sales_uber ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow all on daily_sales_uber" ON public.daily_sales_uber FOR ALL USING (true) WITH CHECK (true);

-- Create index for efficient queries
CREATE INDEX idx_daily_sales_uber_restaurant_date ON public.daily_sales_uber(restaurant_id, date);
CREATE INDEX idx_daily_sales_uber_date ON public.daily_sales_uber(date);

-- RPC function to get monthly aggregated sales from daily data
CREATE OR REPLACE FUNCTION public.get_monthly_sales_from_daily(
  p_year INTEGER,
  p_restaurant_ids UUID[] DEFAULT NULL,
  p_period_type TEXT DEFAULT 'current'
)
RETURNS TABLE (
  restaurant_id UUID,
  year INTEGER,
  month INTEGER,
  platform TEXT,
  revenue_ttc NUMERIC,
  order_count BIGINT,
  average_basket NUMERIC
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.restaurant_id,
    EXTRACT(YEAR FROM d.date)::INTEGER as year,
    EXTRACT(MONTH FROM d.date)::INTEGER as month,
    d.platform,
    COALESCE(SUM(d.revenue_ttc), 0) as revenue_ttc,
    COALESCE(SUM(d.order_count), 0)::BIGINT as order_count,
    CASE WHEN SUM(d.order_count) > 0 
      THEN ROUND(SUM(d.revenue_ttc) / SUM(d.order_count), 2)
      ELSE 0 
    END as average_basket
  FROM public.daily_sales_uber d
  WHERE EXTRACT(YEAR FROM d.date) = p_year
    AND d.period_type = p_period_type
    AND (p_restaurant_ids IS NULL OR d.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY d.restaurant_id, EXTRACT(YEAR FROM d.date), EXTRACT(MONTH FROM d.date), d.platform
  ORDER BY month;
END;
$$;

-- RPC function to get daily sales for a date range
CREATE OR REPLACE FUNCTION public.get_daily_sales_uber(
  p_start_date DATE,
  p_end_date DATE,
  p_restaurant_ids UUID[] DEFAULT NULL,
  p_period_type TEXT DEFAULT 'current'
)
RETURNS TABLE (
  restaurant_id UUID,
  date DATE,
  platform TEXT,
  revenue_ttc NUMERIC,
  order_count INTEGER,
  average_basket NUMERIC
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.restaurant_id,
    d.date,
    d.platform,
    d.revenue_ttc,
    d.order_count,
    d.average_basket
  FROM public.daily_sales_uber d
  WHERE d.date >= p_start_date
    AND d.date <= p_end_date
    AND d.period_type = p_period_type
    AND (p_restaurant_ids IS NULL OR d.restaurant_id = ANY(p_restaurant_ids))
  ORDER BY d.date;
END;
$$;