-- Add restaurant_id to order_items for easier querying
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS restaurant_id uuid;

-- Create index for faster restaurant-based queries
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_id ON public.order_items(restaurant_id);

-- Create composite index for item analysis
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_item ON public.order_items(restaurant_id, item_id);

-- Backfill existing order_items with restaurant_id from orders table
UPDATE public.order_items oi
SET restaurant_id = o.restaurant_id
FROM public.orders o
WHERE oi.order_id = o.id
AND oi.restaurant_id IS NULL;