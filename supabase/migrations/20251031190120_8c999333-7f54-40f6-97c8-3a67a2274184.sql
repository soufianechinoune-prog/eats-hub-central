-- Create order_items table for detailed item analysis
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_title TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  tax_amount NUMERIC,
  tax_rate NUMERIC,
  modifiers JSONB,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add promotion tracking to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS promotion_id TEXT,
ADD COLUMN IF NOT EXISTS promotion_discount NUMERIC,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS tip_amount NUMERIC,
ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item_id ON public.order_items(item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_created_at ON public.order_items(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_promotion_id ON public.orders(promotion_id);

-- Enable RLS on order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for order_items
CREATE POLICY "authenticated_users_all_order_items"
  ON public.order_items
  FOR ALL
  USING (true)
  WITH CHECK (true);