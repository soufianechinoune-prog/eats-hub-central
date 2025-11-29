-- Fix monthly_revenue RLS
DROP POLICY IF EXISTS "authenticated_users_all_monthly_revenue" ON public.monthly_revenue;
CREATE POLICY "Allow all on monthly_revenue" ON public.monthly_revenue FOR ALL USING (true) WITH CHECK (true);

-- Fix monthly_conversion RLS
DROP POLICY IF EXISTS "authenticated_users_all_monthly_conversion" ON public.monthly_conversion;
CREATE POLICY "Allow all on monthly_conversion" ON public.monthly_conversion FOR ALL USING (true) WITH CHECK (true);

-- Fix monthly_fees RLS
DROP POLICY IF EXISTS "authenticated_users_all_monthly_fees" ON public.monthly_fees;
CREATE POLICY "Allow all on monthly_fees" ON public.monthly_fees FOR ALL USING (true) WITH CHECK (true);

-- Fix orders RLS
DROP POLICY IF EXISTS "authenticated_users_all_orders" ON public.orders;
CREATE POLICY "Allow all on orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

-- Fix order_items RLS
DROP POLICY IF EXISTS "authenticated_users_all_order_items" ON public.order_items;
CREATE POLICY "Allow all on order_items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

-- Fix order_errors RLS
DROP POLICY IF EXISTS "authenticated_users_all_order_errors" ON public.order_errors;
CREATE POLICY "Allow all on order_errors" ON public.order_errors FOR ALL USING (true) WITH CHECK (true);

-- Fix customer_reviews RLS
DROP POLICY IF EXISTS "authenticated_users_all_customer_reviews" ON public.customer_reviews;
CREATE POLICY "Allow all on customer_reviews" ON public.customer_reviews FOR ALL USING (true) WITH CHECK (true);

-- Fix menu_item_reviews RLS
DROP POLICY IF EXISTS "authenticated_users_all_menu_item_reviews" ON public.menu_item_reviews;
CREATE POLICY "Allow all on menu_item_reviews" ON public.menu_item_reviews FOR ALL USING (true) WITH CHECK (true);

-- Fix delivery_stats RLS
DROP POLICY IF EXISTS "authenticated_users_all_delivery_stats" ON public.delivery_stats;
CREATE POLICY "Allow all on delivery_stats" ON public.delivery_stats FOR ALL USING (true) WITH CHECK (true);

-- Fix downtime_logs RLS
DROP POLICY IF EXISTS "authenticated_users_all_downtime_logs" ON public.downtime_logs;
CREATE POLICY "Allow all on downtime_logs" ON public.downtime_logs FOR ALL USING (true) WITH CHECK (true);

-- Fix promotions RLS
DROP POLICY IF EXISTS "authenticated_users_all_promotions" ON public.promotions;
CREATE POLICY "Allow all on promotions" ON public.promotions FOR ALL USING (true) WITH CHECK (true);

-- Fix reports RLS
DROP POLICY IF EXISTS "authenticated_users_all_reports" ON public.reports;
CREATE POLICY "Allow all on reports" ON public.reports FOR ALL USING (true) WITH CHECK (true);

-- Fix uber_connections RLS
DROP POLICY IF EXISTS "authenticated_users_all_uber_connections" ON public.uber_connections;
CREATE POLICY "Allow all on uber_connections" ON public.uber_connections FOR ALL USING (true) WITH CHECK (true);

-- Fix webhook_logs RLS
DROP POLICY IF EXISTS "authenticated_users_all_webhook_logs" ON public.webhook_logs;
CREATE POLICY "Allow all on webhook_logs" ON public.webhook_logs FOR ALL USING (true) WITH CHECK (true);

-- Fix chains RLS
DROP POLICY IF EXISTS "Anyone can read chains" ON public.chains;
DROP POLICY IF EXISTS "Authenticated users can manage chains" ON public.chains;
CREATE POLICY "Allow all on chains" ON public.chains FOR ALL USING (true) WITH CHECK (true);