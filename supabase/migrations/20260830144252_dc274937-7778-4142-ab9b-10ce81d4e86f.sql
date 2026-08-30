DROP FUNCTION IF EXISTS public.get_payouts_consolidation_status(date, date, uuid[]);

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
  coverage_pct numeric,
  stores_pending_auth bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT
      o.restaurant_id,
      o.payout_date,
      date_trunc('month', o.order_datetime AT TIME ZONE 'Europe/Paris') AS m,
      (r.uber_pos_activated_at IS NOT NULL) AS authorized
    FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.order_datetime >= (date_trunc('month', p_start::timestamp) AT TIME ZONE 'Europe/Paris')
      AND o.order_datetime < ((date_trunc('month', p_end::timestamp) + interval '1 month') AT TIME ZONE 'Europe/Paris')
      AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  )
  SELECT
    EXTRACT(YEAR FROM m)::integer AS year,
    EXTRACT(MONTH FROM m)::integer AS month,
    COUNT(*) FILTER (WHERE authorized)::bigint AS orders_total,
    COUNT(payout_date) FILTER (WHERE authorized)::bigint AS orders_with_payout_date,
    ROUND(
      100.0 * COUNT(payout_date) FILTER (WHERE authorized)
      / NULLIF(COUNT(*) FILTER (WHERE authorized), 0), 1
    ) AS coverage_pct,
    COUNT(DISTINCT restaurant_id) FILTER (WHERE NOT authorized)::bigint AS stores_pending_auth
  FROM scoped
  GROUP BY 1, 2
  HAVING COUNT(payout_date) FILTER (WHERE authorized) < COUNT(*) FILTER (WHERE authorized)
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION public.get_payouts_consolidation_status(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payouts_consolidation_status(date, date, uuid[]) TO service_role;