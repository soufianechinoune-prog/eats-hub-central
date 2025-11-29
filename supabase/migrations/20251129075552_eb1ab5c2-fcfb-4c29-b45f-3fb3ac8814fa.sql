-- Add street and postal_code columns to restaurants table
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS street text,
ADD COLUMN IF NOT EXISTS postal_code text;

-- Migrate existing address data to street column if needed
UPDATE public.restaurants 
SET street = address 
WHERE address IS NOT NULL AND street IS NULL;