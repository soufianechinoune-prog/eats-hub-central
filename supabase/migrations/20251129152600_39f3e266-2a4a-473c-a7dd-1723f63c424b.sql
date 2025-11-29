-- Make restaurant_id nullable in restaurant_actions (actions can be global or per-restaurant)
ALTER TABLE public.restaurant_actions 
ALTER COLUMN restaurant_id DROP NOT NULL;