CREATE OR REPLACE FUNCTION public.get_daily_onsite_from_splash(p_start_date date, p_end_date date, p_restaurant_ids uuid[] DEFAULT NULL)
 RETURNS TABLE(restaurant_id uuid, date date, revenue_ttc numeric, order_count bigint, average_basket numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '30s'
AS $$
  SELECT s.restaurant_id, s.date,
    COALESCE(SUM(s.revenue_ttc) FILTER (WHERE s.platform='global'),0)::numeric,
    COALESCE(SUM(s.order_count) FILTER (WHERE s.platform='global'),0)::bigint,
    CASE WHEN COALESCE(SUM(s.order_count) FILTER (WHERE s.platform='global'),0)>0
      THEN ROUND(SUM(s.revenue_ttc) FILTER (WHERE s.platform='global')::numeric
                 / SUM(s.order_count) FILTER (WHERE s.platform='global'),2)
      ELSE 0 END
  FROM public.splash360_daily_sales s
  JOIN public.restaurants r ON r.id = s.restaurant_id
  WHERE s.granularity='day' AND s.restaurant_splash_id<>0 AND s.restaurant_id IS NOT NULL
    AND s.date BETWEEN p_start_date AND p_end_date
    AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
    AND (p_restaurant_ids IS NULL OR s.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY s.restaurant_id, s.date
  ORDER BY s.date;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_chataigne(p_start_date date, p_end_date date, p_restaurant_ids uuid[] DEFAULT NULL)
 RETURNS TABLE(restaurant_id uuid, date date, revenue_ttc numeric, order_count bigint, average_basket numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '30s'
AS $$
  SELECT a.restaurant_id, a.date,
    COALESCE(SUM(a.gross_order_value),0)::numeric,
    COALESCE(SUM(a.order_count),0)::bigint,
    CASE WHEN COALESCE(SUM(a.order_count),0)>0
      THEN ROUND(COALESCE(SUM(a.gross_order_value),0)::numeric / SUM(a.order_count),2)
      ELSE 0 END
  FROM public.chataigne_daily_analytics a
  WHERE a.date BETWEEN p_start_date AND p_end_date
    AND (public.is_super_admin() OR public.user_has_chain_access(a.chain_id))
    AND (p_restaurant_ids IS NULL OR a.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY a.restaurant_id, a.date
  ORDER BY a.date;
$$;

REVOKE ALL ON FUNCTION public.get_daily_onsite_from_splash(date,date,uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_daily_onsite_from_splash(date,date,uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.get_daily_chataigne(date,date,uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_daily_chataigne(date,date,uuid[]) TO authenticated;