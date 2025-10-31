-- Table for customer reviews and ratings
CREATE TABLE IF NOT EXISTS public.customer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  uber_order_id TEXT,
  overall_rating NUMERIC,
  food_rating NUMERIC,
  delivery_rating NUMERIC,
  customer_comment TEXT,
  review_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for menu item ratings
CREATE TABLE IF NOT EXISTS public.menu_item_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  item_id TEXT NOT NULL,
  item_title TEXT NOT NULL,
  rating NUMERIC NOT NULL,
  thumb_up INTEGER DEFAULT 0,
  thumb_down INTEGER DEFAULT 0,
  comment TEXT,
  review_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for delivery statistics
CREATE TABLE IF NOT EXISTS public.delivery_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  uber_order_id TEXT,
  courier_name TEXT,
  courier_id TEXT,
  preparation_time_minutes INTEGER,
  delivery_time_minutes INTEGER,
  total_time_minutes INTEGER,
  estimated_time_minutes INTEGER,
  delay_minutes INTEGER,
  delivery_status TEXT,
  delivery_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for order errors
CREATE TABLE IF NOT EXISTS public.order_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  order_id UUID,
  uber_order_id TEXT,
  error_type TEXT NOT NULL,
  error_category TEXT,
  item_id TEXT,
  item_title TEXT,
  error_description TEXT,
  financial_impact NUMERIC,
  error_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for downtime logs
CREATE TABLE IF NOT EXISTS public.downtime_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  downtime_start TIMESTAMP WITH TIME ZONE NOT NULL,
  downtime_end TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  reason TEXT,
  downtime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_reviews_restaurant_id ON public.customer_reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_order_id ON public.customer_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_reviews_restaurant_id ON public.menu_item_reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_reviews_item_id ON public.menu_item_reviews(item_id);
CREATE INDEX IF NOT EXISTS idx_delivery_stats_restaurant_id ON public.delivery_stats(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_errors_restaurant_id ON public.order_errors(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_downtime_logs_restaurant_id ON public.downtime_logs(restaurant_id);

-- Enable RLS
ALTER TABLE public.customer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downtime_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "authenticated_users_all_customer_reviews"
  ON public.customer_reviews FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_users_all_menu_item_reviews"
  ON public.menu_item_reviews FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_users_all_delivery_stats"
  ON public.delivery_stats FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_users_all_order_errors"
  ON public.order_errors FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_users_all_downtime_logs"
  ON public.downtime_logs FOR ALL USING (true) WITH CHECK (true);