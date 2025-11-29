-- Modify menu_items table: remove restaurant_id, replace price with platform-specific prices
ALTER TABLE public.menu_items 
DROP COLUMN IF EXISTS restaurant_id,
DROP COLUMN IF EXISTS price;

-- Add platform-specific price columns
ALTER TABLE public.menu_items 
ADD COLUMN price_uber numeric DEFAULT NULL,
ADD COLUMN price_deliveroo numeric DEFAULT NULL;

-- Update RLS policies to remove restaurant_id references
DROP POLICY IF EXISTS "Allow delete menu_items for all" ON public.menu_items;
DROP POLICY IF EXISTS "Allow insert menu_items for all" ON public.menu_items;
DROP POLICY IF EXISTS "Allow read menu_items for all" ON public.menu_items;
DROP POLICY IF EXISTS "Allow update menu_items for all" ON public.menu_items;

-- Recreate simple RLS policies
CREATE POLICY "Allow read menu_items for all" 
ON public.menu_items 
FOR SELECT 
USING (true);

CREATE POLICY "Allow insert menu_items for all" 
ON public.menu_items 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow update menu_items for all" 
ON public.menu_items 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow delete menu_items for all" 
ON public.menu_items 
FOR DELETE 
USING (true);