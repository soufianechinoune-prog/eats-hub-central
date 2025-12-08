-- Create order_history table for storing detailed order operational data
CREATE TABLE public.order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id),
  uber_order_id TEXT NOT NULL,
  uber_flow_id TEXT,
  order_status TEXT,
  delivery_status TEXT,
  cancelled_by TEXT,
  item_count INTEGER,
  order_amount NUMERIC,
  order_datetime TIMESTAMP WITH TIME ZONE,
  merchant_accept_time TIMESTAMP WITH TIME ZONE,
  accept_delay_minutes NUMERIC,
  initial_prep_time_minutes NUMERIC,
  extended_prep BOOLEAN DEFAULT false,
  extended_prep_time_minutes NUMERIC,
  courier_arrival_time TIMESTAMP WITH TIME ZONE,
  courier_departure_time TIMESTAMP WITH TIME ZONE,
  delivery_time TIMESTAMP WITH TIME ZONE,
  total_delivery_time_minutes NUMERIC,
  courier_wait_time_minutes NUMERIC,
  avoidable_wait_time_minutes NUMERIC,
  customer_wait_time_minutes NUMERIC,
  total_prep_delivery_time_minutes NUMERIC,
  total_order_duration_minutes NUMERIC,
  multi_order_type TEXT,
  fulfillment_type TEXT,
  order_channel TEXT,
  brand TEXT,
  uber_one BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  platform TEXT DEFAULT 'uber_eats',
  UNIQUE(restaurant_id, uber_order_id)
);

-- Enable RLS
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Allow all on order_history" ON public.order_history
  FOR ALL USING (true) WITH CHECK (true);

-- Create index for common queries
CREATE INDEX idx_order_history_restaurant_date ON public.order_history(restaurant_id, order_datetime);
CREATE INDEX idx_order_history_order_datetime ON public.order_history(order_datetime);