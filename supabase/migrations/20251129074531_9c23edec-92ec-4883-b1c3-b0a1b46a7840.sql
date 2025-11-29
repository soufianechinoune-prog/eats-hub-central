-- Add new contact fields to restaurants table
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS restaurant_phone text,
ADD COLUMN IF NOT EXISTS restaurant_email text,
ADD COLUMN IF NOT EXISTS manager_whatsapp text;