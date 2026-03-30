

## Objectif
Remplacer les policies RLS "full access" par des policies scopées par marque sur 16 tables, en utilisant `is_super_admin()` et `user_has_chain_access()`.

## Migration SQL complète

```sql
-- =============================================
-- CHAIN-SCOPED RLS — 16 tables
-- Additive: no schema changes, policies only
-- =============================================

-- 1. restaurants (chain_id direct)
DROP POLICY IF EXISTS "Authenticated full access on restaurants" ON public.restaurants;
CREATE POLICY "Chain scoped access on restaurants" ON public.restaurants
  FOR ALL TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id))
  WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));

-- 2. chains (id = chain_id)
DROP POLICY IF EXISTS "Authenticated full access on chains" ON public.chains;
CREATE POLICY "Chain scoped access on chains" ON public.chains
  FOR ALL TO authenticated
  USING (is_super_admin() OR user_has_chain_access(id))
  WITH CHECK (is_super_admin());

-- 3. orders
DROP POLICY IF EXISTS "Authenticated full access on orders" ON public.orders;
CREATE POLICY "Chain scoped access on orders" ON public.orders
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  )
  WITH CHECK (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  );

-- 4. order_items
DROP POLICY IF EXISTS "Authenticated full access on order_items" ON public.order_items;
CREATE POLICY "Chain scoped access on order_items" ON public.order_items
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  )
  WITH CHECK (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  );

-- 5. order_history
DROP POLICY IF EXISTS "Authenticated full access on order_history" ON public.order_history;
CREATE POLICY "Chain scoped access on order_history" ON public.order_history
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  )
  WITH CHECK (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  );

-- 6. deliveroo_orders
DROP POLICY IF EXISTS "Authenticated full access on deliveroo_orders" ON public.deliveroo_orders;
CREATE POLICY "Chain scoped access on deliveroo_orders" ON public.deliveroo_orders
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  )
  WITH CHECK (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  );

-- 7. daily_revenue
DROP POLICY IF EXISTS "Authenticated full access on daily_revenue" ON public.daily_revenue;
CREATE POLICY "Chain scoped access on daily_revenue" ON public.daily_revenue
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  )
  WITH CHECK (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  );

-- 8. daily_conversion
DROP POLICY IF EXISTS "Authenticated full access on daily_conversion" ON public.daily_conversion;
CREATE POLICY "Chain scoped access on daily_conversion" ON public.daily_conversion
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  )
  WITH CHECK (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  );

-- 9. monthly_revenue
DROP POLICY IF EXISTS "Authenticated full access on monthly_revenue" ON public.monthly_revenue;
CREATE POLICY "Chain scoped access on monthly_revenue" ON public.monthly_revenue
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  )
  WITH CHECK (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  );

-- 10. monthly_conversion
DROP POLICY IF EXISTS "Authenticated full access on monthly_conversion" ON public.monthly_conversion;
CREATE POLICY "Chain scoped access on monthly_conversion" ON public.monthly_conversion
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  )
  WITH CHECK (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  );

-- 11. monthly_fees
DROP POLICY IF EXISTS "Authenticated full access on monthly_fees" ON public.monthly_fees;
CREATE POLICY "Chain scoped access on monthly_fees" ON public.monthly_fees
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  )
  WITH CHECK (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  );

-- 12. payouts
DROP POLICY IF EXISTS "Authenticated full access on payouts" ON public.payouts;
CREATE POLICY "Chain scoped access on payouts" ON public.payouts
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  )
  WITH CHECK (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  );

-- 13. payout_adjustments
DROP POLICY IF EXISTS "Authenticated full access on payout_adjustments" ON public.payout_adjustments;
DROP POLICY IF EXISTS "Allow authenticated update on payout_adjustments" ON public.payout_adjustments;
CREATE POLICY "Chain scoped access on payout_adjustments" ON public.payout_adjustments
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  )
  WITH CHECK (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  );

-- 14. uber_connections
DROP POLICY IF EXISTS "Authenticated full access on uber_connections" ON public.uber_connections;
CREATE POLICY "Chain scoped access on uber_connections" ON public.uber_connections
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  )
  WITH CHECK (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  );

-- 15. restaurant_uber_ids
DROP POLICY IF EXISTS "Authenticated full access on restaurant_uber_ids" ON public.restaurant_uber_ids;
CREATE POLICY "Chain scoped access on restaurant_uber_ids" ON public.restaurant_uber_ids
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  )
  WITH CHECK (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  );

-- 16. restaurant_deliveroo_ids
DROP POLICY IF EXISTS "Authenticated full access on restaurant_deliveroo_ids" ON public.restaurant_deliveroo_ids;
CREATE POLICY "Chain scoped access on restaurant_deliveroo_ids" ON public.restaurant_deliveroo_ids
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  )
  WITH CHECK (
    is_super_admin() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id))
  );
```

## Résumé

- **16 tables** mises à jour : 2 avec chain_id direct (`restaurants`, `chains`), 14 avec `restaurant_id` (sous-query vers `restaurants.chain_id`)
- **`payout_adjustments`** : 2 anciennes policies supprimées (la "full access" + la "update" résiduelle)
- **`chains`** : lecture scopée, écriture réservée au super_admin uniquement
- **Tables non touchées** : `weather_data`, `import_guide_screenshots`, `user_chain_access` (déjà sécurisée)
- **Aucune modification de structure** — policies RLS uniquement

## Point de vigilance performance

Le sous-query `restaurant_id IN (SELECT id FROM restaurants WHERE user_has_chain_access(chain_id))` est évalué par le planificateur PostgreSQL pour chaque ligne. Sur les tables volumineuses (2.9M `orders`, 1.2M `deliveroo_orders`), cela peut impacter les performances. Si des lenteurs apparaissent, on pourra créer un index ou une vue matérialisée dans une étape suivante.

