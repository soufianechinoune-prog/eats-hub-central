CREATE OR REPLACE FUNCTION public.get_unmapped_splash_stores(p_chain_id uuid, p_days int DEFAULT 14)
RETURNS TABLE(restaurant_splash_id bigint, splash_name text, revenue_ttc numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT s.restaurant_splash_id::bigint,
         max(m.splash_name),
         SUM(COALESCE(s.revenue_ttc,0))::numeric
  FROM public.splash360_daily_sales s
  LEFT JOIN public.splash360_restaurant_mapping m
    ON m.restaurant_splash_id = s.restaurant_splash_id AND m.chain_id = s.chain_id
  WHERE s.chain_id = p_chain_id
    AND (public.is_super_admin() OR public.user_has_chain_access(p_chain_id))
    AND s.restaurant_id IS NULL
    AND s.restaurant_splash_id <> 0
    AND s.granularity = 'day'
    AND s.platform = 'global'
    AND COALESCE(m.is_not_applicable, false) = false
    AND s.date >= current_date - p_days
  GROUP BY s.restaurant_splash_id
  HAVING SUM(COALESCE(s.revenue_ttc,0)) > 100
  ORDER BY 3 DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_unmapped_splash_stores(uuid, int) TO authenticated;