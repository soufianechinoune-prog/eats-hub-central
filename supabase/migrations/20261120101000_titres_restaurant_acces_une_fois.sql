-- Vue d'ensemble, étape 4 : titres-restaurant.
--
-- Les deux fonctions lisent déjà le résumé meal_voucher_daily_summary, mais vérifiaient l'accès à l'enseigne
-- (user_has_chain_access) sur CHAQUE ligne du résumé : ~85 000 appels pour Chicken Street 2026.
-- L'accès est désormais vérifié une fois par restaurant, puis le résumé est filtré par la liste obtenue.
-- Résultats inchangés.

CREATE OR REPLACE FUNCTION public.get_meal_voucher_breakdown(p_restaurant_ids uuid[], p_date_from date, p_date_to date)
 RETURNS TABLE(restaurant_id uuid, provider text, amount numeric, order_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 WITH ids AS (
   SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) AS a FROM public.restaurants r
   WHERE r.id = ANY(p_restaurant_ids) AND public.user_has_chain_access(r.chain_id)
 )
 SELECT s.restaurant_id, s.provider, SUM(s.positive_tr_amount)::numeric, SUM(s.tr_order_count)::bigint
 FROM public.meal_voucher_daily_summary s
 WHERE s.restaurant_id = ANY((SELECT a FROM ids)::uuid[])
 AND s.day BETWEEN p_date_from AND p_date_to
 AND s.provider IN ('Edenred','Swile','Sodexo','UpDejeuner','Bimpli (ex Apetiz)','Pluxee')
 GROUP BY s.restaurant_id,s.provider HAVING SUM(s.tr_order_count)>0;
$function$;

CREATE OR REPLACE FUNCTION public.get_meal_voucher_totals(p_restaurant_ids uuid[], p_date_from date, p_date_to date)
 RETURNS TABLE(restaurant_id uuid, uber_revenue_ttc numeric, uber_order_count bigint, tr_amount numeric, tr_order_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 WITH ids AS (
   SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) AS a FROM public.restaurants r
   WHERE r.id = ANY(p_restaurant_ids) AND public.user_has_chain_access(r.chain_id)
 )
 SELECT s.restaurant_id, COALESCE(SUM(s.uber_revenue_ttc),0)::numeric, SUM(s.uber_order_count)::bigint,
 COALESCE(SUM(s.tr_amount) FILTER (WHERE s.provider IN ('Edenred','Swile','Sodexo','UpDejeuner','Bimpli (ex Apetiz)','Pluxee')),0)::numeric,
 COALESCE(SUM(s.tr_order_count) FILTER (WHERE s.provider IN ('Edenred','Swile','Sodexo','UpDejeuner','Bimpli (ex Apetiz)','Pluxee')),0)::bigint
 FROM public.meal_voucher_daily_summary s
 WHERE s.restaurant_id = ANY((SELECT a FROM ids)::uuid[]) AND s.day BETWEEN p_date_from AND p_date_to
 GROUP BY s.restaurant_id HAVING SUM(s.uber_order_count)>0;
$function$;
