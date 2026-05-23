CREATE OR REPLACE FUNCTION public.get_refunded_orders_count(p_restaurant_ids uuid[], p_start_date date, p_end_date date)
RETURNS TABLE(restaurant_id uuid, refunded_orders bigint, total_orders bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '45s'
AS $function$
DECLARE
  v_today      date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_live_from  date := v_today - 15;
  v_cache_end  date;
  v_live_start date;
  v_live_end   date;
BEGIN
  v_cache_end  := LEAST(p_end_date, v_live_from - 1);
  v_live_start := GREATEST(p_start_date, v_live_from);
  v_live_end   := p_end_date;

  RETURN QUERY
  WITH cache_part AS (
    SELECT c.restaurant_id AS rid,
           SUM(c.refunded_orders)::bigint AS ref,
           SUM(c.total_orders)::bigint    AS tot
      FROM public.refund_daily_cache c
     WHERE c.restaurant_id = ANY(p_restaurant_ids)
       AND p_start_date <= v_cache_end
       AND c.date BETWEEN p_start_date AND v_cache_end
     GROUP BY c.restaurant_id
  ),
  live_part AS (
    SELECT o.restaurant_id AS rid,
           COUNT(*) FILTER (WHERE COALESCE(o.refund_incl_vat, 0) <> 0)::bigint AS ref,
           COUNT(*)::bigint AS tot
      FROM public.orders o
     WHERE v_live_start <= v_live_end
       AND o.restaurant_id = ANY(p_restaurant_ids)
       AND o.order_datetime >= (v_live_start::timestamp AT TIME ZONE 'Europe/Paris')
       AND o.order_datetime <  ((v_live_end + 1)::timestamp AT TIME ZONE 'Europe/Paris')
     GROUP BY o.restaurant_id
  ),
  merged AS (
    SELECT rid, ref, tot FROM cache_part
    UNION ALL
    SELECT rid, ref, tot FROM live_part
  )
  SELECT m.rid, SUM(m.ref)::bigint, SUM(m.tot)::bigint
    FROM merged m
   GROUP BY m.rid;
END;
$function$;