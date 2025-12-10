-- Create daily_order_accuracy table for daily granularity data
CREATE TABLE public.daily_order_accuracy (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'current',
  incorrect_orders_count INTEGER NOT NULL DEFAULT 0,
  missing_items_count INTEGER NOT NULL DEFAULT 0,
  missing_items_refund NUMERIC NOT NULL DEFAULT 0,
  missing_customization_count INTEGER NOT NULL DEFAULT 0,
  missing_customization_refund NUMERIC NOT NULL DEFAULT 0,
  wrong_order_count INTEGER NOT NULL DEFAULT 0,
  wrong_order_refund NUMERIC NOT NULL DEFAULT 0,
  incorrect_item_count INTEGER NOT NULL DEFAULT 0,
  incorrect_item_refund NUMERIC NOT NULL DEFAULT 0,
  total_refund NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, date, period_type)
);

-- Enable RLS
ALTER TABLE public.daily_order_accuracy ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations
CREATE POLICY "Allow all on daily_order_accuracy" ON public.daily_order_accuracy
  FOR ALL USING (true) WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_daily_order_accuracy_restaurant_date ON public.daily_order_accuracy(restaurant_id, date);