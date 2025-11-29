-- Add description column to menu_items for product descriptions
ALTER TABLE public.menu_items 
ADD COLUMN description text;