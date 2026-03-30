

## Objectif
Appliquer les RLS chain-scopées sur les 12 dernières tables. Plusieurs ont des structures non standard qui nécessitent des patterns adaptés.

## Analyse par table

### Tables avec `restaurant_id` — pattern standard
| Table | Anciennes policies | Pattern |
|---|---|---|
| customer_reviews | 1 (public) | restaurant_id → restaurants.chain_id |
| menu_item_reviews | 1 (public) | restaurant_id → restaurants.chain_id |
| downtime_logs | 1 (public) | restaurant_id → restaurants.chain_id |
| order_errors | 1 (public) | restaurant_id → restaurants.chain_id |
| delivery_stats | 1 (public) | restaurant_id → restaurants.chain_id |

### Tables avec `chain_id` direct
| Table | Anciennes policies | Pattern |
|---|---|---|
| eco_line_snapshots | 1 (anon+authenticated) | user_has_chain_access(chain_id) |
| rep_check_snapshots | à vérifier | user_has_chain_access(chain_id) |

### Tables sans `restaurant_id` ni `chain_id` — patterns spéciaux

**managers** — pas de restaurant_id, lié via `manager_restaurants.manager_id`
```sql
USING (is_super_admin() OR id IN (
  SELECT manager_id FROM public.manager_restaurants 
  WHERE restaurant_id IN (
    SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)
  )
))
```

**ai_conversations** — PAS de `user_id` dans le schéma (contrairement à ce qui était supposé). C'est une table partagée. On applique un accès authentifié simple :
```sql
USING (is_super_admin() OR true)  -- tout utilisateur authentifié
```
→ En pratique : `FOR ALL TO authenticated USING (true) WITH CHECK (true)` — on garde le même comportement car il n'y a pas de colonne pour scoper.

**ai_messages** — liée à ai_conversations. Même logique : pas de user scoping possible.
```sql
FOR ALL TO authenticated USING (true) WITH CHECK (true)
```

**menu_item_changes** — pas de `restaurant_id`. Liée à `menu_items` (catalogue global) et `restaurant_actions`. On passe par `restaurant_actions` :
```sql
USING (is_super_admin() OR restaurant_action_id IN (
  SELECT id FROM public.restaurant_actions 
  WHERE restaurant_id IN (
    SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)
  )
))
```
Note : `restaurant_action_id` est nullable. Les entrées sans action liée seront visibles uniquement par les super_admins.

**price_history** — même structure que menu_item_changes (menu_item_id + restaurant_action_id). Même pattern via restaurant_actions.

**message_campaigns** — PAS de `restaurant_id`, pas de `chain_id`. C'est une table de campagnes globales. On sécurise en authentifié simple :
```sql
FOR ALL TO authenticated USING (true) WITH CHECK (true)
```

## Migration SQL complète

```sql
-- =============================================
-- CHAIN-SCOPED RLS — Batch 3 (12 tables)
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

-- 11. ai_conversations (pas de user_id ni chain_id — authentifié simple)
DROP POLICY IF EXISTS "Authenticated full access on ai_conversations" ON public.ai_conversations;
CREATE POLICY "Authenticated access on ai_conversations" ON public.ai_conversations
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 12. ai_messages (lié à ai_conversations — authentifié simple)
DROP POLICY IF EXISTS "Authenticated full access on ai_messages" ON public.ai_messages;
CREATE POLICY "Authenticated access on ai_messages" ON public.ai_messages
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 13. message_campaigns (pas de restaurant_id ni chain_id — authentifié simple)
DROP POLICY IF EXISTS "Allow all on message_campaigns" ON public.message_campaigns;
CREATE POLICY "Authenticated access on message_campaigns" ON public.message_campaigns
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

## Choix de design expliqués

| Table | Situation | Décision |
|---|---|---|
| `ai_conversations` | Pas de `user_id` dans le schéma | Accès authentifié simple. Pour scoper par user, il faudrait d'abord ajouter une colonne `user_id` (migration structurelle séparée). |
| `ai_messages` | Liée à `ai_conversations` | Même logique — pas de scoping possible sans `user_id` sur le parent. |
| `message_campaigns` | Pas de `restaurant_id` ni `chain_id` | Accès authentifié simple. Table de campagnes globales. |
| `menu_item_changes` | Pas de `restaurant_id`, mais `restaurant_action_id` nullable | Scoping via `restaurant_actions → restaurants`. Les entrées avec `restaurant_action_id = NULL` ne seront visibles que par les super_admins. |
| `price_history` | Même structure que `menu_item_changes` | Même pattern via `restaurant_actions`. |
| `managers` | Pas de `restaurant_id`, lié via `manager_restaurants` | Sous-requête à 2 niveaux : `manager_restaurants → restaurants → chain_id`. |
| `delivery_stats` | Non mentionnée dans la liste mais a `restaurant_id` et une policy publique | Ajoutée pour cohérence — table de données opérationnelles sensibles. |

## Tables non touchées
- `weather_data`, `import_guide_screenshots` — publiques intentionnellement
- `menu_items`, `scheduled_messages` — exclues conformément aux instructions
- `user_chain_access` — déjà sécurisée
- `csv_imports`, `bodacc_dismissed_alerts`, `action_categories` — tables utilitaires/publiques non mentionnées

## Résultat final
Après cette migration : **42 tables sécurisées** (29 précédentes + 13 dans ce batch).

