DROP FUNCTION IF EXISTS public.get_payouts_consolidation_status(integer, uuid[]);

CREATE OR REPLACE FUNCTION public.get_payouts_consolidation_status(
  p_start date,
  p_end date,
  p_restaurant_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  year integer,
  month integer,
  orders_total bigint,
  orders_with_payout_date bigint,
  coverage_pct numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(YEAR FROM date_trunc('month', o.order_datetime AT TIME ZONE 'Europe/Paris'))::integer AS year,
    EXTRACT(MONTH FROM date_trunc('month', o.order_datetime AT TIME ZONE 'Europe/Paris'))::integer AS month,
    COUNT(*)::bigint AS orders_total,
    COUNT(o.payout_date)::bigint AS orders_with_payout_date,
    ROUND(100.0 * COUNT(o.payout_date) / NULLIF(COUNT(*), 0), 1) AS coverage_pct
  FROM public.orders o
  WHERE o.order_datetime >= (date_trunc('month', p_start::timestamp) AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime < ((date_trunc('month', p_end::timestamp) + interval '1 month') AT TIME ZONE 'Europe/Paris')
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY 1, 2
  HAVING COUNT(o.payout_date) < COUNT(*)
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION public.get_payouts_consolidation_status(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payouts_consolidation_status(date, date, uuid[]) TO service_role;