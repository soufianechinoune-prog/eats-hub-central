-- Add platform opening and closing dates to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN uber_opening_date DATE,
ADD COLUMN uber_closing_date DATE,
ADD COLUMN deliveroo_opening_date DATE,
ADD COLUMN deliveroo_closing_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN public.restaurants.uber_opening_date IS 'Date when the restaurant started on Uber Eats';
COMMENT ON COLUMN public.restaurants.uber_closing_date IS 'Date when the restaurant closed on Uber Eats (null if still active)';
COMMENT ON COLUMN public.restaurants.deliveroo_opening_date IS 'Date when the restaurant started on Deliveroo';
COMMENT ON COLUMN public.restaurants.deliveroo_closing_date IS 'Date when the restaurant closed on Deliveroo (null if still active)';