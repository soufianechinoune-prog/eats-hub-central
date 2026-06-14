
CREATE OR REPLACE FUNCTION public.get_network_dishop_summary(
  p_chain_id uuid,
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  total_revenue numeric,
  total_orders bigint,
  avg_basket numeric,
  days_with_data integer,
  prev_total_revenue numeric,
  prev_total_orders bigint,
  prev_days_with_data integer,
  by_restaurant jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH accessible_chains AS MATERIALIZED (
    SELECT c.id
    FROM public.chains c
    WHERE (p_chain_id IS NULL OR c.id = p_chain_id)
      AND public.user_has_chain_access(c.id)
  ),
  -- Current period orders
  cur AS (
    SELECT
      o.restaurant_id,
      (o.order_date AT TIME ZONE 'Europe/Paris')::date AS d,
      o.price_total
    FROM public.dishop_orders o
    JOIN accessible_chains ac ON ac.id = o.chain_id
    WHERE o.order_date IS NOT NULL
      AND (o.order_date AT TIME ZONE 'Europe/Paris')::date BETWEEN p_start_date AND p_end_date
      AND (
        p_restaurant_ids IS NULL
        OR array_length(p_restaurant_ids, 1) IS NULL
        OR o.restaurant_id = ANY(p_restaurant_ids)
      )
      AND COALESCE(o.status, '') NOT IN ('cancelled', 'canceled', 'refused')
  ),
  cur_totals AS (
    SELECT
      COALESCE(SUM(price_total), 0)::numeric AS rev,
      COUNT(*)::bigint AS orders_cnt,
      COUNT(DISTINCT d)::int AS days_cnt
    FROM cur
  ),
  cur_by_resto AS (
    SELECT
      restaurant_id,
      COALESCE(SUM(price_total), 0)::numeric AS rev,
      COUNT(*)::bigint AS orders_cnt
    FROM cur
    WHERE restaurant_id IS NOT NULL
    GROUP BY restaurant_id
  ),
  -- Previous equivalent period (same number of days, ending the day before start)
  prev_range AS (
    SELECT
      (p_start_date - (p_end_date - p_start_date + 1))::date AS pstart,
      (p_start_date - 1)::date AS pend
  ),
  prev AS (
    SELECT
      (o.order_date AT TIME ZONE 'Europe/Paris')::date AS d,
      o.price_total
    FROM public.dishop_orders o
    JOIN accessible_chains ac ON ac.id = o.chain_id
    CROSS JOIN prev_range pr
    WHERE o.order_date IS NOT NULL
      AND (o.order_date AT TIME ZONE 'Europe/Paris')::date BETWEEN pr.pstart AND pr.pend
      AND (
        p_restaurant_ids IS NULL
        OR array_length(p_restaurant_ids, 1) IS NULL
        OR o.restaurant_id = ANY(p_restaurant_ids)
      )
      AND COALESCE(o.status, '') NOT IN ('cancelled', 'canceled', 'refused')
  ),
  prev_totals AS (
    SELECT
      COALESCE(SUM(price_total), 0)::numeric AS rev,
      COUNT(*)::bigint AS orders_cnt,
      COUNT(DISTINCT d)::int AS days_cnt
    FROM prev
  )
  SELECT
    ct.rev AS total_revenue,
    ct.orders_cnt AS total_orders,
    CASE WHEN ct.orders_cnt > 0 THEN ct.rev / ct.orders_cnt ELSE 0 END AS avg_basket,
    ct.days_cnt AS days_with_data,
    pt.rev AS prev_total_revenue,
    pt.orders_cnt AS prev_total_orders,
    pt.days_cnt AS prev_days_with_data,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'restaurant_id', cbr.restaurant_id,
        'revenue', cbr.rev,
        'orders', cbr.orders_cnt
      ))
      FROM cur_by_resto cbr
    ), '[]'::jsonb) AS by_restaurant
  FROM cur_totals ct
  CROSS JOIN prev_totals pt;
$$;

GRANT EXECUTE ON FUNCTION public.get_network_dishop_summary(uuid, uuid[], date, date) TO authenticated, service_role;
