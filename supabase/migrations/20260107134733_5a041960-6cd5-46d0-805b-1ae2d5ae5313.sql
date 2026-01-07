-- Add TVA columns to restaurant_menu_prices table
ALTER TABLE public.restaurant_menu_prices
ADD COLUMN tva_uber numeric DEFAULT NULL,
ADD COLUMN tva_deliveroo numeric DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.restaurant_menu_prices.tva_uber IS 'TVA rate applied on Uber Eats (e.g., 5.5, 10, 20)';
COMMENT ON COLUMN public.restaurant_menu_prices.tva_deliveroo IS 'TVA rate applied on Deliveroo (e.g., 5.5, 10, 20)';