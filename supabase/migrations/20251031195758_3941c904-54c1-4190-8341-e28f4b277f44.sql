-- Add customer information columns to order_errors table
ALTER TABLE public.order_errors 
ADD COLUMN customer_name text,
ADD COLUMN customer_id text;

-- Create index for faster customer lookups
CREATE INDEX idx_order_errors_customer_id ON public.order_errors(customer_id);
CREATE INDEX idx_order_errors_customer_name ON public.order_errors(customer_name);