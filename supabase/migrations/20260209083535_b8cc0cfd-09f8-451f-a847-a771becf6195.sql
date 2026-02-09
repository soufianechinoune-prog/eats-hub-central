-- Create a join table to store multiple Uber store IDs per restaurant
CREATE TABLE public.restaurant_uber_ids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  uber_store_id TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  label TEXT, -- Optional label like "ancien", "nouveau", etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(uber_store_id) -- Each uber_store_id can only be linked to one restaurant
);

-- Create index for fast lookups
CREATE INDEX idx_restaurant_uber_ids_uber_store_id ON public.restaurant_uber_ids(uber_store_id);
CREATE INDEX idx_restaurant_uber_ids_restaurant_id ON public.restaurant_uber_ids(restaurant_id);

-- Migrate existing uber_store_id from restaurants table to the new join table
INSERT INTO public.restaurant_uber_ids (restaurant_id, uber_store_id, is_primary, label)
SELECT id, uber_store_id, true, 'principal'
FROM public.restaurants
WHERE uber_store_id IS NOT NULL AND uber_store_id != '';

-- Add comment for documentation
COMMENT ON TABLE public.restaurant_uber_ids IS 'Stores multiple Uber Eats store IDs per restaurant to handle UUID changes over time';