

## Objectif
Appliquer les RLS chain-scopées sur 14 tables supplémentaires (pas 15 : `menu_items` n'a pas de `restaurant_id` ni `chain_id`, c'est un catalogue partagé → traité séparément).

## Problème avec menu_items
La table `menu_items` n'a ni `restaurant_id` ni `chain_id`. C'est un catalogue global partagé entre marques. Elle ne peut pas suivre le même pattern et sera traitée dans une migration dédiée (ajout d'un `chain_id` ou d'une table de liaison).

## Migration SQL — 14 tables

```sql
-- =============================================
-- CHAIN-SCOPED RLS — Batch 2 (14 tables)
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

-- 9. restaurant_actions (4 policies à supprimer)
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

-- 11. restaurant_menu_prices (4 policies à supprimer)
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

-- 13. scheduled_messages
DROP POLICY IF EXISTS "Authenticated full access on scheduled_messages" ON public.scheduled_messages;
CREATE POLICY "Chain scoped access on scheduled_messages" ON public.scheduled_messages
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));

-- 14. success_scores
DROP POLICY IF EXISTS "Allow public read access on success_scores" ON public.success_scores;
DROP POLICY IF EXISTS "Allow public insert on success_scores" ON public.success_scores;
DROP POLICY IF EXISTS "Allow public update on success_scores" ON public.success_scores;
DROP POLICY IF EXISTS "Allow public delete on success_scores" ON public.success_scores;
CREATE POLICY "Chain scoped access on success_scores" ON public.success_scores
  FOR ALL TO authenticated
  USING (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)))
  WITH CHECK (is_super_admin() OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)));
```

## Résumé

| # | Table | Anciennes policies supprimées | Nouvelle policy |
|---|-------|-------------------------------|-----------------|
| 1 | chatbot_interactions | 1 (public) | chain scoped |
| 2 | daily_order_accuracy | 1 (public) | chain scoped |
| 3 | daily_sales_uber | 1 (public) | chain scoped |
| 4 | hourly_availability | 1 (public) | chain scoped |
| 5 | manager_restaurants | 1 (public) | chain scoped |
| 6 | message_history | 1 (authenticated) | chain scoped |
| 7 | monthly_order_accuracy | 1 (public) | chain scoped |
| 8 | product_issues_ranking | 1 (public) | chain scoped |
| 9 | restaurant_actions | 4 (CRUD public) | chain scoped |
| 10 | restaurant_documents | 1 (authenticated) | chain scoped |
| 11 | restaurant_menu_prices | 4 (CRUD public) | chain scoped |
| 12 | restaurant_opening_hours | 1 (public) | chain scoped |
| 13 | scheduled_messages | 1 (authenticated) | chain scoped |
| 14 | success_scores | 4 (CRUD public) | chain scoped |

## Table exclue : menu_items
`menu_items` n'a ni `restaurant_id` ni `chain_id` — c'est un catalogue global. Elle nécessite une migration structurelle séparée (ajout d'un `chain_id` ou table de liaison) avant de pouvoir être chain-scopée.

## Tables non touchées
`weather_data`, `import_guide_screenshots`, `user_chain_access` — conformément aux instructions.

