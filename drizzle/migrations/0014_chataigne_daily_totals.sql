CREATE OR REPLACE FUNCTION public.get_chataigne_daily_totals(p_start_date date, p_end_date date, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
RETURNS TABLE(date date, revenue_ttc numeric, order_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
  SELECT a.date,
    COALESCE(SUM(a.gross_order_value),0)::numeric,
    COALESCE(SUM(a.order_count),0)::bigint
  FROM public.chataigne_daily_analytics a
  WHERE a.date BETWEEN p_start_date AND p_end_date
    AND (public.is_super_admin() OR public.user_has_chain_access(a.chain_id))
    AND (p_restaurant_ids IS NULL OR a.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY a.date
  ORDER BY a.date;
$function$;

REVOKE ALL ON FUNCTION public.get_chataigne_daily_totals(date, date, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_daily_totals(date, date, uuid[]) TO authenticated, service_role;