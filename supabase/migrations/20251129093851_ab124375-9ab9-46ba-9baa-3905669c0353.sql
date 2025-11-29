-- Drop any generated column constraint and recreate as a regular column
ALTER TABLE public.monthly_revenue 
ALTER COLUMN average_basket DROP EXPRESSION IF EXISTS;

-- Ensure the column is a regular nullable numeric column
ALTER TABLE public.monthly_revenue 
ALTER COLUMN average_basket DROP DEFAULT;

ALTER TABLE public.monthly_revenue 
ALTER COLUMN average_basket TYPE numeric USING average_basket::numeric;