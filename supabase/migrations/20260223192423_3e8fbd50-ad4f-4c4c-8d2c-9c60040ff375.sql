
-- Create deliveroo_orders table for Deliveroo payment statement imports
CREATE TABLE public.deliveroo_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES public.restaurants(id),
  restaurant_name TEXT NOT NULL,
  deliveroo_order_id TEXT,
  deliveroo_uuid TEXT,
  delivery_datetime TIMESTAMPTZ,
  history_type TEXT NOT NULL,
  order_amount NUMERIC DEFAULT 0,
  adjustment_amount NUMERIC DEFAULT 0,
  commission_rate TEXT,
  commission_amount NUMERIC DEFAULT 0,
  vat_rate NUMERIC DEFAULT 0,
  vat_amount NUMERIC DEFAULT 0,
  total_payable NUMERIC DEFAULT 0,
  note TEXT,
  section TEXT DEFAULT 'orders',
  statement_file TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicates on re-import
CREATE UNIQUE INDEX idx_deliveroo_orders_dedup 
  ON public.deliveroo_orders (deliveroo_uuid, history_type, delivery_datetime)
  WHERE deliveroo_uuid IS NOT NULL;

-- Performance indexes
CREATE INDEX idx_deliveroo_orders_restaurant ON public.deliveroo_orders (restaurant_id);
CREATE INDEX idx_deliveroo_orders_datetime ON public.deliveroo_orders (delivery_datetime);
CREATE INDEX idx_deliveroo_orders_history_type ON public.deliveroo_orders (history_type);

-- Enable RLS
ALTER TABLE public.deliveroo_orders ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as other tables)
CREATE POLICY "Allow all on deliveroo_orders" ON public.deliveroo_orders
  FOR ALL USING (true) WITH CHECK (true);
