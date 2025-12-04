-- Drop the functional index (can't use ON CONFLICT with functional indexes)
DROP INDEX IF EXISTS orders_uber_order_flow_unique;

-- Update any existing NULL uber_flow_id values to empty string
UPDATE public.orders SET uber_flow_id = '' WHERE uber_flow_id IS NULL;

-- Alter column to NOT NULL with default empty string
ALTER TABLE public.orders ALTER COLUMN uber_flow_id SET DEFAULT '';
ALTER TABLE public.orders ALTER COLUMN uber_flow_id SET NOT NULL;

-- Create simple composite unique constraint (not functional index)
ALTER TABLE public.orders ADD CONSTRAINT orders_uber_order_flow_unique UNIQUE (uber_order_id, uber_flow_id);