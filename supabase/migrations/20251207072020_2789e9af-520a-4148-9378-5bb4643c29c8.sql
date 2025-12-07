-- Add UNIQUE constraint on uber_order_id for upsert support
ALTER TABLE public.customer_reviews 
ADD CONSTRAINT customer_reviews_uber_order_id_key UNIQUE (uber_order_id);