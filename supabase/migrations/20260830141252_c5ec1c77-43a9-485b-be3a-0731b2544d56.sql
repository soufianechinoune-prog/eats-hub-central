CREATE OR REPLACE FUNCTION public.get_payouts_consolidation_status(
  p_year integer,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(month integer, orders_total bigint, orders_with_payout_date bigint, coverage_pct numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start timestamptz := (make_date(p_year, 1, 1)::timestamp AT TIME ZONE 'Europe/Paris');
  v_end   timestamptz := (make_date(p_year + 1, 1, 1)::timestamp AT TIME ZONE 'Europe/Paris');
BEGIN
  IF p_restaurant_ids IS NULL THEN
    RETURN QUERY
    WITH incomplete_months AS (
      SELECT DISTINCT EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::integer AS m
      FROM public.orders o
      WHERE o.payout_date IS NULL
        AND o.order_datetime >= v_start
        AND o.order_datetime < v_end
    )
    SELECT
      EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::integer AS month,
      COUNT(*)::bigint AS orders_total,
      COUNT(o.payout_date)::bigint AS orders_with_payout_date,
      ROUND(100.0 * COUNT(o.payout_date) / NULLIF(COUNT(*),0), 1) AS coverage_pct
    FROM public.orders o
    WHERE o.order_datetime >= v_start
      AND o.order_datetime < v_end
      AND EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::integer IN (SELECT m FROM incomplete_months)
    GROUP BY 1
    ORDER BY 1;
  ELSE
    RETURN QUERY
    WITH incomplete_months AS (
      SELECT DISTINCT EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::integer AS m
      FROM public.orders o
      WHERE o.payout_date IS NULL
        AND o.order_datetime >= v_start
        AND o.order_datetime < v_end
        AND o.restaurant_id = ANY(p_restaurant_ids)
    )
    SELECT
      EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::integer AS month,
      COUNT(*)::bigint AS orders_total,
      COUNT(o.payout_date)::bigint AS orders_with_payout_date,
      ROUND(100.0 * COUNT(o.payout_date) / NULLIF(COUNT(*),0), 1) AS coverage_pct
    FROM public.orders o
    WHERE o.order_datetime >= v_start
      AND o.order_datetime < v_end
      AND o.restaurant_id = ANY(p_restaurant_ids)
      AND EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::integer IN (SELECT m FROM incomplete_months)
    GROUP BY 1
    ORDER BY 1;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_payouts_consolidation_status(integer, uuid[]) TO authenticated, service_role;