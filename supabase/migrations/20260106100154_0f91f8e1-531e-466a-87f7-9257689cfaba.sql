-- Add validated field to restaurant_menu_prices table
ALTER TABLE public.restaurant_menu_prices 
ADD COLUMN IF NOT EXISTS validated boolean DEFAULT false;

-- Add validated_at timestamp to track when it was validated
ALTER TABLE public.restaurant_menu_prices 
ADD COLUMN IF NOT EXISTS validated_at timestamp with time zone;