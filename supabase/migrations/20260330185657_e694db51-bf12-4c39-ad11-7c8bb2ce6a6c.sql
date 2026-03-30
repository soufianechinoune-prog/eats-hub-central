
-- =============================================
-- FIX: Purge ALL permissive RLS policies, replace with TO authenticated
-- =============================================

-- === ADDITIONAL DROPS (policies manquantes identifiées) ===

-- restaurants
DROP POLICY IF EXISTS "Anyone can read restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Authenticated users can manage restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Allow insert restaurants for all" ON public.restaurants;
DROP POLICY IF EXISTS "Allow delete restaurants for all" ON public.restaurants;
DROP POLICY IF EXISTS "Allow read restaurants for all" ON public.restaurants;

-- chains
DROP POLICY IF EXISTS "Anyone can read chains" ON public.chains;
DROP POLICY IF EXISTS "Authenticated users can manage chains" ON public.chains;

-- payout_adjustments
DROP POLICY IF EXISTS "Allow public read on payout_adjustments" ON public.payout_adjustments;
DROP POLICY IF EXISTS "Allow authenticated read on payout_adjustments" ON public.payout_adjustments;
DROP POLICY IF EXISTS "Allow authenticated insert on payout_adjustments" ON public.payout_adjustments;
DROP POLICY IF EXISTS "Allow authenticated delete on payout_adjustments" ON public.payout_adjustments;
DROP POLICY IF EXISTS "Allow service role full access on payout_adjustments" ON public.payout_adjustments;

-- === ORIGINAL DROPS + CREATE ===

-- 1. uber_connections
DROP POLICY IF EXISTS "Allow all on uber_connections" ON public.uber_connections;
CREATE POLICY "Authenticated full access on uber_connections" ON public.uber_connections FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. orders
DROP POLICY IF EXISTS "Allow all on orders" ON public.orders;
CREATE POLICY "Authenticated full access on orders" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. deliveroo_orders
DROP POLICY IF EXISTS "Allow all on deliveroo_orders" ON public.deliveroo_orders;
CREATE POLICY "Authenticated full access on deliveroo_orders" ON public.deliveroo_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. restaurants
DROP POLICY IF EXISTS "Allow all on restaurants" ON public.restaurants;
CREATE POLICY "Authenticated full access on restaurants" ON public.restaurants FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. chains
DROP POLICY IF EXISTS "Allow all on chains" ON public.chains;
CREATE POLICY "Authenticated full access on chains" ON public.chains FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. payout_adjustments
DROP POLICY IF EXISTS "Allow all on payout_adjustments" ON public.payout_adjustments;
CREATE POLICY "Authenticated full access on payout_adjustments" ON public.payout_adjustments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. restaurant_documents
DROP POLICY IF EXISTS "Allow all on restaurant_documents" ON public.restaurant_documents;
DROP POLICY IF EXISTS "Allow read restaurant_documents" ON public.restaurant_documents;
DROP POLICY IF EXISTS "Allow insert restaurant_documents" ON public.restaurant_documents;
DROP POLICY IF EXISTS "Allow delete restaurant_documents" ON public.restaurant_documents;
CREATE POLICY "Authenticated full access on restaurant_documents" ON public.restaurant_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. restaurant_uber_ids
DROP POLICY IF EXISTS "Allow all on restaurant_uber_ids" ON public.restaurant_uber_ids;
CREATE POLICY "Authenticated full access on restaurant_uber_ids" ON public.restaurant_uber_ids FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. managers
DROP POLICY IF EXISTS "Allow all on managers" ON public.managers;
DROP POLICY IF EXISTS "Allow read managers" ON public.managers;
DROP POLICY IF EXISTS "Allow insert managers" ON public.managers;
DROP POLICY IF EXISTS "Allow update managers" ON public.managers;
DROP POLICY IF EXISTS "Allow delete managers" ON public.managers;
CREATE POLICY "Authenticated full access on managers" ON public.managers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. ai_conversations
DROP POLICY IF EXISTS "Allow all on ai_conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Anyone can manage conversations" ON public.ai_conversations;
CREATE POLICY "Authenticated full access on ai_conversations" ON public.ai_conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. ai_messages
DROP POLICY IF EXISTS "Allow all on ai_messages" ON public.ai_messages;
DROP POLICY IF EXISTS "Anyone can manage messages" ON public.ai_messages;
CREATE POLICY "Authenticated full access on ai_messages" ON public.ai_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 12. scheduled_messages
DROP POLICY IF EXISTS "Allow all on scheduled_messages" ON public.scheduled_messages;
CREATE POLICY "Authenticated full access on scheduled_messages" ON public.scheduled_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 13. message_history
DROP POLICY IF EXISTS "Allow all on message_history" ON public.message_history;
CREATE POLICY "Authenticated full access on message_history" ON public.message_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 14. payouts
DROP POLICY IF EXISTS "Allow all on payouts" ON public.payouts;
CREATE POLICY "Authenticated full access on payouts" ON public.payouts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 15. order_items
DROP POLICY IF EXISTS "Allow all on order_items" ON public.order_items;
CREATE POLICY "Authenticated full access on order_items" ON public.order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 16. order_history
DROP POLICY IF EXISTS "Allow all on order_history" ON public.order_history;
CREATE POLICY "Authenticated full access on order_history" ON public.order_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 17. daily_revenue
DROP POLICY IF EXISTS "Allow all on daily_revenue" ON public.daily_revenue;
CREATE POLICY "Authenticated full access on daily_revenue" ON public.daily_revenue FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 18. daily_conversion
DROP POLICY IF EXISTS "Allow all on daily_conversion" ON public.daily_conversion;
CREATE POLICY "Authenticated full access on daily_conversion" ON public.daily_conversion FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 19. monthly_revenue
DROP POLICY IF EXISTS "Allow all on monthly_revenue" ON public.monthly_revenue;
CREATE POLICY "Authenticated full access on monthly_revenue" ON public.monthly_revenue FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 20. monthly_conversion
DROP POLICY IF EXISTS "Allow all on monthly_conversion" ON public.monthly_conversion;
CREATE POLICY "Authenticated full access on monthly_conversion" ON public.monthly_conversion FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 21. monthly_fees
DROP POLICY IF EXISTS "Allow all on monthly_fees" ON public.monthly_fees;
CREATE POLICY "Authenticated full access on monthly_fees" ON public.monthly_fees FOR ALL TO authenticated USING (true) WITH CHECK (true);
