
-- Add new columns to capture additional CSV data
ALTER TABLE public.order_errors 
ADD COLUMN IF NOT EXISTS order_channel text,
ADD COLUMN IF NOT EXISTS order_amount numeric,
ADD COLUMN IF NOT EXISTS refund_datetime timestamptz;

-- Add unique constraint for upsert deduplication
CREATE UNIQUE INDEX IF NOT EXISTS order_errors_dedup_idx 
ON public.order_errors (restaurant_id, uber_order_id, COALESCE(item_title, ''));
