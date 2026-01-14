-- Add order_date column to customer_reviews table
-- This stores the date when the order was placed (Date de la commande)
-- Distinct from review_date which is when the customer submitted their review (Date de la note)

ALTER TABLE public.customer_reviews 
ADD COLUMN order_date TIMESTAMPTZ;

-- Add comments for clarity
COMMENT ON COLUMN public.customer_reviews.review_date IS 'Date de la note - quand le client dépose son avis';
COMMENT ON COLUMN public.customer_reviews.order_date IS 'Date de la commande - quand le client a passé commande';