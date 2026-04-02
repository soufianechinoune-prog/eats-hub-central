CREATE INDEX IF NOT EXISTS idx_order_items_order_covering
ON public.order_items(order_id, item_title, quantity);