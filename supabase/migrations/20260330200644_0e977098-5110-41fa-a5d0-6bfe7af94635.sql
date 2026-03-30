
-- =============================================
-- CHAIN-SCOPED RLS — Batch 2 (13 tables)
-- scheduled_messages exclue (pas de restaurant_id)
-- =============================================

-- 1. chatbot_interactions
DROP POLICY IF EXISTS "Allow all on chatbot_interactions" ON public.chatbot_interactions;
CREATE POLICY "Chain scoped access on chatbot_interactions" ON public.chatbot_interactions
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 2. daily_order_accuracy
DROP POLICY IF EXISTS "Allow all on daily_order_accuracy" ON public.daily_order_accuracy;
CREATE POLICY "Chain scoped access on daily_order_accuracy" ON public.daily_order_accuracy
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 3. daily_sales_uber
DROP POLICY IF EXISTS "Allow all on daily_sales_uber" ON public.daily_sales_uber;
CREATE POLICY "Chain scoped access on daily_sales_uber" ON public.daily_sales_uber
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 4. hourly_availability
DROP POLICY IF EXISTS "Allow all on hourly_availability" ON public.hourly_availability;
CREATE POLICY "Chain scoped access on hourly_availability" ON public.hourly_availability
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 5. manager_restaurants
DROP POLICY IF EXISTS "Allow all on manager_restaurants" ON public.manager_restaurants;
CREATE POLICY "Chain scoped access on manager_restaurants" ON public.manager_restaurants
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 6. message_history
DROP POLICY IF EXISTS "Authenticated full access on message_history" ON public.message_history;
CREATE POLICY "Chain scoped access on message_history" ON public.message_history
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 7. monthly_order_accuracy
DROP POLICY IF EXISTS "Allow all on monthly_order_accuracy" ON public.monthly_order_accuracy;
CREATE POLICY "Chain scoped access on monthly_order_accuracy" ON public.monthly_order_accuracy
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 8. product_issues_ranking
DROP POLICY IF EXISTS "Allow all on product_issues_ranking" ON public.product_issues_ranking;
CREATE POLICY "Chain scoped access on product_issues_ranking" ON public.product_issues_ranking
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 9. restaurant_actions
DROP POLICY IF EXISTS "Allow read restaurant_actions for all" ON public.restaurant_actions;
DROP POLICY IF EXISTS "Allow insert restaurant_actions for all" ON public.restaurant_actions;
DROP POLICY IF EXISTS "Allow update restaurant_actions for all" ON public.restaurant_actions;
DROP POLICY IF EXISTS "Allow delete restaurant_actions for all" ON public.restaurant_actions;
CREATE POLICY "Chain scoped access on restaurant_actions" ON public.restaurant_actions
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 10. restaurant_documents
DROP POLICY IF EXISTS "Authenticated full access on restaurant_documents" ON public.restaurant_documents;
CREATE POLICY "Chain scoped access on restaurant_documents" ON public.restaurant_documents
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 11. restaurant_menu_prices
DROP POLICY IF EXISTS "Allow read restaurant_menu_prices for all" ON public.restaurant_menu_prices;
DROP POLICY IF EXISTS "Allow insert restaurant_menu_prices for all" ON public.restaurant_menu_prices;
DROP POLICY IF EXISTS "Allow update restaurant_menu_prices for all" ON public.restaurant_menu_prices;
DROP POLICY IF EXISTS "Allow delete restaurant_menu_prices for all" ON public.restaurant_menu_prices;
CREATE POLICY "Chain scoped access on restaurant_menu_prices" ON public.restaurant_menu_prices
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 12. restaurant_opening_hours
DROP POLICY IF EXISTS "Allow all operations on restaurant_opening_hours" ON public.restaurant_opening_hours;
CREATE POLICY "Chain scoped access on restaurant_opening_hours" ON public.restaurant_opening_hours
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 13. success_scores
DROP POLICY IF EXISTS "Allow public read access on success_scores" ON public.success_scores;
DROP POLICY IF EXISTS "Allow public insert on success_scores" ON public.success_scores;
DROP POLICY IF EXISTS "Allow public update on success_scores" ON public.success_scores;
DROP POLICY IF EXISTS "Allow public delete on success_scores" ON public.success_scores;
CREATE POLICY "Chain scoped access on success_scores" ON public.success_scores
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));
