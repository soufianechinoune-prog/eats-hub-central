-- Add platform-specific name columns to menu_items
ALTER TABLE public.menu_items 
ADD COLUMN name_uber TEXT,
ADD COLUMN name_deliveroo TEXT;