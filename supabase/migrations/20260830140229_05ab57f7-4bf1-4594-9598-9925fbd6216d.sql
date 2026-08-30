CREATE INDEX IF NOT EXISTS idx_orders_missing_payout_date
  ON public.orders (order_datetime)
  WHERE payout_date IS NULL;

CREATE OR REPLACE FUNCTION public.get_payouts_consolidation_status(
  p_year integer,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(month integer, orders_total bigint, orders_with_payout_date bigint, coverage_pct numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH incomplete_months AS (
    -- mois ayant au moins une commande sans payout_date (index partiel)
    SELECT DISTINCT EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::integer AS m
    FROM public.orders o
    WHERE o.payout_date IS NULL
      AND EXTRACT(YEAR FROM (o.order_datetime AT TIME ZONE 'Europe/Paris')) = p_year
      AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  )
  SELECT
    EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::integer AS month,
    COUNT(*)::bigint AS orders_total,
    COUNT(o.payout_date)::bigint AS orders_with_payout_date,
    ROUND(100.0 * COUNT(o.payout_date) / NULLIF(COUNT(*),0), 1) AS coverage_pct
  FROM public.orders o
  WHERE EXTRACT(YEAR FROM (o.order_datetime AT TIME ZONE 'Europe/Paris')) = p_year
    AND EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::integer IN (SELECT m FROM incomplete_months)
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY 1
  ORDER BY 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_payouts_consolidation_status(integer, uuid[]) TO authenticated, service_role;