
CREATE UNIQUE INDEX IF NOT EXISTS deliveroo_orders_upsert_key 
ON public.deliveroo_orders (deliveroo_uuid, history_type, delivery_datetime);
