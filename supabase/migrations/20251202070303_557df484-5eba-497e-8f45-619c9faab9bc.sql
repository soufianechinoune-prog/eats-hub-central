-- Create daily_revenue table for daily granularity data
CREATE TABLE public.daily_revenue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  platform TEXT NOT NULL DEFAULT 'uber_eats',
  revenue_ttc NUMERIC NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  average_basket NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, date, platform)
);

-- Create daily_conversion table for daily conversion metrics
CREATE TABLE public.daily_conversion (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  platform TEXT NOT NULL DEFAULT 'uber_eats',
  visits INTEGER NOT NULL DEFAULT 0,
  menu_views INTEGER NOT NULL DEFAULT 0,
  add_to_cart INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  view_rate NUMERIC,
  cart_rate NUMERIC,
  conversion_rate NUMERIC,
  overall_rate NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, date, platform)
);

-- Enable Row Level Security
ALTER TABLE public.daily_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_conversion ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for daily_revenue
CREATE POLICY "Allow all on daily_revenue"
ON public.daily_revenue
FOR ALL
USING (true)
WITH CHECK (true);

-- Create RLS policies for daily_conversion
CREATE POLICY "Allow all on daily_conversion"
ON public.daily_conversion
FOR ALL
USING (true)
WITH CHECK (true);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_daily_revenue_updated_at
BEFORE UPDATE ON public.daily_revenue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_conversion_updated_at
BEFORE UPDATE ON public.daily_conversion
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_daily_revenue_restaurant_date ON public.daily_revenue(restaurant_id, date);
CREATE INDEX idx_daily_revenue_date ON public.daily_revenue(date);
CREATE INDEX idx_daily_revenue_platform ON public.daily_revenue(platform);

CREATE INDEX idx_daily_conversion_restaurant_date ON public.daily_conversion(restaurant_id, date);
CREATE INDEX idx_daily_conversion_date ON public.daily_conversion(date);
CREATE INDEX idx_daily_conversion_platform ON public.daily_conversion(platform);