CREATE OR REPLACE FUNCTION public.get_network_cash_revenue_v2(
  p_chain_id uuid,
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  total_global numeric,
  total_uber numeric,
  total_deliveroo numeric,
  total_global_orders bigint,
  total_uber_orders bigint,
  total_deliveroo_orders bigint,
  total_cash_ht numeric,
  total_cash_vat numeric,
  days_with_data integer,
  prev_total_cash numeric,
  prev_total_cash_orders bigint,
  prev_days_with_data integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scope AS (
    SELECT s.*
    FROM public.splash360_daily_sales s
    WHERE s.granularity = 'day'
      AND s.restaurant_splash_id <> 0
      AND s.date BETWEEN p_start_date AND p_end_date
      AND public.user_has_chain_access(s.chain_id)
      AND (
        (p_chain_id IS NOT NULL AND s.chain_id = p_chain_id)
        OR (
          p_chain_id IS NULL
          AND p_restaurant_ids IS NOT NULL
          AND array_length(p_restaurant_ids, 1) > 0
          AND s.restaurant_id = ANY(p_restaurant_ids)
        )
      )
  ),
  prev_scope AS (
    SELECT s.*
    FROM public.splash360_daily_sales s
    WHERE s.granularity = 'day'
      AND s.restaurant_splash_id <> 0
      AND s.date BETWEEN (p_start_date - INTERVAL '1 year')::date
                     AND (p_end_date - INTERVAL '1 year')::date
      AND public.user_has_chain_access(s.chain_id)
      AND (
        (p_chain_id IS NOT NULL AND s.chain_id = p_chain_id)
        OR (
          p_chain_id IS NULL
          AND p_restaurant_ids IS NOT NULL
          AND array_length(p_restaurant_ids, 1) > 0
          AND s.restaurant_id = ANY(p_restaurant_ids)
        )
      )
  ),
  cur AS (
    SELECT date, platform,
           SUM(COALESCE(revenue_ttc, 0)) AS ttc,
           SUM(COALESCE(revenue_ht, 0)) AS ht,
           SUM(COALESCE(vat_amount, 0)) AS vat,
           SUM(COALESCE(order_count, 0)) AS orders
    FROM scope
    GROUP BY date, platform
  ),
  prev AS (
    SELECT date, platform,
           SUM(COALESCE(revenue_ttc, 0)) AS ttc,
           SUM(COALESCE(order_count, 0)) AS orders
    FROM prev_scope
    GROUP BY date, platform
  ),
  cur_day AS (
    SELECT date,
           SUM(ttc) FILTER (WHERE platform = 'global') AS g_ttc,
           SUM(ttc) FILTER (WHERE platform = 'uber_eats') AS u_ttc,
           SUM(ttc) FILTER (WHERE platform = 'deliveroo') AS d_ttc,
           SUM(ht) FILTER (WHERE platform = 'global') AS g_ht,
           SUM(vat) FILTER (WHERE platform = 'global') AS g_vat,
           SUM(orders) FILTER (WHERE platform = 'global') AS g_o,
           SUM(orders) FILTER (WHERE platform = 'uber_eats') AS u_o,
           SUM(orders) FILTER (WHERE platform = 'deliveroo') AS d_o
    FROM cur
    GROUP BY date
  ),
  prev_day AS (
    SELECT date,
           SUM(ttc) FILTER (WHERE platform = 'global') AS g_ttc,
           SUM(orders) FILTER (WHERE platform = 'global') AS g_o
    FROM prev
    GROUP BY date
  ),
  cur_tot AS (
    SELECT
      COALESCE(SUM(g_ttc), 0) AS total_global,
      COALESCE(SUM(u_ttc), 0) AS total_uber,
      COALESCE(SUM(d_ttc), 0) AS total_deliveroo,
      COALESCE(SUM(g_o), 0)::bigint AS total_global_orders,
      COALESCE(SUM(u_o), 0)::bigint AS total_uber_orders,
      COALESCE(SUM(d_o), 0)::bigint AS total_deliveroo_orders,
      COALESCE(SUM(g_ht), 0) AS total_cash_ht,
      COALESCE(SUM(g_vat), 0) AS total_cash_vat,
      COUNT(*) FILTER (
        WHERE COALESCE(g_ttc, 0) > 0 OR COALESCE(u_ttc, 0) > 0 OR COALESCE(d_ttc, 0) > 0
      )::int AS days_with_data
    FROM cur_day
  ),
  prev_tot AS (
    SELECT
      COALESCE(SUM(g_ttc), 0) AS prev_total_cash,
      COALESCE(SUM(g_o), 0)::bigint AS prev_total_cash_orders,
      COUNT(*) FILTER (WHERE COALESCE(g_ttc, 0) > 0)::int AS prev_days_with_data
    FROM prev_day
  )
  SELECT
    c.total_global,
    c.total_uber,
    c.total_deliveroo,
    c.total_global_orders,
    c.total_uber_orders,
    c.total_deliveroo_orders,
    c.total_cash_ht,
    c.total_cash_vat,
    c.days_with_data,
    p.prev_total_cash,
    p.prev_total_cash_orders,
    p.prev_days_with_data
  FROM cur_tot c, prev_tot p;
$$;

REVOKE ALL ON FUNCTION public.get_network_cash_revenue_v2(uuid, uuid[], date, date) FROM public;
GRANT EXECUTE ON FUNCTION public.get_network_cash_revenue_v2(uuid, uuid[], date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_restaurant_cash_revenue_v2(
  p_chain_id uuid,
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  restaurant_id uuid,
  cash_revenue numeric,
  cash_revenue_ht numeric,
  cash_orders bigint,
  global_revenue numeric,
  prev_cash_revenue numeric,
  prev_cash_orders bigint,
  days_with_data integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH per_day AS (
    SELECT
      s.restaurant_id,
      s.date,
      SUM(COALESCE(s.revenue_ttc, 0)) FILTER (WHERE s.platform = 'global') AS g_ttc,
      SUM(COALESCE(s.revenue_ht, 0)) FILTER (WHERE s.platform = 'global') AS g_ht,
      SUM(COALESCE(s.order_count, 0)) FILTER (WHERE s.platform = 'global') AS g_o,
      SUM(COALESCE(s.revenue_ttc, 0)) FILTER (WHERE s.platform = 'uber_eats') AS u_ttc,
      SUM(COALESCE(s.revenue_ttc, 0)) FILTER (WHERE s.platform = 'deliveroo') AS d_ttc
    FROM public.splash360_daily_sales s
    WHERE s.granularity = 'day'
      AND s.restaurant_splash_id <> 0
      AND s.restaurant_id IS NOT NULL
      AND s.date BETWEEN p_start_date AND p_end_date
      AND public.user_has_chain_access(s.chain_id)
      AND (
        (p_chain_id IS NOT NULL AND s.chain_id = p_chain_id)
        OR (
          p_chain_id IS NULL
          AND p_restaurant_ids IS NOT NULL
          AND array_length(p_restaurant_ids, 1) > 0
          AND s.restaurant_id = ANY(p_restaurant_ids)
        )
      )
    GROUP BY s.restaurant_id, s.date
  ),
  prev_by_restaurant AS (
    SELECT
      s.restaurant_id,
      SUM(COALESCE(s.revenue_ttc, 0)) FILTER (WHERE s.platform = 'global') AS prev_cash_revenue,
      SUM(COALESCE(s.order_count, 0)) FILTER (WHERE s.platform = 'global') AS prev_cash_orders
    FROM public.splash360_daily_sales s
    WHERE s.granularity = 'day'
      AND s.restaurant_splash_id <> 0
      AND s.restaurant_id IS NOT NULL
      AND s.date BETWEEN (p_start_date - INTERVAL '1 year')::date
                     AND (p_end_date - INTERVAL '1 year')::date
      AND public.user_has_chain_access(s.chain_id)
      AND (
        (p_chain_id IS NOT NULL AND s.chain_id = p_chain_id)
        OR (
          p_chain_id IS NULL
          AND p_restaurant_ids IS NOT NULL
          AND array_length(p_restaurant_ids, 1) > 0
          AND s.restaurant_id = ANY(p_restaurant_ids)
        )
      )
    GROUP BY s.restaurant_id
  )
  SELECT
    pd.restaurant_id,
    COALESCE(SUM(pd.g_ttc), 0) AS cash_revenue,
    COALESCE(SUM(pd.g_ht), 0) AS cash_revenue_ht,
    COALESCE(SUM(pd.g_o), 0)::bigint AS cash_orders,
    COALESCE(SUM(COALESCE(pd.g_ttc, 0) + COALESCE(pd.u_ttc, 0) + COALESCE(pd.d_ttc, 0)), 0) AS global_revenue,
    COALESCE(MAX(pbr.prev_cash_revenue), 0) AS prev_cash_revenue,
    COALESCE(MAX(pbr.prev_cash_orders), 0)::bigint AS prev_cash_orders,
    COUNT(*) FILTER (
      WHERE COALESCE(pd.g_ttc, 0) > 0 OR COALESCE(pd.u_ttc, 0) > 0 OR COALESCE(pd.d_ttc, 0) > 0
    )::int AS days_with_data
  FROM per_day pd
  LEFT JOIN prev_by_restaurant pbr ON pbr.restaurant_id = pd.restaurant_id
  GROUP BY pd.restaurant_id;
$$;

REVOKE ALL ON FUNCTION public.get_restaurant_cash_revenue_v2(uuid, uuid[], date, date) FROM public;
GRANT EXECUTE ON FUNCTION public.get_restaurant_cash_revenue_v2(uuid, uuid[], date, date) TO authenticated;