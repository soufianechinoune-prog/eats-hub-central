CREATE OR REPLACE FUNCTION public.get_chataigne_restaurant_performance(p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL)
RETURNS TABLE(restaurant_id uuid, restaurant_name text, city text, commandes bigint, ca_brut numeric, panier_moyen numeric, evolution numeric, delivery_rate numeric, clients bigint, discount_rate numeric, cancellation_rate numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '15s'
AS $$
WITH base AS (
 SELECT o.*, (o.order_datetime >= (p_start::timestamp AT TIME ZONE 'Europe/Paris')) AS current_period
 FROM public.chataigne_orders o JOIN public.restaurants r ON r.id=o.restaurant_id AND r.chain_id=o.chain_id
 WHERE o.order_datetime >= ((p_start - (p_end-p_start+1))::timestamp AT TIME ZONE 'Europe/Paris')
 AND o.order_datetime < ((p_end+1)::timestamp AT TIME ZONE 'Europe/Paris')
 AND (p_restaurant_ids IS NULL OR o.restaurant_id=ANY(p_restaurant_ids))
 AND (public.is_super_admin() OR public.user_has_chain_access(o.chain_id))
), totals AS (
 SELECT b.restaurant_id,
 count(*) FILTER (WHERE current_period AND status='completed') AS n,
 count(*) FILTER (WHERE NOT current_period AND status='completed') AS previous_n,
 coalesce(sum(total_amount) FILTER (WHERE current_period AND status='completed'),0) AS revenue,
 count(*) FILTER (WHERE current_period AND status='completed' AND service_type='delivery') AS deliveries,
 count(DISTINCT code_client) FILTER (WHERE current_period AND status='completed') AS customers,
 coalesce(sum(discount_total_amount) FILTER (WHERE current_period AND status='completed'),0) AS discounts,
 count(*) FILTER (WHERE current_period) AS received,
 count(*) FILTER (WHERE current_period AND status IN ('cancelled','delivery_failed')) AS cancelled
 FROM base b GROUP BY b.restaurant_id
)
SELECT t.restaurant_id, r.name, r.city, t.n, round(t.revenue,2), round(t.revenue/nullif(t.n,0),2),
 CASE WHEN t.n>=20 AND t.previous_n>=20 THEN round(100.0*(t.n-t.previous_n)/t.previous_n,1) END,
 round(100.0*t.deliveries/nullif(t.n,0),1), t.customers,
 round(100.0*t.discounts/nullif(t.revenue+t.discounts,0),1),
 round(100.0*t.cancelled/nullif(t.received,0),1)
FROM totals t JOIN public.restaurants r ON r.id=t.restaurant_id WHERE t.received>0 ORDER BY t.n DESC;
$$;
REVOKE ALL ON FUNCTION public.get_chataigne_restaurant_performance(date,date,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_restaurant_performance(date,date,uuid[]) TO authenticated, service_role;