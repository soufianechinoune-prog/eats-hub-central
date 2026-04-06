
ALTER TABLE public.menu_item_reviews 
  ADD COLUMN IF NOT EXISTS uber_order_id text,
  ADD COLUMN IF NOT EXISTS item_price numeric,
  ADD COLUMN IF NOT EXISTS menu_category text;

CREATE INDEX IF NOT EXISTS idx_menu_item_reviews_uber_order_id 
  ON public.menu_item_reviews (uber_order_id) 
  WHERE uber_order_id IS NOT NULL;
