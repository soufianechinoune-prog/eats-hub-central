-- Fix RLS policies to use auth.uid() instead of auth.role()

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.restaurants;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.uber_connections;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.promotions;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.chains;

-- Create new policies for restaurants
CREATE POLICY "authenticated_users_all_restaurants"
  ON public.restaurants
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new policies for uber_connections
CREATE POLICY "authenticated_users_all_uber_connections"
  ON public.uber_connections
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new policies for orders
CREATE POLICY "authenticated_users_all_orders"
  ON public.orders
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new policies for promotions
CREATE POLICY "authenticated_users_all_promotions"
  ON public.promotions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new policies for chains
CREATE POLICY "authenticated_users_all_chains"
  ON public.chains
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);