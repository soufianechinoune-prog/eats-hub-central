ALTER TABLE public.success_scores 
  ADD COLUMN IF NOT EXISTS unfulfilled_orders numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS avoidable_courier_wait numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS incorrect_orders numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS food_quality numeric DEFAULT NULL;