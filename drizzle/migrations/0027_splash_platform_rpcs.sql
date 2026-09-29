CREATE OR REPLACE FUNCTION public.get_daily_platforms_from_splash(p_start_date date, p_end_date date, p_restaurant_ids uuid[])
RETURNS TABLE(restaurant_id uuid, date date, platform text, revenue_ttc numeric, order_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '30s'
AS $$
  SELECT s.restaurant_id, s.date, s.platform,
         SUM(COALESCE(s.revenue_ttc,0))::numeric, SUM(COALESCE(s.order_count,0))::bigint
  FROM public.splash360_daily_sales s
  JOIN public.restaurants r ON r.id = s.restaurant_id
  WHERE s.granularity = 'day'
    AND s.restaurant_splash_id <> 0
    AND s.platform IN ('uber_eats','deliveroo')
    AND s.restaurant_id = ANY(p_restaurant_ids)
    AND s.date BETWEEN p_start_date AND p_end_date
    AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
  GROUP BY s.restaurant_id, s.date, s.platform
  ORDER BY s.date;
$$;
GRANT EXECUTE ON FUNCTION public.get_daily_platforms_from_splash(date, date, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_splash_platforms_by_restaurant(p_start_date date, p_end_date date, p_restaurant_ids uuid[])
RETURNS TABLE(restaurant_id uuid, has_splash boolean, uber_revenue numeric, uber_orders bigint, deliveroo_revenue numeric, deliveroo_orders bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '30s'
AS $$
  SELECT s.restaurant_id,
         bool_or(COALESCE(s.revenue_ttc,0) > 0),
         COALESCE(SUM(s.revenue_ttc) FILTER (WHERE s.platform='uber_eats'),0)::numeric,
         COALESCE(SUM(s.order_count) FILTER (WHERE s.platform='uber_eats'),0)::bigint,
         COALESCE(SUM(s.revenue_ttc) FILTER (WHERE s.platform='deliveroo'),0)::numeric,
         COALESCE(SUM(s.order_count) FILTER (WHERE s.platform='deliveroo'),0)::bigint
  FROM public.splash360_daily_sales s
  JOIN public.restaurants r ON r.id = s.restaurant_id
  WHERE s.granularity = 'day'
    AND s.restaurant_splash_id <> 0
    AND s.restaurant_id = ANY(p_restaurant_ids)
    AND s.date BETWEEN p_start_date AND p_end_date
    AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
  GROUP BY s.restaurant_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_splash_platforms_by_restaurant(date, date, uuid[]) TO authenticated;