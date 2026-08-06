CREATE OR REPLACE FUNCTION public.splash_duplicate_mappings(p_chain_id uuid)
RETURNS TABLE(
  restaurant_id uuid,
  restaurant_name text,
  restaurant_splash_id integer,
  splash_name text,
  is_not_applicable boolean,
  revenue_ttc numeric,
  order_count bigint,
  days_count bigint,
  first_sale date,
  last_sale date
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT m.restaurant_splash_id, m.splash_name, m.restaurant_id, m.is_not_applicable, r.name AS restaurant_name
    FROM public.splash360_restaurant_mapping m
    JOIN public.restaurants r ON r.id = m.restaurant_id
    WHERE m.chain_id = p_chain_id
      AND m.restaurant_splash_id IS NOT NULL
      AND m.restaurant_splash_id <> 0
      AND (public.is_super_admin() OR public.user_has_chain_access(p_chain_id))
  ),
  dups AS (
    SELECT restaurant_id FROM base GROUP BY restaurant_id HAVING COUNT(*) > 1
  ),
  stats AS (
    SELECT s.restaurant_splash_id,
           SUM(s.revenue_ttc) AS revenue_ttc,
           SUM(s.order_count)::bigint AS order_count,
           COUNT(DISTINCT s.date)::bigint AS days_count,
           MIN(s.date) AS first_sale,
           MAX(s.date) AS last_sale
    FROM public.splash360_daily_sales s
    WHERE s.chain_id = p_chain_id
      AND s.granularity = 'day'
      AND s.platform = 'global'
    GROUP BY s.restaurant_splash_id
  )
  SELECT b.restaurant_id, b.restaurant_name, b.restaurant_splash_id, b.splash_name, b.is_not_applicable,
         COALESCE(st.revenue_ttc, 0), COALESCE(st.order_count, 0), COALESCE(st.days_count, 0),
         st.first_sale, st.last_sale
  FROM base b
  JOIN dups d ON d.restaurant_id = b.restaurant_id
  LEFT JOIN stats st ON st.restaurant_splash_id = b.restaurant_splash_id
  ORDER BY b.restaurant_name, COALESCE(st.revenue_ttc, 0) DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.splash_duplicate_mappings(uuid) TO authenticated;