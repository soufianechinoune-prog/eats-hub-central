

## Objectif
Ajouter 7 index pour optimiser les performances des politiques RLS chain-scopées, notamment sur les tables volumineuses (orders 2.9M, deliveroo_orders 1.2M).

## Migration SQL

```sql
-- 1. Jointure RLS : restaurants.chain_id
CREATE INDEX IF NOT EXISTS idx_restaurants_chain_id 
ON public.restaurants(chain_id);

-- 2. Tables volumineuses : restaurant_id (clé de jointure RLS)
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id_rls 
ON public.orders(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_deliveroo_orders_restaurant_id_rls 
ON public.deliveroo_orders(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_id_rls
ON public.order_items(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_order_history_restaurant_id_rls
ON public.order_history(restaurant_id);

-- 3. Fonctions SECURITY DEFINER : user_chain_access lookups
CREATE INDEX IF NOT EXISTS idx_user_chain_access_user_id
ON public.user_chain_access(user_id);

CREATE INDEX IF NOT EXISTS idx_user_chain_access_user_chain
ON public.user_chain_access(user_id, chain_id);
```

## Pourquoi c'est pertinent

- Les RLS `USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_has_chain_access(chain_id)))` font 2 niveaux de sous-requête
- Sans index sur `restaurants.chain_id`, chaque appel à `user_has_chain_access()` scan toute la table restaurants
- Sans index sur `orders.restaurant_id`, le `IN (...)` scan les 2.9M lignes séquentiellement
- L'index composite `(user_id, chain_id)` sur `user_chain_access` optimise directement `is_super_admin()` et `user_has_chain_access()`

## Risque
Zéro — `IF NOT EXISTS` ignore les index déjà présents. Création d'index sur tables existantes sans downtime.

## Aucun changement de code
Uniquement une migration SQL d'indexation.

