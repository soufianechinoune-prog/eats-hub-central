-- Add platform-specific description columns to menu_items
ALTER TABLE public.menu_items 
ADD COLUMN description_uber text,
ADD COLUMN description_deliveroo text;

-- Migrate existing descriptions to description_uber (current data is from Uber)
UPDATE public.menu_items 
SET description_uber = description 
WHERE description IS NOT NULL;

-- Keep the original description column for backward compatibility (will be used as fallback)