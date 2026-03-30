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