
DROP POLICY IF EXISTS "Authenticated users can read aliases" ON public.restaurant_name_aliases;
DROP POLICY IF EXISTS "Authenticated users can insert aliases" ON public.restaurant_name_aliases;

CREATE POLICY "Anyone can read aliases" ON public.restaurant_name_aliases FOR SELECT USING (true);
CREATE POLICY "Anyone can insert aliases" ON public.restaurant_name_aliases FOR INSERT WITH CHECK (true);
