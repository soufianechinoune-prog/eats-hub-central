-- Drop existing restrictive policy on chains
DROP POLICY IF EXISTS "authenticated_users_all_chains" ON public.chains;

-- Create permissive policy for public read access
CREATE POLICY "Anyone can read chains"
ON public.chains
FOR SELECT
USING (true);

-- Create policy for authenticated users to manage chains
CREATE POLICY "Authenticated users can manage chains"
ON public.chains
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Drop existing restrictive policy on restaurants
DROP POLICY IF EXISTS "authenticated_users_all_restaurants" ON public.restaurants;

-- Create permissive policy for public read access on restaurants
CREATE POLICY "Anyone can read restaurants"
ON public.restaurants
FOR SELECT
USING (true);

-- Create policy for authenticated users to manage restaurants
CREATE POLICY "Authenticated users can manage restaurants"
ON public.restaurants
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Also allow public insert on restaurants for now (since no auth is implemented yet)
CREATE POLICY "Anyone can insert restaurants"
ON public.restaurants
FOR INSERT
WITH CHECK (true);