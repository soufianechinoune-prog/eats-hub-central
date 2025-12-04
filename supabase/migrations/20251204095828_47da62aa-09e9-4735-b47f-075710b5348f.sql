-- Drop the unique constraint on uber_order_id (not index)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_uber_order_id_key;

-- Create composite unique index to handle multi-line orders correctly
-- COALESCE handles NULL uber_flow_id values
CREATE UNIQUE INDEX IF NOT EXISTS orders_uber_order_flow_unique 
ON public.orders (uber_order_id, COALESCE(uber_flow_id, ''));