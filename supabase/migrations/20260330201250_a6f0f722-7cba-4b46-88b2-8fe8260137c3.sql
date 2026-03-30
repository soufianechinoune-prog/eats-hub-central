
-- =============================================
-- CHAIN-SCOPED RLS — Batch 3 (13 tables)
-- =============================================

-- 1. customer_reviews (restaurant_id)
DROP POLICY IF EXISTS "Allow all on customer_reviews" ON public.customer_reviews;
CREATE POLICY "Chain scoped access on customer_reviews" ON public.customer_reviews
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 2. menu_item_reviews (restaurant_id)
DROP POLICY IF EXISTS "Allow all on menu_item_reviews" ON public.menu_item_reviews;
CREATE POLICY "Chain scoped access on menu_item_reviews" ON public.menu_item_reviews
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 3. downtime_logs (restaurant_id)
DROP POLICY IF EXISTS "Allow all on downtime_logs" ON public.downtime_logs;
CREATE POLICY "Chain scoped access on downtime_logs" ON public.downtime_logs
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 4. order_errors (restaurant_id)
DROP POLICY IF EXISTS "Allow all on order_errors" ON public.order_errors;
CREATE POLICY "Chain scoped access on order_errors" ON public.order_errors
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 5. delivery_stats (restaurant_id)
DROP POLICY IF EXISTS "Allow all on delivery_stats" ON public.delivery_stats;
CREATE POLICY "Chain scoped access on delivery_stats" ON public.delivery_stats
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 6. eco_line_snapshots (chain_id direct)
DROP POLICY IF EXISTS "Allow all on eco_line_snapshots" ON public.eco_line_snapshots;
CREATE POLICY "Chain scoped access on eco_line_snapshots" ON public.eco_line_snapshots
  FOR ALL TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id))
  WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));

-- 7. rep_check_snapshots (chain_id direct)
DROP POLICY IF EXISTS "Allow all on rep_check_snapshots" ON public.rep_check_snapshots;
CREATE POLICY "Chain scoped access on rep_check_snapshots" ON public.rep_check_snapshots
  FOR ALL TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id))
  WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));

-- 8. managers (via manager_restaurants → restaurants)
DROP POLICY IF EXISTS "Authenticated full access on managers" ON public.managers;
CREATE POLICY "Chain scoped access on managers" ON public.managers
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR id IN (
      SELECT manager_id FROM public.manager_restaurants
      WHERE restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
    )
  )
  WITH CHECK (
    is_super_admin() OR id IN (
      SELECT manager_id FROM public.manager_restaurants
      WHERE restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
    )
  );

-- 9. menu_item_changes (via restaurant_actions → restaurants)
DROP POLICY IF EXISTS "Allow read menu_item_changes for all" ON public.menu_item_changes;
DROP POLICY IF EXISTS "Allow insert menu_item_changes for all" ON public.menu_item_changes;
DROP POLICY IF EXISTS "Allow update menu_item_changes for all" ON public.menu_item_changes;
DROP POLICY IF EXISTS "Allow delete menu_item_changes for all" ON public.menu_item_changes;
CREATE POLICY "Chain scoped access on menu_item_changes" ON public.menu_item_changes
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR restaurant_action_id IN (
      SELECT id FROM public.restaurant_actions
      WHERE restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
    )
  )
  WITH CHECK (
    is_super_admin() OR restaurant_action_id IN (
      SELECT id FROM public.restaurant_actions
      WHERE restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
    )
  );

-- 10. price_history (via restaurant_actions → restaurants)
DROP POLICY IF EXISTS "Allow all on price_history" ON public.price_history;
CREATE POLICY "Chain scoped access on price_history" ON public.price_history
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR restaurant_action_id IN (
      SELECT id FROM public.restaurant_actions
      WHERE restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
    )
  )
  WITH CHECK (
    is_super_admin() OR restaurant_action_id IN (
      SELECT id FROM public.restaurant_actions
      WHERE restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
    )
  );

-- 11. ai_conversations (authentifié simple)
DROP POLICY IF EXISTS "Authenticated full access on ai_conversations" ON public.ai_conversations;
CREATE POLICY "Authenticated access on ai_conversations" ON public.ai_conversations
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 12. ai_messages (authentifié simple)
DROP POLICY IF EXISTS "Authenticated full access on ai_messages" ON public.ai_messages;
CREATE POLICY "Authenticated access on ai_messages" ON public.ai_messages
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 13. message_campaigns (authentifié simple)
DROP POLICY IF EXISTS "Allow all on message_campaigns" ON public.message_campaigns;
CREATE POLICY "Authenticated access on message_campaigns" ON public.message_campaigns
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
