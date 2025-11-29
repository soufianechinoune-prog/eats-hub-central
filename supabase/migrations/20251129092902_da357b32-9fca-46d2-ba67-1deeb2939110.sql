-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Anyone can insert restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Anyone can read restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Authenticated users can manage restaurants" ON public.restaurants;

-- Create proper PERMISSIVE policies
CREATE POLICY "Allow read restaurants for all" 
ON public.restaurants 
FOR SELECT 
USING (true);

CREATE POLICY "Allow insert restaurants for all" 
ON public.restaurants 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow update restaurants for all" 
ON public.restaurants 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow delete restaurants for all" 
ON public.restaurants 
FOR DELETE 
USING (true);